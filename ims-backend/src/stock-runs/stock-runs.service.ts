import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventorySourceType,
  InventoryTransactionType,
  Prisma,
  StockRunStatus,
} from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service';
import { sumDecimals, toDecimal } from '../common/utils/decimal.util';
import { OutboxService } from '../events/outbox.service';
import { InventoryLedgerService } from '../inventory/inventory-ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStockRunDto } from './dto/create-stock-run.dto';
import { CreateStockRunItemDto } from './dto/create-stock-run-item.dto';
import { ListStockRunsDto } from './dto/list-stock-runs.dto';
import { UpdateStockRunDto } from './dto/update-stock-run.dto';

const STOCK_RUN_REASON_CODE = 'RESTOCK';

@Injectable()
export class StockRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryLedgerService: InventoryLedgerService,
    private readonly availabilityService: AvailabilityService,
    private readonly outboxService: OutboxService,
  ) {}

  async createStockRun(dto: CreateStockRunDto, userId: string) {
    return this.prisma.stockRun.create({
      data: {
        name: dto.name,
        notes: dto.notes ?? null,
        createdByUserId: userId,
      },
    });
  }

  async updateStockRun(stockRunId: string, dto: UpdateStockRunDto) {
    const stockRun = await this.ensureDraftStockRun(stockRunId);

    return this.prisma.stockRun.update({
      where: { id: stockRun.id },
      data: {
        name: dto.name ?? stockRun.name,
        notes: dto.notes ?? stockRun.notes,
      },
    });
  }

  async addStockRunItem(stockRunId: string, dto: CreateStockRunItemDto) {
    await this.ensureDraftStockRun(stockRunId);
    await this.ensureRawMaterialExists(dto.rawMaterialId);

    if (dto.supplierId) {
      await this.ensureSupplierExists(dto.supplierId);
    }

    return this.prisma.stockRunItem.create({
      data: {
        stockRunId,
        rawMaterialId: dto.rawMaterialId,
        supplierId: dto.supplierId ?? null,
        quantity: toDecimal(dto.quantity),
        costPerUnit: toDecimal(dto.costPerUnit),
        expirationDate: dto.expirationDate
          ? new Date(dto.expirationDate)
          : null,
        receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : null,
        note: dto.note ?? null,
      },
    });
  }

  async deleteStockRunItem(stockRunId: string, stockRunItemId: string) {
    await this.ensureDraftStockRun(stockRunId);

    const item = await this.prisma.stockRunItem.findFirst({
      where: {
        id: stockRunItemId,
        stockRunId,
      },
      select: { id: true },
    });

    if (!item) {
      throw new NotFoundException('Stock run item not found');
    }

    await this.prisma.stockRunItem.delete({
      where: { id: item.id },
    });
  }

  async deleteDraftStockRun(stockRunId: string) {
    const stockRun = await this.ensureDraftStockRun(stockRunId);

    await this.prisma.stockRun.delete({
      where: { id: stockRun.id },
    });
  }

  async postStockRun(stockRunId: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const stockRun = await tx.stockRun.findUnique({
        where: { id: stockRunId },
        include: {
          items: true,
        },
      });

      if (!stockRun) {
        throw new NotFoundException('Stock run not found');
      }

      if (stockRun.status !== StockRunStatus.DRAFT) {
        throw new BadRequestException('Only draft stock runs can be posted');
      }

      if (stockRun.items.length === 0) {
        throw new BadRequestException(
          'A stock run must contain at least one item',
        );
      }

      const postedAt = new Date();
      const totalCost = sumDecimals(
        stockRun.items.map((item) => item.quantity.mul(item.costPerUnit)),
      );

      const createdBatches: Array<{
        id: string;
        rawMaterialId: string;
        initialQuantity: Prisma.Decimal;
        costPerUnit: Prisma.Decimal;
      }> = [];
      for (const item of stockRun.items) {
        const batch = await tx.stockBatch.create({
          data: {
            rawMaterialId: item.rawMaterialId,
            supplierId: item.supplierId ?? null,
            stockRunItemId: item.id,
            initialQuantity: item.quantity,
            remainingQuantity: item.quantity,
            costPerUnit: item.costPerUnit,
            expirationDate: item.expirationDate,
            receivedAt: item.receivedAt ?? postedAt,
          },
        });

        createdBatches.push({
          id: batch.id,
          rawMaterialId: batch.rawMaterialId,
          initialQuantity: batch.initialQuantity,
          costPerUnit: batch.costPerUnit,
        });
      }

      await this.inventoryLedgerService.appendTransaction(tx, {
        type: InventoryTransactionType.STOCK_RUN,
        sourceType: InventorySourceType.STOCK_RUN,
        sourceId: stockRun.id,
        actorUserId,
        reasonCode: STOCK_RUN_REASON_CODE,
        note: `Stock run posted: ${stockRun.name}`,
        occurredAt: postedAt,
        lines: createdBatches.map((batch) => ({
          rawMaterialId: batch.rawMaterialId,
          stockBatchId: batch.id,
          quantityDelta: batch.initialQuantity,
          unitCostSnapshot: batch.costPerUnit,
          totalCostDelta: batch.initialQuantity.mul(batch.costPerUnit),
        })),
      });

      await tx.stockRun.update({
        where: { id: stockRun.id },
        data: {
          status: StockRunStatus.POSTED,
          postedAt,
          totalCost,
        },
      });

      const rawMaterialIds = stockRun.items.map((item) => item.rawMaterialId);
      await this.availabilityService.refreshRawMaterialSummaries(
        tx,
        rawMaterialIds,
      );
      await this.availabilityService.refreshVariantSummariesForRawMaterialIds(
        tx,
        rawMaterialIds,
      );

      await this.outboxService.enqueue(tx, {
        aggregateType: 'stock_run',
        aggregateId: stockRun.id,
        eventType: 'stock-run.posted',
        payload: {
          stockRunId: stockRun.id,
          postedAt: postedAt.toISOString(),
          rawMaterialIds,
        },
      });

      return tx.stockRun.findUnique({
        where: { id: stockRun.id },
        include: {
          items: true,
        },
      });
    });
  }

  async listStockRuns(filters: ListStockRunsDto) {
    return this.prisma.stockRun.findMany({
      where: {
        status: filters.status,
        createdByUserId: filters.createdByUserId,
        createdAt:
          filters.from || filters.to
            ? {
                gte: filters.from ? new Date(filters.from) : undefined,
                lte: filters.to ? new Date(filters.to) : undefined,
              }
            : undefined,
        name: filters.search?.trim()
          ? {
              contains: filters.search.trim(),
              mode: 'insensitive',
            }
          : undefined,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        items: true,
      },
    });
  }

  async getStockRunById(stockRunId: string) {
    const stockRun = await this.prisma.stockRun.findUnique({
      where: { id: stockRunId },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        items: {
          include: {
            rawMaterial: {
              include: {
                unit: true,
              },
            },
            supplier: true,
            stockBatch: true,
          },
        },
      },
    });

    if (!stockRun) {
      throw new NotFoundException('Stock run not found');
    }

    return stockRun;
  }

  private async ensureDraftStockRun(stockRunId: string) {
    const stockRun = await this.prisma.stockRun.findUnique({
      where: { id: stockRunId },
    });

    if (!stockRun) {
      throw new NotFoundException('Stock run not found');
    }

    if (stockRun.status !== StockRunStatus.DRAFT) {
      throw new BadRequestException('Only draft stock runs can be edited');
    }

    return stockRun;
  }

  private async ensureRawMaterialExists(rawMaterialId: string) {
    const rawMaterial = await this.prisma.rawMaterial.findUnique({
      where: { id: rawMaterialId },
      select: { id: true },
    });

    if (!rawMaterial) {
      throw new NotFoundException('Raw material not found');
    }
  }

  private async ensureSupplierExists(supplierId: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
  }
}
