import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventorySourceType,
  InventoryTransactionType,
  Prisma,
} from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service';
import { toDecimal } from '../common/utils/decimal.util';
import { OutboxService } from '../events/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryWasteDto } from './dto/create-inventory-waste.dto';
import { ListInventoryTransactionsDto } from './dto/list-inventory-transactions.dto';
import { InventoryLedgerService } from './inventory-ledger.service';

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
    const where: Prisma.InventoryTransactionWhereInput = {};

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
