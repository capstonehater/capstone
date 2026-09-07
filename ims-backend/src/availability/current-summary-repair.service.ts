import { AvailabilityBlockingReason, Prisma } from '@prisma/client';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../prisma/prisma.service';

type RawMaterialSummaryRecord = {
  rawMaterialId: string;
  onHandQuantity: Prisma.Decimal;
  usableQuantity: Prisma.Decimal;
  activeBatchCount: number;
  nearestExpiryDate: Date | null;
};

type VariantSummaryRecord = {
  productVariantId: string;
  isInStock: boolean;
  isSellable: boolean;
  availableBaseQty: number;
  blockingReason: AvailabilityBlockingReason;
};

export type RawMaterialRepairPlanRow = {
  rawMaterialId: string;
  rawMaterialName: string;
  reasons: string[];
  existingSummary: RawMaterialSummaryRecord | null;
  expectedSummary: {
    onHandQuantity: Prisma.Decimal;
    usableQuantity: Prisma.Decimal;
    activeBatchCount: number;
    nearestExpiryDate: Date | null;
  };
  totalRemainingQuantity: Prisma.Decimal;
  nonExpiredRemainingQuantity: Prisma.Decimal;
  expiredRemainingQuantity: Prisma.Decimal;
  predictedStockoutEventAction: 'NONE' | 'OPEN' | 'CLOSE';
};

export type VariantRepairPlanRow = {
  productVariantId: string;
  productVariantName: string;
  productId: string;
  productName: string;
  reasons: string[];
  existingSummary: VariantSummaryRecord | null;
  expectedSummary: {
    isInStock: boolean;
    isSellable: boolean;
    availableBaseQty: number;
    blockingReason: AvailabilityBlockingReason;
  };
  predictedAvailabilityEvent: boolean;
};

export type CurrentSummaryRepairPlan = {
  referenceDate: string;
  rawMaterials: RawMaterialRepairPlanRow[];
  variants: VariantRepairPlanRow[];
};

export class CurrentSummaryRepairService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  async buildPlan(
    referenceDate = new Date(),
  ): Promise<CurrentSummaryRepairPlan> {
    const [rawMaterialRows, variantRows] = await Promise.all([
      this.buildRawMaterialRows(referenceDate),
      this.buildVariantRows(referenceDate),
    ]);

    return {
      referenceDate: referenceDate.toISOString(),
      rawMaterials: rawMaterialRows,
      variants: variantRows,
    };
  }

  async applyPlan(
    plan: CurrentSummaryRepairPlan,
    referenceDate = new Date(),
  ): Promise<{
    rawMaterialIds: string[];
    variantIds: string[];
  }> {
    const rawMaterialIds = plan.rawMaterials.map((row) => row.rawMaterialId);
    const variantIds = plan.variants.map((row) => row.productVariantId);

    if (rawMaterialIds.length === 0 && variantIds.length === 0) {
      return { rawMaterialIds: [], variantIds: [] };
    }

    await this.prisma.$transaction(async (tx) => {
      if (rawMaterialIds.length > 0) {
        await this.availabilityService.refreshRawMaterialSummaries(
          tx,
          rawMaterialIds,
          referenceDate,
        );
      }

      if (variantIds.length > 0) {
        await this.availabilityService.refreshVariantSummariesForVariantIds(
          tx,
          variantIds,
          referenceDate,
        );
      }
    });

    return {
      rawMaterialIds,
      variantIds,
    };
  }

  private async buildRawMaterialRows(referenceDate: Date) {
    const rawMaterials = await this.prisma.rawMaterial.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
      },
    });

    const rawMaterialIds = rawMaterials.map((row) => row.id);
    const [expectedSnapshots, existingSummaries] = await Promise.all([
      this.availabilityService.computeRawMaterialSummarySnapshots(
        this.prisma,
        rawMaterialIds,
        referenceDate,
      ),
      this.prisma.rawMaterialInventorySummary.findMany({
        where: {
          rawMaterialId: {
            in: rawMaterialIds,
          },
        },
        select: {
          rawMaterialId: true,
          onHandQuantity: true,
          usableQuantity: true,
          activeBatchCount: true,
          nearestExpiryDate: true,
        },
      }),
    ]);

    const existingMap = new Map(
      existingSummaries.map((summary) => [summary.rawMaterialId, summary]),
    );

    return expectedSnapshots
      .map<RawMaterialRepairPlanRow | null>((snapshot) => {
        const existing = existingMap.get(snapshot.rawMaterialId) ?? null;
        const reasons: string[] = [];

        if (!existing) {
          reasons.push('MISSING_SUMMARY');
        } else {
          if (
            !this.decimalEquals(
              existing.onHandQuantity,
              snapshot.onHandQuantity,
            )
          ) {
            reasons.push('ON_HAND_MISMATCH');
          }
          if (
            !this.decimalEquals(
              existing.usableQuantity,
              snapshot.usableQuantity,
            )
          ) {
            reasons.push('USABLE_MISMATCH');
          }
          if (existing.activeBatchCount !== snapshot.activeBatchCount) {
            reasons.push('ACTIVE_BATCH_COUNT_MISMATCH');
          }
          if (
            !this.dateEquals(
              existing.nearestExpiryDate ?? null,
              snapshot.nearestExpiryDate,
            )
          ) {
            reasons.push('NEAREST_EXPIRY_MISMATCH');
          }
          if (
            snapshot.expiredQuantity.greaterThan(0) &&
            existing.usableQuantity.greaterThan(snapshot.usableQuantity)
          ) {
            reasons.push('EXPIRED_STOCK_COUNTED_AS_USABLE');
          }
        }

        if (reasons.length === 0) {
          return null;
        }

        return {
          rawMaterialId: snapshot.rawMaterialId,
          rawMaterialName: snapshot.rawMaterialName,
          reasons,
          existingSummary: existing,
          expectedSummary: {
            onHandQuantity: snapshot.onHandQuantity,
            usableQuantity: snapshot.usableQuantity,
            activeBatchCount: snapshot.activeBatchCount,
            nearestExpiryDate: snapshot.nearestExpiryDate,
          },
          totalRemainingQuantity: snapshot.onHandQuantity,
          nonExpiredRemainingQuantity: snapshot.nonExpiredQuantity,
          expiredRemainingQuantity: snapshot.expiredQuantity,
          predictedStockoutEventAction: this.predictStockoutEventAction(
            existing,
            snapshot,
          ),
        };
      })
      .filter((row): row is RawMaterialRepairPlanRow => row !== null);
  }

  private async buildVariantRows(referenceDate: Date) {
    const variantIds = (
      await this.prisma.productVariant.findMany({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
        },
      })
    ).map((row) => row.id);

    const rawMaterialSnapshots =
      await this.availabilityService.computeRawMaterialSummarySnapshots(
        this.prisma,
        (
          await this.prisma.rawMaterial.findMany({
            select: { id: true },
          })
        ).map((row) => row.id),
        referenceDate,
      );

    const authoritativeUsableMap = new Map(
      rawMaterialSnapshots.map((snapshot) => [
        snapshot.rawMaterialId,
        snapshot.usableQuantity,
      ]),
    );

    const [expectedSnapshots, existingSummaries] = await Promise.all([
      this.availabilityService.computeVariantAvailabilitySnapshots(
        this.prisma,
        variantIds,
        authoritativeUsableMap,
      ),
      this.prisma.variantAvailabilitySummary.findMany({
        where: {
          productVariantId: {
            in: variantIds,
          },
        },
        select: {
          productVariantId: true,
          isInStock: true,
          isSellable: true,
          availableBaseQty: true,
          blockingReason: true,
        },
      }),
    ]);

    const existingMap = new Map(
      existingSummaries.map((summary) => [summary.productVariantId, summary]),
    );

    return expectedSnapshots
      .map<VariantRepairPlanRow | null>((snapshot) => {
        const existing = existingMap.get(snapshot.productVariantId) ?? null;
        const reasons: string[] = [];

        if (!existing) {
          reasons.push('MISSING_SUMMARY');
        } else {
          if (existing.isInStock !== snapshot.isInStock) {
            reasons.push('IN_STOCK_MISMATCH');
          }
          if (existing.isSellable !== snapshot.isSellable) {
            reasons.push('SELLABLE_MISMATCH');
          }
          if (existing.availableBaseQty !== snapshot.availableBaseQty) {
            reasons.push('AVAILABLE_BASE_QTY_MISMATCH');
          }
          if (existing.blockingReason !== snapshot.blockingReason) {
            reasons.push('BLOCKING_REASON_MISMATCH');
          }
        }

        if (reasons.length === 0) {
          return null;
        }

        return {
          productVariantId: snapshot.productVariantId,
          productVariantName: snapshot.productVariantName,
          productId: snapshot.productId,
          productName: snapshot.productName,
          reasons,
          existingSummary: existing,
          expectedSummary: {
            isInStock: snapshot.isInStock,
            isSellable: snapshot.isSellable,
            availableBaseQty: snapshot.availableBaseQty,
            blockingReason: snapshot.blockingReason,
          },
          predictedAvailabilityEvent:
            !existing ||
            existing.isSellable !== snapshot.isSellable ||
            existing.blockingReason !== snapshot.blockingReason,
        };
      })
      .filter((row): row is VariantRepairPlanRow => row !== null);
  }

  private predictStockoutEventAction(
    existing: RawMaterialSummaryRecord | null,
    snapshot: {
      isActive: boolean;
      usableQuantity: Prisma.Decimal;
    },
  ) {
    const previouslyOutOfStock =
      !!existing && existing.usableQuantity.lessThanOrEqualTo(0);
    const nowOutOfStock =
      snapshot.isActive && snapshot.usableQuantity.lessThanOrEqualTo(0);

    if (!previouslyOutOfStock && nowOutOfStock) {
      return 'OPEN' as const;
    }

    if (previouslyOutOfStock && !nowOutOfStock) {
      return 'CLOSE' as const;
    }

    return 'NONE' as const;
  }

  private decimalEquals(
    left: Prisma.Decimal | null | undefined,
    right: Prisma.Decimal | null | undefined,
  ) {
    if (!left && !right) {
      return true;
    }

    if (!left || !right) {
      return false;
    }

    return left.comparedTo(right) === 0;
  }

  private dateEquals(left: Date | null, right: Date | null) {
    if (!left && !right) {
      return true;
    }

    if (!left || !right) {
      return false;
    }

    return left.getTime() === right.getTime();
  }
}
