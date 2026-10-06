import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventorySourceType,
  InventoryTransactionType,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service';
import { toDecimal } from '../common/utils/decimal.util';
import { OutboxService } from '../events/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryWasteDto } from './dto/create-inventory-waste.dto';
import { ListInventoryTransactionsDto } from './dto/list-inventory-transactions.dto';
import { InventoryLedgerService } from './inventory-ledger.service';
import { HISTORY_REVERSAL_REASON, historyStockWasReversed } from './inventory-history';

type TxClient = Prisma.TransactionClient;

@Injectable()
export class InventoryActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryLedgerService: InventoryLedgerService,
    private readonly availabilityService: AvailabilityService,
    private readonly outboxService: OutboxService,
  ) {}

  async logWaste(dto: CreateInventoryWasteDto, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.ensureRawMaterialExists(tx, dto.rawMaterialId);
      await tx.$queryRaw(Prisma.sql`SELECT id FROM stock_batches WHERE id = ${dto.batchId} FOR UPDATE`);
      const batch = await this.ensureUsableBatch(
        tx,
        dto.batchId,
        dto.rawMaterialId,
      );
      const quantity = toDecimal(dto.quantity);

      if (batch.remainingQuantity.lessThan(quantity)) {
        throw new BadRequestException(
          'Waste quantity exceeds remaining batch quantity',
        );
      }

      await tx.stockBatch.update({
        where: { id: batch.id },
        data: {
          remainingQuantity: batch.remainingQuantity.minus(quantity),
        },
      });

      const transaction = await this.inventoryLedgerService.appendTransaction(
        tx,
        {
          type: InventoryTransactionType.WASTE,
          sourceType: InventorySourceType.WASTE,
          sourceId: batch.id,
          actorUserId,
          reasonCode: dto.reasonCode,
          metadata: {
            rawMaterialId: dto.rawMaterialId,
            batchId: batch.id,
          },
          note: dto.note ?? null,
          occurredAt: new Date(),
          lines: [
            {
              rawMaterialId: dto.rawMaterialId,
              stockBatchId: batch.id,
              quantityDelta: quantity.negated(),
              unitCostSnapshot: batch.costPerUnit,
              totalCostDelta: quantity.mul(batch.costPerUnit).negated(),
            },
          ],
        },
      );

      await this.refreshInventoryReadModels(tx, dto.rawMaterialId);
      await this.outboxService.enqueue(tx, {
        aggregateType: 'inventory_waste',
        aggregateId: transaction.id,
        eventType: 'inventory.waste-logged',
        payload: {
          transactionId: transaction.id,
          rawMaterialId: dto.rawMaterialId,
          quantity: quantity.toString(),
          batchId: batch.id,
        },
      });

      return this.getTransactionById(tx, transaction.id);
    });
  }

  async listTransactions(filters: ListInventoryTransactionsDto) {
    return this.prisma.inventoryTransaction.findMany({
      where: this.buildTransactionWhere(filters),
      orderBy: { occurredAt: 'desc' },
      take: filters.limit ?? 100,
      include: {
        actorUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        lines: {
          where: {
            rawMaterialId: filters.rawMaterialId,
            stockBatchId: filters.stockBatchId,
          },
          include: {
            rawMaterial: true,
            stockBatch: true,
            productVariant: true,
          },
        },
      },
    });
  }

  async deleteTransactionHistory(transactionId: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const reference = await tx.inventoryTransaction.findUnique({
        where: { id: transactionId },
        select: { sourceType: true, sourceId: true },
      });
      if (!reference)
        throw new NotFoundException('Inventory history entry not found');

      // Match refund locking order so a refund and history deletion cannot both restore stock.
      if (reference.sourceType === InventorySourceType.ORDER && reference.sourceId) {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM orders WHERE id = ${reference.sourceId} FOR UPDATE`);
      }
      await tx.$queryRaw(Prisma.sql`SELECT id FROM inventory_transactions WHERE id = ${transactionId} FOR UPDATE`);
      const original = await tx.inventoryTransaction.findUnique({
        where: { id: transactionId }, include: { lines: true },
      });
      if (!original) throw new NotFoundException('Inventory history entry not found');
      if (original.historyDeletedAt) {
        return { id: transactionId, deleted: true, stockReversed: historyStockWasReversed(original.metadata) };
      }
      if (original.reasonCode === HISTORY_REVERSAL_REASON) {
        throw new BadRequestException('A history deletion adjustment cannot be deleted again');
      }
      if (original.sourceType === InventorySourceType.ORDER && original.sourceId) {
        const order = await tx.order.findUnique({ where: { id: original.sourceId }, select: { status: true } });
        if (order && order.status !== OrderStatus.COMPLETED) {
          throw new BadRequestException('This checkout has already been refunded. Its stock cannot be restored again.');
        }
      }

      // Aggregate repeated lines for a batch, then use conditional atomic updates to avoid negative stock.
      const changes = new Map<string, { rawMaterialId: string; delta: Prisma.Decimal }>();
      for (const line of original.lines) {
        const existing = changes.get(line.stockBatchId);
        changes.set(line.stockBatchId, {
          rawMaterialId: line.rawMaterialId,
          delta: (existing?.delta ?? toDecimal(0)).plus(line.quantityDelta),
        });
      }
      const batchIds = [...changes.keys()].sort();
      if (batchIds.length) {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM stock_batches WHERE id IN (${Prisma.join(batchIds)}) ORDER BY id FOR UPDATE`);
      }
      for (const batchId of batchIds) {
        const change = changes.get(batchId)!;
        const updated = await tx.stockBatch.updateMany({
          where: { id: batchId, rawMaterialId: change.rawMaterialId,
            ...(change.delta.greaterThan(0) ? { remainingQuantity: { gte: change.delta } } : {}) },
          data: { remainingQuantity: { decrement: change.delta } },
        });
        if (updated.count !== 1) {
          throw new BadRequestException('Cannot delete this history entry: its batch is missing or insufficient stock remains to undo the original movement.');
        }
      }

      const deletedAt = new Date();
      const reversal = await this.inventoryLedgerService.appendTransaction(tx, {
        type: InventoryTransactionType.ADJUSTMENT,
        sourceType: InventorySourceType.INVENTORY_ADJUSTMENT,
        sourceId: original.id, actorUserId,
        reasonCode: HISTORY_REVERSAL_REASON,
        note: `Stock movement reversed after deleting history entry ${original.id}`,
        metadata: { originalTransactionId: original.id }, occurredAt: deletedAt,
        lines: original.lines.map(line => ({
          rawMaterialId: line.rawMaterialId, stockBatchId: line.stockBatchId,
          quantityDelta: line.quantityDelta.negated(), unitCostSnapshot: line.unitCostSnapshot,
          totalCostDelta: line.totalCostDelta.negated(),
          productVariantId: line.productVariantId ?? undefined,
          orderItemId: line.orderItemId ?? undefined,
        })),
      });
      const metadata = original.metadata && typeof original.metadata === 'object' && !Array.isArray(original.metadata)
        ? original.metadata : {};
      await tx.inventoryTransaction.update({ where: { id: original.id }, data: {
        historyDeletedAt: deletedAt, historyDeletedByUserId: actorUserId,
        metadata: { ...metadata, historyStockReversed: true, historyReversalTransactionId: reversal.id },
      } });
      // Keep the compensating ledger entry for reconciliation without recreating the deleted history row.
      await tx.inventoryTransaction.update({ where: { id: reversal.id }, data: {
        historyDeletedAt: deletedAt, historyDeletedByUserId: actorUserId,
      } });
      const rawMaterialIds = [...new Set(original.lines.map(line => line.rawMaterialId))];
      await this.availabilityService.refreshRawMaterialSummaries(tx, rawMaterialIds);
      await this.availabilityService.refreshVariantSummariesForRawMaterialIds(tx, rawMaterialIds);
      await this.outboxService.enqueue(tx, {
        aggregateType: 'inventory_transaction', aggregateId: original.id,
        eventType: 'inventory.history-deleted',
        payload: { transactionId: original.id, reversalTransactionId: reversal.id, rawMaterialIds },
      });
      return { id: transactionId, deleted: true, stockReversed: true };
    });
  }

  async listTransactionsForRawMaterial(
    rawMaterialId: string,
    filters: ListInventoryTransactionsDto,
  ) {
    await this.ensureRawMaterialExists(this.prisma, rawMaterialId);
    return this.listTransactions({
      ...filters,
      rawMaterialId,
    });
  }

  async listTransactionsForBatch(
    stockBatchId: string,
    filters: ListInventoryTransactionsDto,
  ) {
    const batch = await this.prisma.stockBatch.findUnique({
      where: { id: stockBatchId },
      select: { id: true },
    });

    if (!batch) {
      throw new NotFoundException('Stock batch not found');
    }

    return this.listTransactions({
      ...filters,
      stockBatchId,
    });
  }

  private async refreshInventoryReadModels(
    tx: TxClient,
    rawMaterialId: string,
  ) {
    await this.availabilityService.refreshRawMaterialSummaries(tx, [
      rawMaterialId,
    ]);
    await this.availabilityService.refreshVariantSummariesForRawMaterialIds(
      tx,
      [rawMaterialId],
    );
  }

  private buildTransactionWhere(
    filters: ListInventoryTransactionsDto,
  ): Prisma.InventoryTransactionWhereInput {
    const where: Prisma.InventoryTransactionWhereInput = {
      historyDeletedAt: null,
    };

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.actorUserId) {
      where.actorUserId = filters.actorUserId;
    }

    if (filters.from || filters.to) {
      where.occurredAt = {};

      if (filters.from) {
        where.occurredAt.gte = new Date(filters.from);
      }

      if (filters.to) {
        where.occurredAt.lte = new Date(filters.to);
      }
    }

    if (filters.search?.trim()) {
      const search = filters.search.trim();
      const normalizedSearch = search.toUpperCase().replace(/[\s-]+/g, '_');
      const matchingTypes = Object.values(InventoryTransactionType).filter(
        (value) => value.includes(normalizedSearch),
      );
      const matchingSourceTypes = Object.values(InventorySourceType).filter(
        (value) => value.includes(normalizedSearch),
      );

      where.OR = [
        {
          note: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          reasonCode: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          actorUser: {
            is: {
              email: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
        {
          actorUser: {
            is: {
              firstName: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
        {
          actorUser: {
            is: {
              lastName: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
        ...(matchingTypes.length > 0
          ? [
              {
                type: {
                  in: matchingTypes,
                },
              } satisfies Prisma.InventoryTransactionWhereInput,
            ]
          : []),
        ...(matchingSourceTypes.length > 0
          ? [
              {
                sourceType: {
                  in: matchingSourceTypes,
                },
              } satisfies Prisma.InventoryTransactionWhereInput,
            ]
          : []),
      ];
    }

    if (filters.rawMaterialId || filters.stockBatchId) {
      where.lines = {
        some: {
          rawMaterialId: filters.rawMaterialId,
          stockBatchId: filters.stockBatchId,
        },
      };
    }

    return where;
  }

  private async getTransactionById(tx: TxClient, transactionId: string) {
    return tx.inventoryTransaction.findUnique({
      where: { id: transactionId },
      include: {
        actorUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        lines: {
          include: {
            rawMaterial: true,
            stockBatch: true,
            productVariant: true,
          },
        },
      },
    });
  }

  private async ensureRawMaterialExists(
    tx: TxClient | PrismaService,
    rawMaterialId: string,
  ) {
    const rawMaterial = await tx.rawMaterial.findUnique({
      where: { id: rawMaterialId },
      select: { id: true },
    });

    if (!rawMaterial) {
      throw new NotFoundException('Raw material not found');
    }
  }

  private async ensureUsableBatch(
    tx: TxClient,
    batchId: string,
    rawMaterialId: string,
  ) {
    const batch = await tx.stockBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        rawMaterialId: true,
        remainingQuantity: true,
        costPerUnit: true,
        expirationDate: true,
      },
    });

    if (!batch || batch.rawMaterialId !== rawMaterialId) {
      throw new NotFoundException(
        'Stock batch not found for this raw material',
      );
    }

    if (
      batch.expirationDate &&
      batch.expirationDate < new Date(new Date().setHours(0, 0, 0, 0))
    ) {
      throw new BadRequestException(
        'Expired batches cannot be adjusted or wasted',
      );
    }

    return batch;
  }
}
