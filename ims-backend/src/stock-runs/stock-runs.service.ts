import { withHistoricalMaterial } from '../inventory/material-history-snapshot';
import {
  BadRequestException,
  ConflictException,
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
    return this.prisma.$transaction(async (tx) => {
      // Serialize creation system-wide so simultaneous requests cannot create two drafts.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('stock-run-draft-limit'))`;
      const unfinishedDraft = await tx.stockRun.findFirst({
        where: { status: StockRunStatus.DRAFT },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true, reference: true },
      });
      if (unfinishedDraft) {
        throw new ConflictException({
          message: `Complete the first draft "${unfinishedDraft.name}" (${unfinishedDraft.reference ?? unfinishedDraft.id}) before creating another stock run. Post the draft to complete it, or delete it if it is no longer needed.`,
          draftId: unfinishedDraft.id,
        });
      }
      return tx.stockRun.create({
        data: { name: dto.name, notes: dto.notes ?? null, createdByUserId: userId },
      });
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
    const rawMaterial = await this.ensureRawMaterialExists(dto.rawMaterialId);
    const unitCode = rawMaterial.unit.code.trim().toUpperCase();
    const costUnitCode = dto.costUnitCode?.trim().toUpperCase() ?? unitCode;
    if (dto.costUnitCode !== undefined && dto.costQuantity === undefined) {
      throw new BadRequestException('Price quantity is required when a price unit is selected');
    }
    const priceQuantity = dto.costQuantity ?? (unitCode === 'G' || unitCode === 'ML' ? 1000 : 1);
    let conversionFactor = 1;
    if (costUnitCode !== unitCode) {
      if (unitCode === 'G' && costUnitCode === 'KG' || unitCode === 'ML' && costUnitCode === 'L') conversionFactor = 1000;
      else if (unitCode === 'KG' && costUnitCode === 'G' || unitCode === 'L' && costUnitCode === 'ML') conversionFactor = 0.001;
      else throw new BadRequestException('Price unit must match the material unit or its kg/g or L/ml equivalent');
    }
    const costQuantity = toDecimal(priceQuantity).mul(conversionFactor);

    if (dto.supplierId) {
      await this.ensureSupplierExists(dto.supplierId);
    }

    return this.prisma.stockRunItem.create({
      data: {
        stockRunId,
        rawMaterialId: dto.rawMaterialId,
        supplierId: dto.supplierId ?? null,
        quantity: toDecimal(dto.quantity),
        costPerUnit: toDecimal(dto.costPerUnit).div(costQuantity).toDecimalPlaces(8),
        purchaseCost: toDecimal(dto.costPerUnit),
        priceQuantity: toDecimal(priceQuantity),
        priceUnitCode: costUnitCode,
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
          items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
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

      const items = stockRun.items.map((item) => {
        if (!item.rawMaterialId) throw new BadRequestException("A material in this draft was deleted. Remove the item before posting.");
        return { ...item, rawMaterialId: item.rawMaterialId };
      });
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
      for (const item of items) {
        const batch = await tx.stockBatch.create({
          data: {
            rawMaterialId: item.rawMaterialId,
            supplierId: item.supplierId ?? null,
            stockRunItemId: item.id,
            reference: `${stockRun.reference}-B${String(createdBatches.length + 1).padStart(2, '0')}`,
            initialQuantity: item.quantity,
            remainingQuantity: item.quantity,
            costPerUnit: item.costPerUnit,
            expirationDate: item.expirationDate,
            receivedAt: item.receivedAt ?? postedAt,
          },
        });

        createdBatches.push({
          id: batch.id,
          rawMaterialId: item.rawMaterialId,
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

      const rawMaterialIds = items.map((item) => item.rawMaterialId);
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
        OR: filters.search?.trim()
          ? ['name', 'reference'].map((field) => ({
              [field]: { contains: filters.search!.trim(), mode: 'insensitive' as const },
            }))
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

    return { ...stockRun, items: stockRun.items.map(withHistoricalMaterial) };
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
      select: { id: true, unit: { select: { code: true } } },
    });

    if (!rawMaterial) {
      throw new NotFoundException('Raw material not found');
    }
    return rawMaterial;
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
