import { Injectable } from '@nestjs/common';
import { AvailabilityBlockingReason, Prisma } from '@prisma/client';
import {
  getManilaBusinessDateRange,
  getTodayManilaBusinessDateInput,
  parseBusinessDateToDateOnlyUtc,
} from '../common/utils/manila-business-date.util';
import { PrismaService } from '../prisma/prisma.service';
import { floorDecimalToInt } from '../common/utils/decimal.util';
import { InventoryStateHistoryService } from './inventory-state-history.service';

type TxClient = Prisma.TransactionClient;

type RequiredModifierGroupAvailability = {
  modifierGroup: {
    modifiers: Array<{
      recipeAdjustments: Array<{
        rawMaterialId: string;
        quantityDelta: Prisma.Decimal;
      }>;
    }>;
  };
};

type VariantWithDependencies = {
  id: string;
  name: string;
  isEnabled: boolean;
  product: {
    id: string;
    name: string;
    isEnabled: boolean;
    productModifierGroups?: RequiredModifierGroupAvailability[];
  };
  recipeItems: Array<{
    rawMaterialId: string;
    quantity: Prisma.Decimal;
  }>;
};

export type RawMaterialSummarySnapshot = {
  rawMaterialId: string;
  rawMaterialName: string;
  isActive: boolean;
  reorderPoint: Prisma.Decimal;
  onHandQuantity: Prisma.Decimal;
  usableQuantity: Prisma.Decimal;
  nonExpiredQuantity: Prisma.Decimal;
  expiredQuantity: Prisma.Decimal;
  activeBatchCount: number;
  nearestExpiryDate: Date | null;
  stockState: 'INACTIVE' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';
};

export type VariantAvailabilitySnapshot = {
  productVariantId: string;
  productVariantName: string;
  productId: string;
  productName: string;
  productEnabled: boolean;
  variantEnabled: boolean;
  recipeLineCount: number;
  activeRecipeMaterialCount: number;
  isInStock: boolean;
  isSellable: boolean;
  availableBaseQty: number;
  blockingReason: AvailabilityBlockingReason;
};

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryStateHistoryService: InventoryStateHistoryService,
  ) {}

  async getVariantAvailability(variantId: string) {
    const summary = await this.prisma.variantAvailabilitySummary.findUnique({
      where: { productVariantId: variantId },
    });

    if (summary) {
      return summary;
    }

    await this.refreshVariantSummariesForVariantIds(this.prisma, [variantId]);

    return this.prisma.variantAvailabilitySummary.findUnique({
      where: { productVariantId: variantId },
    });
  }

  async rebuildAllSummaries(tx?: TxClient): Promise<void> {
    const client = tx ?? this.prisma;
    const rawMaterials = await client.rawMaterial.findMany({
      select: { id: true },
    });
    const variants = await client.productVariant.findMany({
      select: { id: true },
    });

    await this.refreshRawMaterialSummaries(
      client,
      rawMaterials.map((item) => item.id),
    );
    await this.refreshVariantSummariesForVariantIds(
      client,
      variants.map((item) => item.id),
    );
  }

  async refreshRawMaterialSummaries(
    tx: TxClient,
    rawMaterialIds: string[],
    referenceDate = new Date(),
  ): Promise<void> {
    const uniqueIds = [...new Set(rawMaterialIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return;
    }

    const [snapshots, existingSummaries] = await Promise.all([
      this.computeRawMaterialSummarySnapshots(tx, uniqueIds, referenceDate),
      tx.rawMaterialInventorySummary.findMany({
        where: {
          rawMaterialId: {
            in: uniqueIds,
          },
        },
        select: {
          rawMaterialId: true,
          usableQuantity: true,
        },
      }),
    ]);

    const previousSummaryMap = new Map(
      existingSummaries.map((summary) => [summary.rawMaterialId, summary]),
    );

    for (const snapshot of snapshots) {
      await tx.rawMaterialInventorySummary.upsert({
        where: { rawMaterialId: snapshot.rawMaterialId },
        update: {
          onHandQuantity: snapshot.onHandQuantity,
          usableQuantity: snapshot.usableQuantity,
          activeBatchCount: snapshot.activeBatchCount,
          nearestExpiryDate: snapshot.nearestExpiryDate,
        },
        create: {
          rawMaterialId: snapshot.rawMaterialId,
          onHandQuantity: snapshot.onHandQuantity,
          usableQuantity: snapshot.usableQuantity,
          activeBatchCount: snapshot.activeBatchCount,
          nearestExpiryDate: snapshot.nearestExpiryDate,
        },
      });
    }

    await this.inventoryStateHistoryService.syncRawMaterialStockoutEvents(
      tx,
      snapshots.map((snapshot) => ({
        rawMaterialId: snapshot.rawMaterialId,
        isActive: snapshot.isActive,
        previousUsableQuantity:
          previousSummaryMap.get(snapshot.rawMaterialId)?.usableQuantity ??
          null,
        nextUsableQuantity: snapshot.usableQuantity,
      })),
      referenceDate,
    );
  }

  async refreshVariantSummariesForRawMaterialIds(
    tx: TxClient,
    rawMaterialIds: string[],
    occurredAt = new Date(),
  ): Promise<void> {
    const uniqueIds = [...new Set(rawMaterialIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return;
    }

    const impactedVariants = await tx.productVariant.findMany({
      where: {
        OR: [
          {
            recipeItems: {
              some: {
                rawMaterialId: { in: uniqueIds },
              },
            },
          },
          {
            product: {
              productModifierGroups: {
                some: {
                  modifierGroup: {
                    modifiers: {
                      some: {
                        recipeAdjustments: {
                          some: {
                            rawMaterialId: { in: uniqueIds },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    await this.refreshVariantSummariesForVariantIds(
      tx,
      impactedVariants.map((variant) => variant.id),
      occurredAt,
    );
  }

  async refreshVariantSummariesForVariantIds(
    tx: TxClient,
    variantIds: string[],
    occurredAt = new Date(),
  ): Promise<void> {
    const uniqueIds = [...new Set(variantIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return;
    }

    const [snapshots, existingVariantSummaries] = await Promise.all([
      this.computeVariantAvailabilitySnapshots(tx, uniqueIds),
      tx.variantAvailabilitySummary.findMany({
        where: {
          productVariantId: {
            in: uniqueIds,
          },
        },
        select: {
          productVariantId: true,
          isSellable: true,
          blockingReason: true,
        },
      }),
    ]);

    const previousVariantSummaryMap = new Map(
      existingVariantSummaries.map((summary) => [
        summary.productVariantId,
        summary,
      ]),
    );

    const transitions: Array<{
      productVariantId: string;
      previousIsSellable: boolean | null;
      previousBlockingReason: AvailabilityBlockingReason | null;
      newIsSellable: boolean;
      newBlockingReason: AvailabilityBlockingReason;
      availableBaseQty: number;
    }> = [];

    for (const snapshot of snapshots) {
      const previousSummary = previousVariantSummaryMap.get(
        snapshot.productVariantId,
      );
      await tx.variantAvailabilitySummary.upsert({
        where: { productVariantId: snapshot.productVariantId },
        update: {
          isInStock: snapshot.isInStock,
          isSellable: snapshot.isSellable,
          availableBaseQty: snapshot.availableBaseQty,
          blockingReason: snapshot.blockingReason,
        },
        create: {
          productVariantId: snapshot.productVariantId,
          isInStock: snapshot.isInStock,
          isSellable: snapshot.isSellable,
          availableBaseQty: snapshot.availableBaseQty,
          blockingReason: snapshot.blockingReason,
        },
      });

      transitions.push({
        productVariantId: snapshot.productVariantId,
        previousIsSellable: previousSummary?.isSellable ?? null,
        previousBlockingReason: previousSummary?.blockingReason ?? null,
        newIsSellable: snapshot.isSellable,
        newBlockingReason: snapshot.blockingReason,
        availableBaseQty: snapshot.availableBaseQty,
      });
    }

    await this.inventoryStateHistoryService.recordVariantAvailabilityEvents(
      tx,
      transitions,
      occurredAt,
    );
  }

  async computeRawMaterialSummarySnapshots(
    tx: TxClient,
    rawMaterialIds: string[],
    referenceDate = new Date(),
  ): Promise<RawMaterialSummarySnapshot[]> {
    const uniqueIds = [...new Set(rawMaterialIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return [];
    }

    const businessDate = this.resolveBusinessDate(referenceDate);
    const [materials, batches] = await Promise.all([
      tx.rawMaterial.findMany({
        where: {
          id: {
            in: uniqueIds,
          },
        },
        select: {
          id: true,
          name: true,
          isActive: true,
          reorderPoint: true,
        },
      }),
      tx.stockBatch.findMany({
        where: {
          rawMaterialId: { in: uniqueIds },
        },
        select: {
          rawMaterialId: true,
          remainingQuantity: true,
          expirationDate: true,
        },
      }),
    ]);

    const grouped = new Map<string, RawMaterialSummarySnapshot>();

    for (const material of materials) {
      grouped.set(material.id, {
        rawMaterialId: material.id,
        rawMaterialName: material.name,
        isActive: material.isActive,
        reorderPoint: material.reorderPoint,
        onHandQuantity: new Prisma.Decimal(0),
        usableQuantity: new Prisma.Decimal(0),
        nonExpiredQuantity: new Prisma.Decimal(0),
        expiredQuantity: new Prisma.Decimal(0),
        activeBatchCount: 0,
        nearestExpiryDate: null,
        stockState: material.isActive ? 'OUT_OF_STOCK' : 'INACTIVE',
      });
    }

    for (const batch of batches) {
      const entry = grouped.get(batch.rawMaterialId);
      if (!entry) {
        continue;
      }

      entry.onHandQuantity = entry.onHandQuantity.plus(batch.remainingQuantity);

      if (batch.remainingQuantity.greaterThan(0)) {
        entry.activeBatchCount += 1;

        if (!batch.expirationDate || batch.expirationDate >= businessDate) {
          entry.usableQuantity = entry.usableQuantity.plus(
            batch.remainingQuantity,
          );
          entry.nonExpiredQuantity = entry.nonExpiredQuantity.plus(
            batch.remainingQuantity,
          );

          if (
            batch.expirationDate &&
            (!entry.nearestExpiryDate ||
              batch.expirationDate < entry.nearestExpiryDate)
          ) {
            entry.nearestExpiryDate = batch.expirationDate;
          }
        } else {
          entry.expiredQuantity = entry.expiredQuantity.plus(
            batch.remainingQuantity,
          );
        }
      }
    }

    return [...grouped.values()].map((snapshot) => ({
      ...snapshot,
      stockState: this.resolveRawMaterialStockState(snapshot),
    }));
  }

  async computeVariantAvailabilitySnapshots(
    tx: TxClient,
    variantIds: string[],
    rawMaterialUsableQuantityMap?: Map<string, Prisma.Decimal>,
  ): Promise<VariantAvailabilitySnapshot[]> {
    const uniqueIds = [...new Set(variantIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return [];
    }

    const variants = await tx.productVariant.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        name: true,
        isEnabled: true,
        product: {
          select: {
            id: true,
            name: true,
            isEnabled: true,
            productModifierGroups: {
              where: {
                isRequired: true,
              },
              select: {
                id: true,
                allowQuantity: true,
                minSelect: true,
                maxSelect: true,
                modifierGroup: {
                  select: {
                    modifiers: {
                      where: { isActive: true },
                      select: {
                        id: true,
                        recipeAdjustments: {
                          select: {
                            rawMaterialId: true,
                            quantityDelta: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        recipeItems: {
          select: {
            rawMaterialId: true,
            quantity: true,
            rawMaterial: {
              select: {
                isActive: true,
              },
            },
          },
        },
      },
    });

    const summaryMap =
      rawMaterialUsableQuantityMap ??
      (await this.loadRawMaterialUsableQuantityMap(tx, variants));

    return variants.map((variant) => {
      const isInStock = this.computeVariantInStock(variant, summaryMap);
      const availableBaseQty = this.computeAvailableBaseQty(
        variant,
        summaryMap,
      );
      const requiredModifierOptionsValid = this.hasValidRequiredModifierOptions(
        variant.product.productModifierGroups,
        summaryMap,
      );
      const blockingReason = this.resolveBlockingReason(
        variant,
        isInStock,
        requiredModifierOptionsValid,
      );

      return {
        productVariantId: variant.id,
        productVariantName: variant.name,
        productId: variant.product.id,
        productName: variant.product.name,
        productEnabled: variant.product.isEnabled,
        variantEnabled: variant.isEnabled,
        recipeLineCount: variant.recipeItems.length,
        activeRecipeMaterialCount: variant.recipeItems.filter(
          (item) => item.rawMaterial.isActive,
        ).length,
        isInStock,
        isSellable: blockingReason === AvailabilityBlockingReason.NONE,
        availableBaseQty,
        blockingReason,
      };
    });
  }

  async findRawMaterialIdsWithExpiredStock(
    tx: TxClient,
    referenceDate = new Date(),
  ): Promise<string[]> {
    const businessDate = this.resolveBusinessDate(referenceDate);
    const batches = await tx.stockBatch.findMany({
      where: {
        remainingQuantity: {
          gt: new Prisma.Decimal(0),
        },
        expirationDate: {
          lt: businessDate,
        },
      },
      select: {
        rawMaterialId: true,
      },
    });

    return [...new Set(batches.map((batch) => batch.rawMaterialId))];
  }

  private async loadRawMaterialUsableQuantityMap(
    tx: TxClient,
    variants: VariantWithDependencies[],
  ) {
    const rawMaterialIds = [
      ...new Set(
        variants.flatMap((variant) => [
          ...variant.recipeItems.map((item) => item.rawMaterialId),
          ...(variant.product.productModifierGroups ?? []).flatMap((group) =>
            group.modifierGroup.modifiers.flatMap((modifier) =>
              modifier.recipeAdjustments.map(
                (adjustment) => adjustment.rawMaterialId,
              ),
            ),
          ),
        ]),
      ),
    ];

    const summaries = await tx.rawMaterialInventorySummary.findMany({
      where: {
        rawMaterialId: { in: rawMaterialIds },
      },
      select: {
        rawMaterialId: true,
        usableQuantity: true,
      },
    });

    return new Map(
      summaries.map((summary) => [
        summary.rawMaterialId,
        summary.usableQuantity,
      ]),
    );
  }

  private resolveBusinessDate(referenceDate = new Date()) {
    return parseBusinessDateToDateOnlyUtc(
      getTodayManilaBusinessDateInput(referenceDate),
    );
  }

  createManilaBusinessDateBoundary(value: string) {
    return getManilaBusinessDateRange(value).from;
  }

  private resolveRawMaterialStockState(snapshot: RawMaterialSummarySnapshot) {
    if (!snapshot.isActive) {
      return 'INACTIVE' as const;
    }

    if (snapshot.usableQuantity.lessThanOrEqualTo(0)) {
      return 'OUT_OF_STOCK' as const;
    }

    if (snapshot.usableQuantity.lessThanOrEqualTo(snapshot.reorderPoint)) {
      return 'LOW_STOCK' as const;
    }

    return 'IN_STOCK' as const;
  }

  private computeVariantInStock(
    variant: VariantWithDependencies,
    summaryMap: Map<string, Prisma.Decimal>,
  ): boolean {
    if (variant.recipeItems.length === 0) {
      return false;
    }

    return variant.recipeItems.every((item) => {
      const available =
        summaryMap.get(item.rawMaterialId) ?? new Prisma.Decimal(0);
      return available.greaterThanOrEqualTo(item.quantity);
    });
  }

  private computeAvailableBaseQty(
    variant: VariantWithDependencies,
    summaryMap: Map<string, Prisma.Decimal>,
  ): number {
    if (variant.recipeItems.length === 0) {
      return 0;
    }

    return variant.recipeItems.reduce<number>((lowest, item) => {
      const available =
        summaryMap.get(item.rawMaterialId) ?? new Prisma.Decimal(0);
      const supportedCount = floorDecimalToInt(
        available.dividedBy(item.quantity),
      );
      return Math.min(lowest, supportedCount);
    }, Number.MAX_SAFE_INTEGER);
  }

  private hasValidRequiredModifierOptions(
    requiredGroups: RequiredModifierGroupAvailability[],
    summaryMap: Map<string, Prisma.Decimal>,
  ): boolean {
    return requiredGroups.every((group) =>
      group.modifierGroup.modifiers.some((modifier) =>
        modifier.recipeAdjustments.every((adjustment) => {
          if (adjustment.quantityDelta.lessThanOrEqualTo(0)) {
            return true;
          }

          const available =
            summaryMap.get(adjustment.rawMaterialId) ?? new Prisma.Decimal(0);
          return available.greaterThanOrEqualTo(adjustment.quantityDelta);
        }),
      ),
    );
  }

  private resolveBlockingReason(
    variant: VariantWithDependencies,
    isInStock: boolean,
    requiredModifierOptionsValid: boolean,
  ): AvailabilityBlockingReason {
    if (variant.recipeItems.length === 0) {
      return AvailabilityBlockingReason.NO_RECIPE;
    }

    if (!variant.product.isEnabled) {
      return AvailabilityBlockingReason.DISABLED_PRODUCT;
    }

    if (!variant.isEnabled) {
      return AvailabilityBlockingReason.DISABLED_VARIANT;
    }

    if (!isInStock) {
      return AvailabilityBlockingReason.INSUFFICIENT_STOCK;
    }

    if (!requiredModifierOptionsValid) {
      return AvailabilityBlockingReason.NO_VALID_REQUIRED_MODIFIER;
    }

    return AvailabilityBlockingReason.NONE;
  }
}
