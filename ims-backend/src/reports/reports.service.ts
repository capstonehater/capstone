import { Injectable } from '@nestjs/common';
import {
  AlertType,
  AlertState,
  InventorySourceType,
  InventoryTransactionType,
  OrderReversalType,
  OrderStatus,
  PaymentMethod,
  Prisma,
  StockRunStatus,
} from '@prisma/client';
import {
  formatManilaBusinessDateInput,
  getManilaWeekStartBusinessDate,
  parseBusinessDateToDateOnlyUtc,
  shiftManilaBusinessDateInput,
  MANILA_TIMEZONE,
} from '../common/utils/manila-business-date.util';
import { sumDecimals, toDecimal } from '../common/utils/decimal.util';
import { InventoryService } from '../inventory/inventory.service';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { PosAuditExceptionsDto } from './dto/pos-audit-exceptions.dto';
import { PosInventoryLinkedDto } from './dto/pos-inventory-linked.dto';
import { PosPeakHoursDto } from './dto/pos-peak-hours.dto';
import { PosProductPerformanceDto } from './dto/pos-product-performance.dto';
import { PosRefundsVoidsDto } from './dto/pos-refunds-voids.dto';
import { PosSalesAnalyticsDto } from './dto/pos-sales-analytics.dto';
import { PosTransactionHistoryDto } from './dto/pos-transaction-history.dto';
import { ReportFiltersDto } from './dto/report-filters.dto';

const ZERO = new Prisma.Decimal(0);
const MANILA_OFFSET = '+08:00';
const PAYMENT_METHODS: PaymentMethod[] = [
  PaymentMethod.CASH,
  PaymentMethod.CARD,
  PaymentMethod.GCASH,
  PaymentMethod.MAYA,
  PaymentMethod.OTHER,
];

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly ordersService: OrdersService,
  ) {}

  async getSalesOverview(filters: ReportFiltersDto) {
    const where = this.buildCompletedOrderWhere(filters);
    const limit = this.normalizeLimit(filters.limit);

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { completedAt: 'desc' },
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
        payments: true,
      },
    });

    const orderCount = orders.length;
    const totalSales = sumDecimals(orders.map((order) => order.totalAmount));
    const totalDiscounts = sumDecimals(
      orders.map((order) => order.discountAmount),
    );
    const totalTax = sumDecimals(orders.map((order) => order.taxAmount));
    const totalCogs = sumDecimals(orders.map((order) => order.totalCogsAmount));
    const grossMargin = totalSales.minus(totalCogs);
    const averageOrderValue =
      orderCount > 0 ? totalSales.dividedBy(orderCount) : ZERO;

    const paymentMap = new Map<string, Prisma.Decimal>();
    const variantMap = new Map<
      string,
      {
        productVariantId: string;
        productName: string;
        variantName: string;
        sku: string;
        quantitySold: number;
        revenue: Prisma.Decimal;
        cogs: Prisma.Decimal;
      }
    >();

    for (const order of orders) {
      for (const payment of order.payments) {
        const current = paymentMap.get(payment.method) ?? ZERO;
        paymentMap.set(payment.method, current.plus(payment.amount));
      }

      for (const item of order.items) {
        const current = variantMap.get(item.productVariantId) ?? {
          productVariantId: item.productVariantId,
          productName: item.productNameSnapshot,
          variantName: item.variantNameSnapshot,
          sku: item.skuSnapshot,
          quantitySold: 0,
          revenue: ZERO,
          cogs: ZERO,
        };

        current.quantitySold += item.quantity;
        current.revenue = current.revenue.plus(item.lineSubtotal);
        current.cogs = current.cogs.plus(item.lineCogsAmount);
        variantMap.set(item.productVariantId, current);
      }
    }

    const topVariants = [...variantMap.values()]
      .map((item) => {
        const grossMarginValue = item.revenue.minus(item.cogs);
        return {
          ...item,
          grossMargin: grossMarginValue,
          marginRate: item.revenue.greaterThan(0)
            ? grossMarginValue.dividedBy(item.revenue).toNumber()
            : 0,
        };
      })
      .sort((left, right) => right.revenue.comparedTo(left.revenue))
      .slice(0, limit);

    return {
      period: {
        from: filters.from ?? null,
        to: filters.to ?? null,
      },
      summary: {
        orderCount,
        totalSales,
        totalDiscounts,
        totalTax,
        totalCogs,
        grossMargin,
        averageOrderValue,
      },
      paymentBreakdown: [...paymentMap.entries()].map(([method, amount]) => ({
        method,
        amount,
      })),
      topVariants,
      recentOrders: orders.slice(0, limit).map((order) => ({
        id: order.id,
        completedAt: order.completedAt,
        totalAmount: order.totalAmount,
        totalCogsAmount: order.totalCogsAmount,
        createdBy: order.createdBy,
      })),
    };
  }

  async getVariantMargin(filters: ReportFiltersDto) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: this.buildCompletedOrderWhere(filters),
      },
      include: {
        order: {
          select: {
            completedAt: true,
          },
        },
      },
    });

    const variantMap = new Map<
      string,
      {
        productVariantId: string;
        productName: string;
        variantName: string;
        sku: string;
        quantitySold: number;
        revenue: Prisma.Decimal;
        cogs: Prisma.Decimal;
      }
    >();

    for (const item of items) {
      const current = variantMap.get(item.productVariantId) ?? {
        productVariantId: item.productVariantId,
        productName: item.productNameSnapshot,
        variantName: item.variantNameSnapshot,
        sku: item.skuSnapshot,
        quantitySold: 0,
        revenue: ZERO,
        cogs: ZERO,
      };

      current.quantitySold += item.quantity;
      current.revenue = current.revenue.plus(item.lineSubtotal);
      current.cogs = current.cogs.plus(item.lineCogsAmount);
      variantMap.set(item.productVariantId, current);
    }

    const variants = [...variantMap.values()]
      .map((variant) => {
        const grossMargin = variant.revenue.minus(variant.cogs);
        return {
          ...variant,
          grossMargin,
          marginRate: variant.revenue.greaterThan(0)
            ? grossMargin.dividedBy(variant.revenue).toNumber()
            : 0,
        };
      })
      .sort((left, right) => right.grossMargin.comparedTo(left.grossMargin));

    return {
      period: {
        from: filters.from ?? null,
        to: filters.to ?? null,
      },
      totals: {
        quantitySold: variants.reduce(
          (sum, item) => sum + item.quantitySold,
          0,
        ),
        revenue: sumDecimals(variants.map((item) => item.revenue)),
        cogs: sumDecimals(variants.map((item) => item.cogs)),
        grossMargin: sumDecimals(variants.map((item) => item.grossMargin)),
      },
      variants: variants.slice(0, this.normalizeLimit(filters.limit) * 3),
    };
  }

  async getWasteSummary(filters: ReportFiltersDto) {
    const limit = this.normalizeLimit(filters.limit);
    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: {
        type: InventoryTransactionType.WASTE,
        occurredAt: this.buildDateRange(filters),
      },
      orderBy: { occurredAt: 'desc' },
      include: {
        actorUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        lines: {
          include: {
            rawMaterial: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
      },
    });

    const reasonMap = new Map<
      string,
      {
        reasonCode: string;
        quantity: Prisma.Decimal;
        cost: Prisma.Decimal;
        eventCount: number;
      }
    >();
    const materialMap = new Map<
      string,
      {
        rawMaterialId: string;
        name: string;
        sku: string;
        quantity: Prisma.Decimal;
        cost: Prisma.Decimal;
        eventCount: number;
      }
    >();

    for (const transaction of transactions) {
      const reasonCode = transaction.reasonCode ?? 'UNSPECIFIED';
      const quantity = sumDecimals(
        transaction.lines.map((line) => toDecimal(line.quantityDelta).abs()),
      );
      const cost = sumDecimals(
        transaction.lines.map((line) => toDecimal(line.totalCostDelta).abs()),
      );

      const currentReason = reasonMap.get(reasonCode) ?? {
        reasonCode,
        quantity: ZERO,
        cost: ZERO,
        eventCount: 0,
      };
      currentReason.quantity = currentReason.quantity.plus(quantity);
      currentReason.cost = currentReason.cost.plus(cost);
      currentReason.eventCount += 1;
      reasonMap.set(reasonCode, currentReason);

      for (const line of transaction.lines) {
        const material = materialMap.get(line.rawMaterialId) ?? {
          rawMaterialId: line.rawMaterialId,
          name: line.rawMaterial.name,
          sku: line.rawMaterial.sku,
          quantity: ZERO,
          cost: ZERO,
          eventCount: 0,
        };
        material.quantity = material.quantity.plus(
          toDecimal(line.quantityDelta).abs(),
        );
        material.cost = material.cost.plus(
          toDecimal(line.totalCostDelta).abs(),
        );
        material.eventCount += 1;
        materialMap.set(line.rawMaterialId, material);
      }
    }

    return {
      period: {
        from: filters.from ?? null,
        to: filters.to ?? null,
      },
      totals: {
        eventCount: transactions.length,
        quantity: sumDecimals(
          [...reasonMap.values()].map((item) => item.quantity),
        ),
        cost: sumDecimals([...reasonMap.values()].map((item) => item.cost)),
      },
      byReason: [...reasonMap.values()]
        .sort((left, right) => right.cost.comparedTo(left.cost))
        .slice(0, limit),
      byMaterial: [...materialMap.values()]
        .sort((left, right) => right.cost.comparedTo(left.cost))
        .slice(0, limit),
      recentWaste: transactions.slice(0, limit).map((transaction) => ({
        id: transaction.id,
        occurredAt: transaction.occurredAt,
        reasonCode: transaction.reasonCode,
        note: transaction.note,
        actorUser: transaction.actorUser,
        quantity: sumDecimals(
          transaction.lines.map((line) => toDecimal(line.quantityDelta).abs()),
        ),
        cost: sumDecimals(
          transaction.lines.map((line) => toDecimal(line.totalCostDelta).abs()),
        ),
      })),
    };
  }

  async getStockRunSpend(filters: ReportFiltersDto) {
    const limit = this.normalizeLimit(filters.limit);
    const stockRuns = await this.prisma.stockRun.findMany({
      where: {
        status: StockRunStatus.POSTED,
        postedAt: this.buildDateRange(filters),
      },
      orderBy: { postedAt: 'desc' },
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
            supplier: true,
            rawMaterial: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
      },
    });

    const bySupplier = new Map<
      string,
      {
        supplierId: string | null;
        supplierName: string;
        totalSpend: Prisma.Decimal;
        lineCount: number;
      }
    >();

    for (const run of stockRuns) {
      for (const item of run.items) {
        const key = item.supplierId ?? 'NO_SUPPLIER';
        const current = bySupplier.get(key) ?? {
          supplierId: item.supplierId ?? null,
          supplierName: item.supplier?.name ?? 'No supplier',
          totalSpend: ZERO,
          lineCount: 0,
        };
        current.totalSpend = current.totalSpend.plus(
          item.quantity.mul(item.costPerUnit),
        );
        current.lineCount += 1;
        bySupplier.set(key, current);
      }
    }

    const totalSpend = sumDecimals(stockRuns.map((run) => run.totalCost));
    const runCount = stockRuns.length;

    return {
      period: {
        from: filters.from ?? null,
        to: filters.to ?? null,
      },
      totals: {
        runCount,
        totalSpend,
        averageRunCost: runCount > 0 ? totalSpend.dividedBy(runCount) : ZERO,
      },
      bySupplier: [...bySupplier.values()]
        .sort((left, right) => right.totalSpend.comparedTo(left.totalSpend))
        .slice(0, limit),
      recentRuns: stockRuns.slice(0, limit).map((run) => ({
        id: run.id,
        name: run.name,
        postedAt: run.postedAt,
        totalCost: run.totalCost,
        itemCount: run.items.length,
        createdBy: run.createdBy,
      })),
    };
  }

  async getInventoryHealth(filters: ReportFiltersDto) {
    const limit = this.normalizeLimit(filters.limit);
    const summaries = await this.inventoryService.listInventorySummary({});
    const totalInventoryValue = sumDecimals(
      summaries.map((summary) => summary.inventoryValue),
    );
    const activeBatchCount = summaries.reduce(
      (sum, summary) => sum + summary.summary.activeBatchCount,
      0,
    );
    const nextTwoWeeks = new Date();
    nextTwoWeeks.setDate(nextTwoWeeks.getDate() + 14);

    const nearExpiryBatches = await this.prisma.stockBatch.findMany({
      where: {
        remainingQuantity: {
          gt: ZERO,
        },
        expirationDate: {
          not: null,
          lte: nextTwoWeeks,
        },
      },
      orderBy: [{ expirationDate: 'asc' }, { remainingQuantity: 'desc' }],
      include: {
        rawMaterial: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        supplier: true,
      },
      take: limit,
    });

    return {
      summary: {
        totalMaterials: summaries.length,
        inStockCount: summaries.filter((item) => item.status === 'IN_STOCK')
          .length,
        lowStockCount: summaries.filter((item) => item.status === 'LOW_STOCK')
          .length,
        outOfStockCount: summaries.filter(
          (item) => item.status === 'OUT_OF_STOCK',
        ).length,
        inactiveCount: summaries.filter((item) => item.status === 'INACTIVE')
          .length,
        totalInventoryValue,
        activeBatchCount,
        nearExpiryBatchCount: nearExpiryBatches.length,
      },
      highValueMaterials: [...summaries]
        .sort((left, right) =>
          toDecimal(right.inventoryValue).comparedTo(left.inventoryValue),
        )
        .slice(0, limit),
      lowStockMaterials: summaries
        .filter((item) => item.status === 'LOW_STOCK')
        .slice(0, limit),
      outOfStockMaterials: summaries
        .filter((item) => item.status === 'OUT_OF_STOCK')
        .slice(0, limit),
      nearExpiryBatches: nearExpiryBatches.map((batch) => ({
        id: batch.id,
        expirationDate: batch.expirationDate,
        remainingQuantity: batch.remainingQuantity,
        costPerUnit: batch.costPerUnit,
        rawMaterial: batch.rawMaterial,
        supplier: batch.supplier,
      })),
    };
  }

  async getInventoryKpiSummary(filters: ReportFiltersDto) {
    const currentRange = this.resolveDateRange(filters);
    const fromDay = this.formatManilaDateInput(currentRange.from);
    const toDay = this.formatManilaDateInput(currentRange.to);
    const snapshotRange = {
      from: this.parseManilaDateInput(fromDay),
      to: this.parseManilaDateInput(toDay),
    };
    const expectedSnapshotDayCount =
      Math.floor(
        (snapshotRange.to.getTime() - snapshotRange.from.getTime()) /
          (24 * 60 * 60 * 1000),
      ) + 1;

    const [orderTotals, inventoryUsageLines, inventorySnapshotTotals] =
      await Promise.all([
        this.prisma.order.aggregate({
          where: this.buildCompletedOrderWhereForRange(currentRange),
          _sum: {
            totalAmount: true,
            totalCogsAmount: true,
          },
        }),
        this.prisma.inventoryTransactionLine.findMany({
          where: {
            inventoryTransaction: {
              type: {
                in: [
                  InventoryTransactionType.CHECKOUT,
                  InventoryTransactionType.WASTE,
                ],
              },
              occurredAt: {
                gte: currentRange.from,
                lte: currentRange.to,
              },
            },
          },
          select: {
            totalCostDelta: true,
            inventoryTransaction: {
              select: {
                type: true,
              },
            },
          },
        }),
        this.prisma.inventoryDailySnapshot.groupBy({
          by: ['snapshotDate'],
          where: {
            snapshotDate: {
              gte: snapshotRange.from,
              lte: snapshotRange.to,
            },
          },
          _sum: {
            inventoryValue: true,
          },
          orderBy: {
            snapshotDate: 'asc',
          },
        }),
      ]);

    let checkoutCost = ZERO;
    let wasteCost = ZERO;

    for (const line of inventoryUsageLines) {
      const lineCost = toDecimal(line.totalCostDelta).abs();

      if (
        line.inventoryTransaction.type === InventoryTransactionType.CHECKOUT
      ) {
        checkoutCost = checkoutCost.plus(lineCost);
      } else if (
        line.inventoryTransaction.type === InventoryTransactionType.WASTE
      ) {
        wasteCost = wasteCost.plus(lineCost);
      }
    }

    const totalAmount = orderTotals._sum.totalAmount ?? ZERO;
    const totalCogsAmount = orderTotals._sum.totalCogsAmount ?? ZERO;
    const totalInventoryUsedCost = checkoutCost.plus(wasteCost);
    const snapshotTotals = inventorySnapshotTotals.map(
      (snapshot) => snapshot._sum.inventoryValue ?? ZERO,
    );
    const averageInventory =
      inventorySnapshotTotals.length > 0 &&
      inventorySnapshotTotals.length === expectedSnapshotDayCount
        ? sumDecimals(snapshotTotals).dividedBy(inventorySnapshotTotals.length)
        : null;

    return {
      period: {
        from: currentRange.from.toISOString(),
        to: currentRange.to.toISOString(),
      },
      summary: {
        foodCostPercentage: totalAmount.greaterThan(0)
          ? totalCogsAmount.dividedBy(totalAmount).mul(100)
          : null,
        wastePercentage: totalInventoryUsedCost.greaterThan(0)
          ? wasteCost.dividedBy(totalInventoryUsedCost).mul(100)
          : null,
        inventoryTurnoverRate:
          averageInventory && averageInventory.greaterThan(0)
            ? totalCogsAmount.dividedBy(averageInventory)
            : null,
      },
      totals: {
        revenue: totalAmount,
        cogs: totalCogsAmount,
        checkoutCost,
        wasteCost,
        totalInventoryUsedCost,
        averageInventory,
        snapshotDayCount: inventorySnapshotTotals.length,
        expectedSnapshotDayCount,
      },
    };
  }

  async getInventoryAvailabilityRisk(filters: ReportFiltersDto) {
    const currentRange = this.resolveDateRange(filters);
    const rangeDurationMs = this.getRangeLengthMs(currentRange);

    const [activeRawMaterials, activeVariants, topSellingOrderItems] =
      await Promise.all([
        this.prisma.rawMaterial.findMany({
          where: {
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true,
          },
          orderBy: {
            name: 'asc',
          },
        }),
        this.prisma.productVariant.findMany({
          where: {
            isEnabled: true,
            product: {
              isEnabled: true,
            },
          },
          select: {
            id: true,
            name: true,
            sku: true,
            product: {
              select: {
                id: true,
                name: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: [
            {
              product: {
                name: 'asc',
              },
            },
            {
              name: 'asc',
            },
          ],
        }),
        this.prisma.orderItem.findMany({
          where: {
            order: {
              status: OrderStatus.COMPLETED,
              completedAt: {
                gte: currentRange.from,
                lte: currentRange.to,
              },
            },
          },
          select: {
            productVariantId: true,
            quantity: true,
            lineSubtotal: true,
            productVariant: {
              select: {
                id: true,
                name: true,
                sku: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                    category: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        }),
      ]);

    const rawMaterialIds = activeRawMaterials.map((material) => material.id);
    const topSellerMap = new Map<
      string,
      {
        productVariant: NonNullable<
          (typeof topSellingOrderItems)[number]['productVariant']
        >;
        quantitySold: number;
        revenue: Prisma.Decimal;
      }
    >();

    for (const orderItem of topSellingOrderItems) {
      if (!orderItem.productVariant) {
        continue;
      }

      const current = topSellerMap.get(orderItem.productVariantId) ?? {
        productVariant: orderItem.productVariant,
        quantitySold: 0,
        revenue: ZERO,
      };

      current.quantitySold += orderItem.quantity;
      current.revenue = current.revenue.plus(orderItem.lineSubtotal);
      topSellerMap.set(orderItem.productVariantId, current);
    }

    const topSellingVariants = [...topSellerMap.values()]
      .sort((left, right) => {
        if (right.quantitySold !== left.quantitySold) {
          return right.quantitySold - left.quantitySold;
        }

        return right.revenue.comparedTo(left.revenue);
      })
      .slice(0, 5);

    const variantIdsForHistory = [
      ...new Set([
        ...activeVariants.map((variant) => variant.id),
        ...topSellingVariants.map((variant) => variant.productVariant.id),
      ]),
    ];

    const [stockoutEvents, variantEvents] = await Promise.all([
      rawMaterialIds.length > 0
        ? this.prisma.stockoutEvent.findMany({
            where: {
              rawMaterialId: {
                in: rawMaterialIds,
              },
              startedAt: {
                lte: currentRange.to,
              },
              OR: [
                {
                  endedAt: null,
                },
                {
                  endedAt: {
                    gte: currentRange.from,
                  },
                },
              ],
            },
            select: {
              rawMaterialId: true,
              startedAt: true,
              endedAt: true,
              blockingContext: true,
            },
            orderBy: [{ rawMaterialId: 'asc' }, { startedAt: 'asc' }],
          })
        : [],
      variantIdsForHistory.length > 0
        ? this.prisma.variantAvailabilityEvent.findMany({
            where: {
              productVariantId: {
                in: variantIdsForHistory,
              },
              occurredAt: {
                lte: currentRange.to,
              },
            },
            select: {
              productVariantId: true,
              occurredAt: true,
              newIsSellable: true,
            },
            orderBy: [{ productVariantId: 'asc' }, { occurredAt: 'asc' }],
          })
        : [],
    ]);

    const stockoutEventsByMaterialId = new Map<
      string,
      Array<{
        startedAt: Date;
        endedAt: Date | null;
        blockingContext: string | null;
      }>
    >();
    for (const event of stockoutEvents) {
      if (!event.rawMaterialId) {
        continue;
      }

      const rows = stockoutEventsByMaterialId.get(event.rawMaterialId) ?? [];
      rows.push({
        startedAt: event.startedAt,
        endedAt: event.endedAt,
        blockingContext: event.blockingContext,
      });
      stockoutEventsByMaterialId.set(event.rawMaterialId, rows);
    }

    const variantEventsByVariantId = new Map<
      string,
      Array<{
        occurredAt: Date;
        newIsSellable: boolean;
      }>
    >();
    for (const event of variantEvents) {
      const rows = variantEventsByVariantId.get(event.productVariantId) ?? [];
      rows.push({
        occurredAt: event.occurredAt,
        newIsSellable: event.newIsSellable,
      });
      variantEventsByVariantId.set(event.productVariantId, rows);
    }

    const stockoutMaterialRows = activeRawMaterials
      .map((rawMaterial) => {
        const eventsForMaterial =
          stockoutEventsByMaterialId.get(rawMaterial.id) ?? [];
        const stockoutDurationMs = eventsForMaterial.reduce(
          (sum, event) =>
            sum +
            this.getOverlappingRangeDurationMs(
              currentRange,
              event.startedAt,
              event.endedAt,
            ),
          0,
        );

        return {
          rawMaterial,
          stockoutDurationMs,
          overlappingStockoutEventCount: eventsForMaterial.length,
          currentlyOutOfStock: eventsForMaterial.some(
            (event) => event.endedAt === null,
          ),
          blockingContexts: [
            ...new Set(
              eventsForMaterial
                .map((event) => event.blockingContext)
                .filter((value): value is string => Boolean(value)),
            ),
          ],
        };
      })
      .filter((row) => row.stockoutDurationMs > 0)
      .sort((left, right) => {
        if (right.stockoutDurationMs !== left.stockoutDurationMs) {
          return right.stockoutDurationMs - left.stockoutDurationMs;
        }

        return (
          right.overlappingStockoutEventCount -
          left.overlappingStockoutEventCount
        );
      });

    const totalStockoutDurationMs = stockoutMaterialRows.reduce(
      (sum, row) => sum + row.stockoutDurationMs,
      0,
    );

    const variantAvailabilityMap = new Map<
      string,
      {
        trackedFromRangeStart: boolean;
        trackedDurationMs: number;
        sellableDurationMs: number;
        downtimeDurationMs: number;
        eventCount: number;
      }
    >();

    for (const variantId of variantIdsForHistory) {
      variantAvailabilityMap.set(
        variantId,
        this.calculateVariantAvailabilityMetrics(
          variantEventsByVariantId.get(variantId) ?? [],
          currentRange,
        ),
      );
    }

    const menuAvailabilityRows = activeVariants.map((variant) => ({
      variant,
      metrics:
        variantAvailabilityMap.get(variant.id) ??
        this.calculateVariantAvailabilityMetrics([], currentRange),
    }));

    const trackedVariants = menuAvailabilityRows.filter(
      (row) =>
        row.metrics.trackedFromRangeStart && row.metrics.trackedDurationMs > 0,
    );
    const totalTrackedVariantDurationMs = trackedVariants.reduce(
      (sum, row) => sum + row.metrics.trackedDurationMs,
      0,
    );
    const totalTrackedSellableDurationMs = trackedVariants.reduce(
      (sum, row) => sum + row.metrics.sellableDurationMs,
      0,
    );

    const topSellingVariantRows = topSellingVariants.map((row) => {
      const metrics =
        variantAvailabilityMap.get(row.productVariant.id) ??
        this.calculateVariantAvailabilityMetrics([], currentRange);

      return {
        productVariant: row.productVariant,
        quantitySold: row.quantitySold,
        revenue: row.revenue,
        availabilityPercentage:
          metrics.trackedFromRangeStart && metrics.trackedDurationMs > 0
            ? new Prisma.Decimal(metrics.sellableDurationMs)
                .dividedBy(metrics.trackedDurationMs)
                .mul(100)
            : null,
        sellableDurationHours:
          metrics.trackedFromRangeStart && metrics.trackedDurationMs > 0
            ? this.convertMillisecondsToHours(metrics.sellableDurationMs)
            : null,
        downtimeDurationHours:
          metrics.trackedFromRangeStart && metrics.trackedDurationMs > 0
            ? this.convertMillisecondsToHours(metrics.downtimeDurationMs)
            : null,
        eventCount: metrics.eventCount,
        trackedFromRangeStart: metrics.trackedFromRangeStart,
        trackedDurationMs: metrics.trackedDurationMs,
        sellableDurationMs: metrics.sellableDurationMs,
      };
    });

    const trackedTopSellingVariants = topSellingVariantRows.filter(
      (row) => row.trackedFromRangeStart && row.trackedDurationMs > 0,
    );
    const totalTrackedTopSellingDurationMs = trackedTopSellingVariants.reduce(
      (sum, row) => sum + row.trackedDurationMs,
      0,
    );
    const totalTrackedTopSellingSellableMs = trackedTopSellingVariants.reduce(
      (sum, row) => sum + row.sellableDurationMs,
      0,
    );

    return {
      period: {
        from: currentRange.from.toISOString(),
        to: currentRange.to.toISOString(),
      },
      definitions: {
        stockoutRate:
          'Stockout Rate is the percentage of total tracked raw-material time spent out of stock during the selected Manila-bounded period.',
        menuItemAvailabilityRate:
          'Menu Item Availability Rate is total sellable time divided by total tracked time across active menu variants with availability history at or before the selected period start.',
        topSellingItemAvailability:
          'Top-Selling Item Availability is the average tracked availability across the selected period top-selling variants, excluding variants that do not yet have a baseline event before the range start.',
      },
      summary: {
        stockoutRatePercentage:
          activeRawMaterials.length > 0
            ? new Prisma.Decimal(totalStockoutDurationMs)
                .dividedBy(activeRawMaterials.length * rangeDurationMs)
                .mul(100)
            : null,
        materialsWithStockoutCount: stockoutMaterialRows.length,
        trackedMaterialCount: activeRawMaterials.length,
        overlappingStockoutEventCount: stockoutEvents.length,
        menuItemAvailabilityRate:
          totalTrackedVariantDurationMs > 0
            ? new Prisma.Decimal(totalTrackedSellableDurationMs)
                .dividedBy(totalTrackedVariantDurationMs)
                .mul(100)
            : null,
        trackedVariantCount: trackedVariants.length,
        untrackedVariantCount: activeVariants.length - trackedVariants.length,
        topSellingItemAvailabilityPercentage:
          totalTrackedTopSellingDurationMs > 0
            ? new Prisma.Decimal(totalTrackedTopSellingSellableMs)
                .dividedBy(totalTrackedTopSellingDurationMs)
                .mul(100)
            : null,
        trackedTopSellingVariantCount: trackedTopSellingVariants.length,
        totalTopSellingVariantCount: topSellingVariantRows.length,
      },
      stockoutMaterials: stockoutMaterialRows.map((row) => ({
        rawMaterial: row.rawMaterial,
        stockoutDurationHours: this.convertMillisecondsToHours(
          row.stockoutDurationMs,
        ),
        stockoutRatePercentage: new Prisma.Decimal(row.stockoutDurationMs)
          .dividedBy(rangeDurationMs)
          .mul(100),
        overlappingStockoutEventCount: row.overlappingStockoutEventCount,
        currentlyOutOfStock: row.currentlyOutOfStock,
        blockingContexts: row.blockingContexts,
      })),
      topSellingVariants: topSellingVariantRows.map((row) => ({
        productVariant: row.productVariant,
        quantitySold: row.quantitySold,
        revenue: row.revenue,
        availabilityPercentage: row.availabilityPercentage,
        sellableDurationHours: row.sellableDurationHours,
        downtimeDurationHours: row.downtimeDurationHours,
        eventCount: row.eventCount,
        trackedFromRangeStart: row.trackedFromRangeStart,
      })),
    };
  }

  async getPosDashboard(filters: ReportFiltersDto) {
    const limit = this.normalizeLimit(filters.limit);
    const currentRange = this.resolveDateRange(filters);
    const previousRange = this.shiftRange(
      currentRange,
      -this.getRangeLengthMs(currentRange),
    );
    const samePeriodLastWeek = this.shiftRange(
      currentRange,
      -7 * 24 * 60 * 60 * 1000,
    );

    const [currentOrders, recentOrders, previousOrders, sameWeekOrders] =
      await Promise.all([
        this.prisma.order.findMany({
          where: {
            status: OrderStatus.COMPLETED,
            completedAt: {
              gte: currentRange.from,
              lte: currentRange.to,
            },
          },
          orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
          select: {
            subtotalAmount: true,
            discountAmount: true,
            totalAmount: true,
            completedAt: true,
            items: {
              select: {
                productNameSnapshot: true,
                quantity: true,
                lineSubtotal: true,
              },
            },
          },
        }),
        this.prisma.order.findMany({
          where: {
            status: OrderStatus.COMPLETED,
            completedAt: {
              gte: currentRange.from,
              lte: currentRange.to,
            },
          },
          orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
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
            payments: true,
          },
          take: Math.max(limit, 10),
        }),
        this.prisma.order.findMany({
          where: {
            status: OrderStatus.COMPLETED,
            completedAt: {
              gte: previousRange.from,
              lte: previousRange.to,
            },
          },
          select: {
            subtotalAmount: true,
            discountAmount: true,
            totalAmount: true,
          },
        }),
        this.prisma.order.findMany({
          where: {
            status: OrderStatus.COMPLETED,
            completedAt: {
              gte: samePeriodLastWeek.from,
              lte: samePeriodLastWeek.to,
            },
          },
          select: {
            subtotalAmount: true,
            discountAmount: true,
            totalAmount: true,
          },
        }),
      ]);

    const currentSummary = this.summarizeOrders(currentOrders);
    const previousSummary = this.summarizeOrders(previousOrders);
    const sameWeekSummary = this.summarizeOrders(sameWeekOrders);
    const topProduct = this.getTopProduct(currentOrders);
    const trend = this.buildDashboardTrend(currentRange, currentOrders);

    return {
      period: {
        from: currentRange.from.toISOString(),
        to: currentRange.to.toISOString(),
      },
      summary: currentSummary,
      comparisons: {
        previousPeriod: {
          from: previousRange.from.toISOString(),
          to: previousRange.to.toISOString(),
          netSales: previousSummary.netSales,
          growthRate: this.calculateGrowthRate(
            currentSummary.netSales,
            previousSummary.netSales,
          ),
        },
        samePeriodLastWeek: {
          from: samePeriodLastWeek.from.toISOString(),
          to: samePeriodLastWeek.to.toISOString(),
          netSales: sameWeekSummary.netSales,
          growthRate: this.calculateGrowthRate(
            currentSummary.netSales,
            sameWeekSummary.netSales,
          ),
        },
      },
      topProduct,
      trend,
      recentOrders: recentOrders.slice(0, limit).map((order) => ({
        id: order.id,
        displayOrderNumber: this.ordersService.getDisplayOrderNumber(order.id),
        completedAt: order.completedAt,
        totalAmount: order.totalAmount,
        subtotalAmount: order.subtotalAmount,
        discountAmount: order.discountAmount,
        taxAmount: order.taxAmount,
        createdBy: order.createdBy,
        itemCount: order.items.length,
        quantitySold: order.items.reduce((sum, item) => sum + item.quantity, 0),
        paymentMethods: [
          ...new Set(order.payments.map((payment) => payment.method)),
        ],
      })),
    };
  }

  async getPosTransactionHistory(filters: PosTransactionHistoryDto) {
    const page = Math.max(filters.page ?? 1, 1);
    const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 100);
    const { orders, pagination } = await this.ordersService.listOrdersPaginated(
      filters,
      {
        page,
        pageSize,
      },
    );

    return {
      period: {
        from: filters.from ?? null,
        to: filters.to ?? null,
      },
      filters: {
        search: filters.search ?? null,
        staffSearch: filters.staffSearch ?? null,
        paymentMethod: filters.paymentMethod ?? null,
        status: filters.status ?? null,
      },
      orders,
      pagination,
    };
  }

  async getPosSalesAnalytics(filters: PosSalesAnalyticsDto) {
    const groupBy = filters.groupBy ?? 'daily';
    const currentRange = this.resolveDateRange(filters);
    const previousRange = this.shiftRange(
      currentRange,
      -this.getRangeLengthMs(currentRange),
    );

    const [currentOrders, previousOrders, currentRefunds, previousRefunds] =
      await Promise.all([
        this.prisma.order.findMany({
          where: this.buildCompletedOrderWhereForRange(currentRange, {
            staffSearch: filters.staffSearch,
            paymentMethod: filters.paymentMethod,
          }),
          select: {
            id: true,
            subtotalAmount: true,
            discountAmount: true,
            totalAmount: true,
            completedAt: true,
          },
          orderBy: [{ completedAt: 'asc' }, { id: 'asc' }],
        }),
        this.prisma.order.findMany({
          where: this.buildCompletedOrderWhereForRange(previousRange, {
            staffSearch: filters.staffSearch,
            paymentMethod: filters.paymentMethod,
          }),
          select: {
            id: true,
            subtotalAmount: true,
            discountAmount: true,
            totalAmount: true,
            completedAt: true,
          },
        }),
        this.prisma.orderReversal.findMany({
          where: this.buildRefundWhereForRange(currentRange, {
            staffSearch: filters.staffSearch,
            paymentMethod: filters.paymentMethod,
          }),
          select: {
            id: true,
            amount: true,
            occurredAt: true,
          },
          orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
        }),
        this.prisma.orderReversal.findMany({
          where: this.buildRefundWhereForRange(previousRange, {
            staffSearch: filters.staffSearch,
            paymentMethod: filters.paymentMethod,
          }),
          select: {
            id: true,
            amount: true,
            occurredAt: true,
          },
        }),
      ]);

    const refundTotal = sumDecimals(
      currentRefunds.map((refund) => refund.amount),
    );
    const previousRefundTotal = sumDecimals(
      previousRefunds.map((refund) => refund.amount),
    );
    const summary = this.summarizeSalesAnalytics(currentOrders, refundTotal);
    const previousPeriod = this.summarizeSalesAnalytics(
      previousOrders,
      previousRefundTotal,
    );

    return {
      period: {
        from: currentRange.from.toISOString(),
        to: currentRange.to.toISOString(),
      },
      filters: {
        groupBy,
        staffSearch: filters.staffSearch ?? null,
        paymentMethod: filters.paymentMethod ?? null,
      },
      summary,
      comparison: {
        previousPeriod: {
          from: previousRange.from.toISOString(),
          to: previousRange.to.toISOString(),
          ...previousPeriod,
          growthRate: this.calculateGrowthRate(
            summary.netSales,
            previousPeriod.netSales,
          ),
        },
      },
      groups: this.groupSalesAnalytics(groupBy, currentOrders, currentRefunds),
    };
  }

  async getPosPaymentReports(filters: ReportFiltersDto) {
    const currentRange = this.resolveDateRange(filters);
    const limit = this.normalizeLimit(filters.limit);
    const orders = await this.prisma.order.findMany({
      where: this.buildCompletedOrderWhereForRange(currentRange),
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        payments: {
          select: {
            id: true,
            method: true,
            amount: true,
            reference: true,
          },
        },
      },
    });

    const breakdownMap = new Map<
      PaymentMethod,
      {
        method: PaymentMethod;
        amount: Prisma.Decimal;
        paymentCount: number;
        orderIds: Set<string>;
      }
    >();

    for (const method of PAYMENT_METHODS) {
      breakdownMap.set(method, {
        method,
        amount: ZERO,
        paymentCount: 0,
        orderIds: new Set<string>(),
      });
    }

    let splitPaymentTransactionCount = 0;
    let splitPaymentCollected = ZERO;

    for (const order of orders) {
      if (order.payments.length > 1) {
        splitPaymentTransactionCount += 1;
        splitPaymentCollected = splitPaymentCollected.plus(order.totalAmount);
      }

      for (const payment of order.payments) {
        const current = breakdownMap.get(payment.method)!;
        current.amount = current.amount.plus(payment.amount);
        current.paymentCount += 1;
        current.orderIds.add(order.id);
      }
    }

    const totalCollected = sumDecimals(
      orders.map((order) => order.totalAmount),
    );
    const breakdown = PAYMENT_METHODS.map((method) => {
      const item = breakdownMap.get(method)!;
      return {
        method,
        amount: item.amount,
        paymentCount: item.paymentCount,
        orderCount: item.orderIds.size,
        shareOfCollected: totalCollected.greaterThan(0)
          ? item.amount.dividedBy(totalCollected).toNumber()
          : null,
      };
    });

    return {
      period: {
        from: currentRange.from.toISOString(),
        to: currentRange.to.toISOString(),
      },
      summary: {
        completedTransactionCount: orders.length,
        totalCollected,
        cashTotal: breakdownMap.get(PaymentMethod.CASH)?.amount ?? ZERO,
        cardTotal: breakdownMap.get(PaymentMethod.CARD)?.amount ?? ZERO,
        ewalletTotal: (
          breakdownMap.get(PaymentMethod.GCASH)?.amount ?? ZERO
        ).plus(breakdownMap.get(PaymentMethod.MAYA)?.amount ?? ZERO),
        otherTotal: breakdownMap.get(PaymentMethod.OTHER)?.amount ?? ZERO,
        splitPaymentTransactionCount,
        splitPaymentCollected,
      },
      breakdown,
      splitPaymentOrders: orders
        .filter((order) => order.payments.length > 1)
        .slice(0, limit)
        .map((order) => ({
          id: order.id,
          completedAt: order.completedAt,
          totalAmount: order.totalAmount,
          createdBy: order.createdBy,
          payments: order.payments,
        })),
    };
  }

  async getPosRefundsVoids(filters: PosRefundsVoidsDto) {
    const currentRange = this.resolveDateRange(filters);
    const staffSearch = filters.staffSearch?.trim();
    const reversals = await this.prisma.orderReversal.findMany({
      where: {
        occurredAt: {
          gte: currentRange.from,
          lte: currentRange.to,
        },
        order: staffSearch
          ? {
              OR: [
                {
                  createdBy: {
                    email: {
                      contains: staffSearch,
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  createdBy: {
                    firstName: {
                      contains: staffSearch,
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  createdBy: {
                    lastName: {
                      contains: staffSearch,
                      mode: 'insensitive',
                    },
                  },
                },
              ],
            }
          : undefined,
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      include: {
        actorUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        order: {
          select: {
            id: true,
            status: true,
            createdBy: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    const requestedByUserIds = [
      ...new Set(
        reversals
          .map((reversal) =>
            this.getJsonString(reversal.metadata, 'requestedByUserId'),
          )
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const requestedByUsers =
      requestedByUserIds.length > 0
        ? await this.prisma.user.findMany({
            where: {
              id: {
                in: requestedByUserIds,
              },
            },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          })
        : [];
    const requestedByUserMap = new Map(
      requestedByUsers.map((user) => [user.id, user]),
    );

    const refunds = reversals.filter(
      (reversal) => reversal.type === OrderReversalType.REFUND,
    );
    const voids = reversals.filter(
      (reversal) => reversal.type === OrderReversalType.VOID,
    );

    const byReasonMap = new Map<
      string,
      {
        type: OrderReversalType;
        reasonCode: string;
        count: number;
        amount: Prisma.Decimal;
      }
    >();
    const byStaffMap = new Map<
      string,
      {
        responsibleStaff: {
          id: string;
          email: string;
          firstName: string;
          lastName: string;
        };
        reversalCount: number;
        refundCount: number;
        voidCount: number;
        refundedAmount: Prisma.Decimal;
        voidedAmount: Prisma.Decimal;
      }
    >();

    for (const reversal of reversals) {
      const reasonKey = `${reversal.type}:${reversal.reasonCode}`;
      const reasonItem = byReasonMap.get(reasonKey) ?? {
        type: reversal.type,
        reasonCode: reversal.reasonCode,
        count: 0,
        amount: ZERO,
      };
      reasonItem.count += 1;
      reasonItem.amount = reasonItem.amount.plus(reversal.amount);
      byReasonMap.set(reasonKey, reasonItem);

      const staffItem = byStaffMap.get(reversal.order.createdBy.id) ?? {
        responsibleStaff: reversal.order.createdBy,
        reversalCount: 0,
        refundCount: 0,
        voidCount: 0,
        refundedAmount: ZERO,
        voidedAmount: ZERO,
      };
      staffItem.reversalCount += 1;
      if (reversal.type === OrderReversalType.REFUND) {
        staffItem.refundCount += 1;
        staffItem.refundedAmount = staffItem.refundedAmount.plus(
          reversal.amount,
        );
      } else {
        staffItem.voidCount += 1;
        staffItem.voidedAmount = staffItem.voidedAmount.plus(reversal.amount);
      }
      byStaffMap.set(reversal.order.createdBy.id, staffItem);
    }

    return {
      period: {
        from: currentRange.from.toISOString(),
        to: currentRange.to.toISOString(),
      },
      filters: {
        staffSearch: filters.staffSearch ?? null,
      },
      summary: {
        refundCount: refunds.length,
        refundedAmount: sumDecimals(refunds.map((item) => item.amount)),
        voidCount: voids.length,
        voidedAmount: sumDecimals(voids.map((item) => item.amount)),
        totalReversalCount: reversals.length,
      },
      byReason: [...byReasonMap.values()].sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }

        return right.amount.comparedTo(left.amount);
      }),
      byStaff: [...byStaffMap.values()].sort((left, right) => {
        if (right.reversalCount !== left.reversalCount) {
          return right.reversalCount - left.reversalCount;
        }

        return right.refundedAmount
          .plus(right.voidedAmount)
          .comparedTo(left.refundedAmount.plus(left.voidedAmount));
      }),
      reversals: reversals.map((reversal) => {
        const requestedByUserId = this.getJsonString(
          reversal.metadata,
          'requestedByUserId',
        );
        return {
          id: reversal.id,
          orderId: reversal.orderId,
          type: reversal.type,
          amount: reversal.amount,
          reasonCode: reversal.reasonCode,
          note: reversal.note,
          paymentReference: reversal.paymentReference,
          occurredAt: reversal.occurredAt,
          responsibleStaff: reversal.order.createdBy,
          reversalActor: reversal.actorUser,
          orderStatus: reversal.order.status,
          approvalContext: {
            approvedByUserId: this.getJsonString(
              reversal.metadata,
              'approvedByUserId',
            ),
            approvedByEmail: this.getJsonString(
              reversal.metadata,
              'approvedByEmail',
            ),
            requestedByUserId,
            requestedBy: requestedByUserId
              ? (requestedByUserMap.get(requestedByUserId) ?? null)
              : null,
          },
        };
      }),
    };
  }

  async getPosProductPerformance(filters: PosProductPerformanceDto) {
    const currentRange = this.resolveDateRange(filters);
    const products = await this.prisma.product.findMany({
      where: {
        categoryId: filters.categoryId,
      },
      orderBy: [{ name: 'asc' }],
      include: {
        category: true,
        variants: {
          include: {
            orderItems: {
              where: {
                order: {
                  status: OrderStatus.COMPLETED,
                  completedAt: {
                    gte: currentRange.from,
                    lte: currentRange.to,
                  },
                },
              },
              select: {
                orderId: true,
                quantity: true,
                lineSubtotal: true,
                lineCogsAmount: true,
              },
            },
          },
        },
      },
    });

    const productRows = products.map((product) => {
      const itemRows = product.variants.flatMap(
        (variant) => variant.orderItems,
      );
      const quantitySold = itemRows.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      const revenue = sumDecimals(itemRows.map((item) => item.lineSubtotal));
      const cogs = sumDecimals(itemRows.map((item) => item.lineCogsAmount));
      const grossMargin = revenue.minus(cogs);
      const orderCount = new Set(itemRows.map((item) => item.orderId)).size;

      return {
        productId: product.id,
        productName: product.name,
        category: {
          id: product.category.id,
          name: product.category.name,
        },
        variantCount: product.variants.length,
        quantitySold,
        orderCount,
        revenue,
        cogs,
        grossMargin,
      };
    });

    const totalRevenue = sumDecimals(productRows.map((row) => row.revenue));
    const totalQuantitySold = productRows.reduce(
      (sum, row) => sum + row.quantitySold,
      0,
    );
    const totalGrossMargin = sumDecimals(
      productRows.map((row) => row.grossMargin),
    );
    const productsWithContribution = productRows.map((row) => ({
      ...row,
      contributionPercentage: totalRevenue.greaterThan(0)
        ? row.revenue.dividedBy(totalRevenue).toNumber()
        : null,
      marginRate: row.revenue.greaterThan(0)
        ? row.grossMargin.dividedBy(row.revenue).toNumber()
        : null,
    }));

    const categoryMap = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        quantitySold: number;
        revenue: Prisma.Decimal;
        grossMargin: Prisma.Decimal;
      }
    >();

    for (const row of productsWithContribution) {
      const current = categoryMap.get(row.category.id) ?? {
        categoryId: row.category.id,
        categoryName: row.category.name,
        quantitySold: 0,
        revenue: ZERO,
        grossMargin: ZERO,
      };
      current.quantitySold += row.quantitySold;
      current.revenue = current.revenue.plus(row.revenue);
      current.grossMargin = current.grossMargin.plus(row.grossMargin);
      categoryMap.set(row.category.id, current);
    }

    return {
      period: {
        from: currentRange.from.toISOString(),
        to: currentRange.to.toISOString(),
      },
      filters: {
        categoryId: filters.categoryId ?? null,
      },
      categoryAttributionMode: 'CURRENT_RELATIONSHIP',
      summary: {
        totalProductsConsidered: productsWithContribution.length,
        sellingProductsCount: productsWithContribution.filter(
          (row) => row.quantitySold > 0,
        ).length,
        totalQuantitySold,
        totalRevenue,
        totalGrossMargin,
      },
      products: [...productsWithContribution].sort((left, right) => {
        const revenueComparison = right.revenue.comparedTo(left.revenue);
        if (revenueComparison !== 0) {
          return revenueComparison;
        }

        return right.quantitySold - left.quantitySold;
      }),
      topSellersByQuantity: [...productsWithContribution]
        .sort((left, right) => {
          if (right.quantitySold !== left.quantitySold) {
            return right.quantitySold - left.quantitySold;
          }

          return right.revenue.comparedTo(left.revenue);
        })
        .slice(0, 10),
      topProductsByRevenue: [...productsWithContribution]
        .sort((left, right) => right.revenue.comparedTo(left.revenue))
        .slice(0, 10),
      topProductsByGrossMargin: [...productsWithContribution]
        .sort((left, right) => right.grossMargin.comparedTo(left.grossMargin))
        .slice(0, 10),
      slowMovingProducts: [...productsWithContribution]
        .sort((left, right) => {
          if (left.quantitySold !== right.quantitySold) {
            return left.quantitySold - right.quantitySold;
          }

          return left.revenue.comparedTo(right.revenue);
        })
        .slice(0, 10),
      topCategories: [...categoryMap.values()]
        .map((row) => ({
          ...row,
          contributionPercentage: totalRevenue.greaterThan(0)
            ? row.revenue.dividedBy(totalRevenue).toNumber()
            : null,
        }))
        .sort((left, right) => right.revenue.comparedTo(left.revenue))
        .slice(0, 10),
    };
  }

  async getPosStaffPerformance(filters: ReportFiltersDto) {
    const currentRange = this.resolveDateRange(filters);
    const [orders, reversals] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          status: OrderStatus.COMPLETED,
          completedAt: {
            gte: currentRange.from,
            lte: currentRange.to,
          },
        },
        select: {
          createdByUserId: true,
          subtotalAmount: true,
          discountAmount: true,
          totalAmount: true,
          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.orderReversal.findMany({
        where: {
          occurredAt: {
            gte: currentRange.from,
            lte: currentRange.to,
          },
        },
        select: {
          actorUserId: true,
          type: true,
          amount: true,
          actorUser: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    const staffMap = new Map<
      string,
      {
        staff: {
          id: string;
          email: string;
          firstName: string;
          lastName: string;
        };
        grossSales: Prisma.Decimal;
        netSales: Prisma.Decimal;
        discounts: Prisma.Decimal;
        transactionCount: number;
        refundCount: number;
        refundedAmount: Prisma.Decimal;
        voidCount: number;
        voidedAmount: Prisma.Decimal;
      }
    >();

    for (const order of orders) {
      const current = staffMap.get(order.createdByUserId) ?? {
        staff: order.createdBy,
        grossSales: ZERO,
        netSales: ZERO,
        discounts: ZERO,
        transactionCount: 0,
        refundCount: 0,
        refundedAmount: ZERO,
        voidCount: 0,
        voidedAmount: ZERO,
      };
      current.grossSales = current.grossSales.plus(order.subtotalAmount);
      current.netSales = current.netSales.plus(order.totalAmount);
      current.discounts = current.discounts.plus(order.discountAmount);
      current.transactionCount += 1;
      staffMap.set(order.createdByUserId, current);
    }

    for (const reversal of reversals) {
      const current = staffMap.get(reversal.actorUserId) ?? {
        staff: reversal.actorUser,
        grossSales: ZERO,
        netSales: ZERO,
        discounts: ZERO,
        transactionCount: 0,
        refundCount: 0,
        refundedAmount: ZERO,
        voidCount: 0,
        voidedAmount: ZERO,
      };

      if (reversal.type === OrderReversalType.REFUND) {
        current.refundCount += 1;
        current.refundedAmount = current.refundedAmount.plus(reversal.amount);
      } else {
        current.voidCount += 1;
        current.voidedAmount = current.voidedAmount.plus(reversal.amount);
      }

      staffMap.set(reversal.actorUserId, current);
    }

    const rows = [...staffMap.values()]
      .map((row) => ({
        ...row,
        averageOrderValue:
          row.transactionCount > 0
            ? row.netSales.dividedBy(row.transactionCount)
            : ZERO,
      }))
      .sort((left, right) => {
        const salesComparison = right.netSales.comparedTo(left.netSales);
        if (salesComparison !== 0) {
          return salesComparison;
        }

        return right.transactionCount - left.transactionCount;
      });

    return {
      period: {
        from: currentRange.from.toISOString(),
        to: currentRange.to.toISOString(),
      },
      summary: {
        staffCount: rows.length,
        totalNetSales: sumDecimals(rows.map((row) => row.netSales)),
        totalTransactions: rows.reduce(
          (sum, row) => sum + row.transactionCount,
          0,
        ),
        totalDiscounts: sumDecimals(rows.map((row) => row.discounts)),
        totalRefundsHandled: rows.reduce(
          (sum, row) => sum + row.refundCount,
          0,
        ),
        totalVoidsHandled: rows.reduce((sum, row) => sum + row.voidCount, 0),
      },
      staff: rows,
      comparison: {
        topByNetSales: rows[0] ?? null,
        topByTransactions:
          [...rows].sort(
            (left, right) => right.transactionCount - left.transactionCount,
          )[0] ?? null,
        topByRefundsHandled:
          [...rows].sort(
            (left, right) => right.refundCount - left.refundCount,
          )[0] ?? null,
      },
    };
  }

  async getPosPeakHours(filters: PosPeakHoursDto) {
    const currentRange = this.resolveDateRange(filters);
    const dayType = filters.dayType ?? 'all';
    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.COMPLETED,
        completedAt: {
          gte: currentRange.from,
          lte: currentRange.to,
        },
      },
      select: {
        completedAt: true,
        subtotalAmount: true,
        totalAmount: true,
      },
    });

    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: this.formatHourLabel(hour),
      grossSales: ZERO,
      netSales: ZERO,
      transactionCount: 0,
    }));

    for (const order of orders) {
      if (
        dayType !== 'all' &&
        !this.matchesPeakDayType(order.completedAt, dayType)
      ) {
        continue;
      }

      const hour = this.getManilaHour(order.completedAt);
      const bucket = buckets[hour];
      bucket.grossSales = bucket.grossSales.plus(order.subtotalAmount);
      bucket.netSales = bucket.netSales.plus(order.totalAmount);
      bucket.transactionCount += 1;
    }

    const hourly = buckets.map((bucket) => ({
      ...bucket,
      averageTicketSize:
        bucket.transactionCount > 0
          ? bucket.netSales.dividedBy(bucket.transactionCount)
          : ZERO,
    }));

    const busiestHours = [...hourly]
      .sort((left, right) => {
        if (right.transactionCount !== left.transactionCount) {
          return right.transactionCount - left.transactionCount;
        }

        return right.netSales.comparedTo(left.netSales);
      })
      .slice(0, 3);

    const slowestHours = [...hourly]
      .sort((left, right) => {
        if (left.transactionCount !== right.transactionCount) {
          return left.transactionCount - right.transactionCount;
        }

        return left.netSales.comparedTo(right.netSales);
      })
      .slice(0, 3);

    return {
      period: {
        from: currentRange.from.toISOString(),
        to: currentRange.to.toISOString(),
      },
      filters: {
        dayType,
      },
      summary: {
        totalTransactions: hourly.reduce(
          (sum, row) => sum + row.transactionCount,
          0,
        ),
        totalNetSales: sumDecimals(hourly.map((row) => row.netSales)),
        busiestHour: busiestHours[0] ?? null,
        slowestHour: slowestHours[0] ?? null,
      },
      hourly,
      busiestHours,
      slowestHours,
    };
  }

  async getPosInventoryLinked(filters: PosInventoryLinkedDto) {
    const currentRange = this.resolveDateRange(filters);
    const materialSearch = filters.materialSearch?.trim();
    const variantSearch = filters.variantSearch?.trim();
    const drilldownVariantId = filters.drilldownVariantId?.trim();

    const lineConditions: Prisma.InventoryTransactionLineWhereInput[] = [];

    if (materialSearch) {
      lineConditions.push({
        OR: [
          {
            rawMaterial: {
              name: {
                contains: materialSearch,
                mode: 'insensitive',
              },
            },
          },
          {
            rawMaterial: {
              sku: {
                contains: materialSearch,
                mode: 'insensitive',
              },
            },
          },
        ],
      });
    }

    if (variantSearch) {
      lineConditions.push({
        OR: [
          {
            productVariant: {
              name: {
                contains: variantSearch,
                mode: 'insensitive',
              },
            },
          },
          {
            productVariant: {
              sku: {
                contains: variantSearch,
                mode: 'insensitive',
              },
            },
          },
          {
            productVariant: {
              product: {
                name: {
                  contains: variantSearch,
                  mode: 'insensitive',
                },
              },
            },
          },
          {
            orderItem: {
              productNameSnapshot: {
                contains: variantSearch,
                mode: 'insensitive',
              },
            },
          },
          {
            orderItem: {
              variantNameSnapshot: {
                contains: variantSearch,
                mode: 'insensitive',
              },
            },
          },
          {
            orderItem: {
              skuSnapshot: {
                contains: variantSearch,
                mode: 'insensitive',
              },
            },
          },
        ],
      });
    }

    const lines = await this.prisma.inventoryTransactionLine.findMany({
      where: {
        inventoryTransaction: {
          type: InventoryTransactionType.CHECKOUT,
          sourceType: InventorySourceType.ORDER,
          occurredAt: {
            gte: currentRange.from,
            lte: currentRange.to,
          },
        },
        AND: lineConditions.length > 0 ? lineConditions : undefined,
      },
      include: {
        inventoryTransaction: {
          select: {
            id: true,
            sourceId: true,
            occurredAt: true,
          },
        },
        rawMaterial: {
          include: {
            unit: true,
            summary: true,
          },
        },
        productVariant: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
        orderItem: {
          select: {
            id: true,
            orderId: true,
            quantity: true,
            lineSubtotal: true,
            lineCogsAmount: true,
            productNameSnapshot: true,
            variantNameSnapshot: true,
            skuSnapshot: true,
          },
        },
      },
      orderBy: [
        {
          inventoryTransaction: {
            occurredAt: 'desc',
          },
        },
        { createdAt: 'desc' },
      ],
    });

    const materialIds = [...new Set(lines.map((line) => line.rawMaterialId))];
    const activeLowStockAlerts = materialIds.length
      ? await this.prisma.alert.findMany({
          where: {
            type: AlertType.LOW_STOCK,
            state: AlertState.ACTIVE,
            rawMaterialId: {
              in: materialIds,
            },
          },
          select: {
            id: true,
            rawMaterialId: true,
            severity: true,
            title: true,
            message: true,
            lastTriggeredAt: true,
          },
        })
      : [];

    const activeLowStockAlertMap = new Map(
      activeLowStockAlerts.map((alert) => [alert.rawMaterialId, alert]),
    );

    const materialMap = new Map<
      string,
      {
        rawMaterial: {
          id: string;
          name: string;
          sku: string;
          reorderPoint: Prisma.Decimal;
          unit: {
            id: string;
            code: string;
            name: string;
            dimension: string;
            conversionFactor: Prisma.Decimal;
          };
        };
        consumedQuantity: Prisma.Decimal;
        consumptionCost: Prisma.Decimal;
        movementLineCount: number;
        orderIds: Set<string>;
        variantIds: Set<string>;
        currentOnHandQuantity: Prisma.Decimal;
        currentUsableQuantity: Prisma.Decimal;
      }
    >();

    const orderItemMap = new Map<
      string,
      {
        id: string;
        orderId: string;
        productVariantId: string | null;
        productName: string;
        variantName: string;
        sku: string;
        quantity: number;
        lineSubtotal: Prisma.Decimal;
        lineCogsAmount: Prisma.Decimal;
        category: { id: string; name: string } | null;
      }
    >();

    const variantConsumptionMap = new Map<
      string,
      {
        productVariant: {
          id: string;
          name: string;
          sku: string;
          product: {
            id: string;
            name: string;
            category: { id: string; name: string } | null;
          };
        };
        materialConsumptionQuantity: Prisma.Decimal;
        materialConsumptionCost: Prisma.Decimal;
      }
    >();

    const transactionMap = new Map<
      string,
      {
        transactionId: string;
        orderId: string | null;
        occurredAt: Date;
        consumedQuantity: Prisma.Decimal;
        consumptionCost: Prisma.Decimal;
        materialIds: Set<string>;
        variantIds: Set<string>;
        movementLineCount: number;
      }
    >();

    for (const line of lines) {
      const quantityUsed = toDecimal(line.quantityDelta).abs();
      const costUsed = toDecimal(line.totalCostDelta).abs();
      const summary = line.rawMaterial.summary;
      const currentOnHandQuantity = summary?.onHandQuantity ?? ZERO;
      const currentUsableQuantity = summary?.usableQuantity ?? ZERO;

      const materialEntry = materialMap.get(line.rawMaterialId) ?? {
        rawMaterial: {
          id: line.rawMaterial.id,
          name: line.rawMaterial.name,
          sku: line.rawMaterial.sku,
          reorderPoint: line.rawMaterial.reorderPoint,
          unit: {
            id: line.rawMaterial.unit.id,
            code: line.rawMaterial.unit.code,
            name: line.rawMaterial.unit.name,
            dimension: line.rawMaterial.unit.dimension,
            conversionFactor: line.rawMaterial.unit.conversionFactor,
          },
        },
        consumedQuantity: ZERO,
        consumptionCost: ZERO,
        movementLineCount: 0,
        orderIds: new Set<string>(),
        variantIds: new Set<string>(),
        currentOnHandQuantity,
        currentUsableQuantity,
      };

      materialEntry.consumedQuantity =
        materialEntry.consumedQuantity.plus(quantityUsed);
      materialEntry.consumptionCost =
        materialEntry.consumptionCost.plus(costUsed);
      materialEntry.movementLineCount += 1;
      if (line.inventoryTransaction.sourceId) {
        materialEntry.orderIds.add(line.inventoryTransaction.sourceId);
      }
      if (line.productVariantId) {
        materialEntry.variantIds.add(line.productVariantId);
      }
      materialMap.set(line.rawMaterialId, materialEntry);

      if (line.orderItem) {
        const existingOrderItem = orderItemMap.get(line.orderItem.id);
        if (!existingOrderItem) {
          orderItemMap.set(line.orderItem.id, {
            id: line.orderItem.id,
            orderId: line.orderItem.orderId,
            productVariantId: line.productVariantId,
            productName:
              line.orderItem.productNameSnapshot ??
              line.productVariant?.product.name ??
              'Unknown product',
            variantName:
              line.orderItem.variantNameSnapshot ??
              line.productVariant?.name ??
              'Unknown variant',
            sku:
              line.orderItem.skuSnapshot ?? line.productVariant?.sku ?? 'N/A',
            quantity: line.orderItem.quantity,
            lineSubtotal: line.orderItem.lineSubtotal,
            lineCogsAmount: line.orderItem.lineCogsAmount,
            category: line.productVariant?.product.category
              ? {
                  id: line.productVariant.product.category.id,
                  name: line.productVariant.product.category.name,
                }
              : null,
          });
        }
      }

      if (line.productVariant) {
        const variantEntry = variantConsumptionMap.get(
          line.productVariant.id,
        ) ?? {
          productVariant: {
            id: line.productVariant.id,
            name: line.productVariant.name,
            sku: line.productVariant.sku,
            product: {
              id: line.productVariant.product.id,
              name: line.productVariant.product.name,
              category: line.productVariant.product.category
                ? {
                    id: line.productVariant.product.category.id,
                    name: line.productVariant.product.category.name,
                  }
                : null,
            },
          },
          materialConsumptionQuantity: ZERO,
          materialConsumptionCost: ZERO,
        };
        variantEntry.materialConsumptionQuantity =
          variantEntry.materialConsumptionQuantity.plus(quantityUsed);
        variantEntry.materialConsumptionCost =
          variantEntry.materialConsumptionCost.plus(costUsed);
        variantConsumptionMap.set(line.productVariant.id, variantEntry);
      }

      const transactionEntry = transactionMap.get(
        line.inventoryTransactionId,
      ) ?? {
        transactionId: line.inventoryTransaction.id,
        orderId: line.inventoryTransaction.sourceId ?? null,
        occurredAt: line.inventoryTransaction.occurredAt,
        consumedQuantity: ZERO,
        consumptionCost: ZERO,
        materialIds: new Set<string>(),
        variantIds: new Set<string>(),
        movementLineCount: 0,
      };
      transactionEntry.consumedQuantity =
        transactionEntry.consumedQuantity.plus(quantityUsed);
      transactionEntry.consumptionCost =
        transactionEntry.consumptionCost.plus(costUsed);
      transactionEntry.materialIds.add(line.rawMaterialId);
      if (line.productVariantId) {
        transactionEntry.variantIds.add(line.productVariantId);
      }
      transactionEntry.movementLineCount += 1;
      transactionMap.set(line.inventoryTransactionId, transactionEntry);
    }

    const variantOrderMap = new Map<
      string,
      {
        productVariant: {
          id: string;
          name: string;
          sku: string;
          product: {
            id: string | null;
            name: string;
            category: { id: string; name: string } | null;
          };
        };
        quantitySold: number;
        revenue: Prisma.Decimal;
        cogs: Prisma.Decimal;
        orderIds: Set<string>;
      }
    >();

    for (const orderItem of orderItemMap.values()) {
      const variantId = orderItem.productVariantId ?? orderItem.id;
      const existingConsumption = orderItem.productVariantId
        ? variantConsumptionMap.get(orderItem.productVariantId)
        : null;
      const variantEntry = variantOrderMap.get(variantId) ?? {
        productVariant: existingConsumption?.productVariant ?? {
          id: variantId,
          name: orderItem.variantName,
          sku: orderItem.sku,
          product: {
            id: null,
            name: orderItem.productName,
            category: orderItem.category,
          },
        },
        quantitySold: 0,
        revenue: ZERO,
        cogs: ZERO,
        orderIds: new Set<string>(),
      };
      variantEntry.quantitySold += orderItem.quantity;
      variantEntry.revenue = variantEntry.revenue.plus(orderItem.lineSubtotal);
      variantEntry.cogs = variantEntry.cogs.plus(orderItem.lineCogsAmount);
      variantEntry.orderIds.add(orderItem.orderId);
      variantOrderMap.set(variantId, variantEntry);
    }

    const variants = [...variantOrderMap.values()]
      .map((variant) => {
        const consumption = variantConsumptionMap.get(
          variant.productVariant.id,
        );
        return {
          productVariant: variant.productVariant,
          quantitySold: variant.quantitySold,
          revenue: variant.revenue,
          cogs: variant.cogs,
          grossMargin: variant.revenue.minus(variant.cogs),
          orderCount: variant.orderIds.size,
          materialConsumptionQuantity:
            consumption?.materialConsumptionQuantity ?? ZERO,
          materialConsumptionCost: consumption?.materialConsumptionCost ?? ZERO,
        };
      })
      .sort((left, right) => {
        if (right.quantitySold !== left.quantitySold) {
          return right.quantitySold - left.quantitySold;
        }

        return right.revenue.comparedTo(left.revenue);
      });

    const materials = [...materialMap.values()]
      .map((material) => {
        const activeLowStockAlert = activeLowStockAlertMap.get(
          material.rawMaterial.id,
        );
        const isLowStock = material.currentUsableQuantity.lessThanOrEqualTo(
          material.rawMaterial.reorderPoint,
        );

        return {
          rawMaterial: material.rawMaterial,
          consumedQuantity: material.consumedQuantity,
          consumptionCost: material.consumptionCost,
          movementLineCount: material.movementLineCount,
          orderCount: material.orderIds.size,
          variantCount: material.variantIds.size,
          currentOnHandQuantity: material.currentOnHandQuantity,
          currentUsableQuantity: material.currentUsableQuantity,
          isLowStock,
          activeLowStockAlert: activeLowStockAlert
            ? {
                id: activeLowStockAlert.id,
                severity: activeLowStockAlert.severity,
                title: activeLowStockAlert.title,
                message: activeLowStockAlert.message,
                lastTriggeredAt: activeLowStockAlert.lastTriggeredAt,
              }
            : null,
        };
      })
      .sort((left, right) => {
        const quantityComparison = right.consumedQuantity.comparedTo(
          left.consumedQuantity,
        );
        if (quantityComparison !== 0) {
          return quantityComparison;
        }

        return right.consumptionCost.comparedTo(left.consumptionCost);
      });

    const lowStockMaterials = materials
      .filter((material) => material.isLowStock || material.activeLowStockAlert)
      .sort((left, right) => {
        const leftPriority = left.activeLowStockAlert ? 1 : 0;
        const rightPriority = right.activeLowStockAlert ? 1 : 0;
        if (rightPriority !== leftPriority) {
          return rightPriority - leftPriority;
        }

        return right.consumptionCost.comparedTo(left.consumptionCost);
      });

    const recentSalesLinkedMovements = [...transactionMap.values()]
      .sort(
        (left, right) => right.occurredAt.getTime() - left.occurredAt.getTime(),
      )
      .slice(0, this.normalizeLimit(filters.limit) * 2)
      .map((transaction) => ({
        transactionId: transaction.transactionId,
        orderId: transaction.orderId,
        occurredAt: transaction.occurredAt,
        consumedQuantity: transaction.consumedQuantity,
        consumptionCost: transaction.consumptionCost,
        rawMaterialCount: transaction.materialIds.size,
        variantCount: transaction.variantIds.size,
        movementLineCount: transaction.movementLineCount,
      }));

    const selectedVariantRow = drilldownVariantId
      ? (variants.find(
          (variant) => variant.productVariant.id === drilldownVariantId,
        ) ?? null)
      : null;

    const selectedVariantBreakdown = selectedVariantRow
      ? {
          productVariant: selectedVariantRow.productVariant,
          summary: {
            quantitySold: selectedVariantRow.quantitySold,
            revenue: selectedVariantRow.revenue,
            cogs: selectedVariantRow.cogs,
            grossMargin: selectedVariantRow.grossMargin,
            materialConsumptionQuantity:
              selectedVariantRow.materialConsumptionQuantity,
            materialConsumptionCost: selectedVariantRow.materialConsumptionCost,
          },
          materials: [...materialMap.values()]
            .filter((material) =>
              material.variantIds.has(selectedVariantRow.productVariant.id),
            )
            .map((material) => {
              let consumedQuantity = ZERO;
              let consumptionCost = ZERO;
              let movementLineCount = 0;

              for (const line of lines) {
                if (
                  line.productVariantId !==
                    selectedVariantRow.productVariant.id ||
                  line.rawMaterialId !== material.rawMaterial.id
                ) {
                  continue;
                }

                consumedQuantity = consumedQuantity.plus(
                  toDecimal(line.quantityDelta).abs(),
                );
                consumptionCost = consumptionCost.plus(
                  toDecimal(line.totalCostDelta).abs(),
                );
                movementLineCount += 1;
              }

              return {
                rawMaterial: material.rawMaterial,
                consumedQuantity,
                consumptionCost,
                movementLineCount,
                currentUsableQuantity: material.currentUsableQuantity,
                isLowStock: material.currentUsableQuantity.lessThanOrEqualTo(
                  material.rawMaterial.reorderPoint,
                ),
              };
            })
            .sort((left, right) =>
              right.consumedQuantity.comparedTo(left.consumedQuantity),
            ),
        }
      : null;

    return {
      period: {
        from: currentRange.from.toISOString(),
        to: currentRange.to.toISOString(),
      },
      filters: {
        materialSearch: materialSearch ?? null,
        variantSearch: variantSearch ?? null,
        drilldownVariantId: drilldownVariantId ?? null,
      },
      summary: {
        salesLinkedTransactionCount: transactionMap.size,
        totalMaterialConsumptionQuantity: sumDecimals(
          materials.map((material) => material.consumedQuantity),
        ),
        totalConsumptionCost: sumDecimals(
          materials.map((material) => material.consumptionCost),
        ),
        distinctMaterialsConsumed: materials.length,
        distinctVariantsSold: variants.length,
        lowStockConsumedMaterialCount: lowStockMaterials.length,
      },
      materials,
      lowStockMaterials,
      variants,
      recentSalesLinkedMovements,
      selectedVariantBreakdown,
    };
  }

  async getPosAuditExceptions(filters: PosAuditExceptionsDto) {
    const currentRange = this.resolveDateRange(filters);
    const page = Math.max(filters.page ?? 1, 1);
    const pageSize = Math.min(Math.max(filters.pageSize ?? 10, 1), 100);
    const staffSearch = filters.staffSearch?.trim().toLowerCase() ?? null;
    const reasonSearch = filters.reasonSearch?.trim().toLowerCase() ?? null;
    const statusFilter = filters.status ?? null;
    const exceptionType = filters.exceptionType ?? 'ALL';

    const reversalWhere: Prisma.OrderReversalWhereInput = {
      occurredAt: {
        gte: currentRange.from,
        lte: currentRange.to,
      },
      type:
        exceptionType === 'ALL' || exceptionType === 'DISCOUNT'
          ? undefined
          : exceptionType === 'REFUND'
            ? OrderReversalType.REFUND
            : OrderReversalType.VOID,
      order: statusFilter
        ? {
            status: statusFilter,
          }
        : undefined,
    };

    const discountWhere: Prisma.OrderWhereInput = {
      completedAt: {
        gte: currentRange.from,
        lte: currentRange.to,
      },
      discountAmount: {
        gt: ZERO,
      },
      status: statusFilter ?? undefined,
    };

    const [reversals, discountedOrders] = await Promise.all([
      exceptionType === 'DISCOUNT'
        ? Promise.resolve([])
        : this.prisma.orderReversal.findMany({
            where: reversalWhere,
            orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
            include: {
              actorUser: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
              order: {
                select: {
                  id: true,
                  status: true,
                  createdBy: {
                    select: {
                      id: true,
                      email: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                  discountCode: true,
                  discountRate: true,
                  discountAmount: true,
                },
              },
            },
          }),
      exceptionType === 'REFUND' || exceptionType === 'VOID'
        ? Promise.resolve([])
        : this.prisma.order.findMany({
            where: discountWhere,
            orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
            select: {
              id: true,
              status: true,
              completedAt: true,
              discountCode: true,
              discountRate: true,
              discountAmount: true,
              totalAmount: true,
              subtotalAmount: true,
              taxAmount: true,
              createdBy: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          }),
    ]);

    const requestedByUserIds = [
      ...new Set(
        reversals
          .map((reversal) =>
            this.getJsonString(reversal.metadata, 'requestedByUserId'),
          )
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const requestedByUsers =
      requestedByUserIds.length > 0
        ? await this.prisma.user.findMany({
            where: {
              id: {
                in: requestedByUserIds,
              },
            },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          })
        : [];
    const requestedByUserMap = new Map(
      requestedByUsers.map((user) => [user.id, user]),
    );

    const exceptionRows = [
      ...reversals.map((reversal) => {
        const requestedByUserId = this.getJsonString(
          reversal.metadata,
          'requestedByUserId',
        );

        return {
          id: reversal.id,
          kind: reversal.type,
          occurredAt: reversal.occurredAt,
          orderId: reversal.orderId,
          orderStatus: reversal.order.status,
          amount: reversal.amount,
          reasonCode: reversal.reasonCode,
          note: reversal.note,
          responsibleUser: reversal.actorUser,
          relatedUser: requestedByUserId
            ? (requestedByUserMap.get(requestedByUserId) ?? null)
            : null,
          approvalContext: {
            requestedByUserId,
            requestedBy: requestedByUserId
              ? (requestedByUserMap.get(requestedByUserId) ?? null)
              : null,
            approvedByUserId: this.getJsonString(
              reversal.metadata,
              'approvedByUserId',
            ),
            approvedByEmail: this.getJsonString(
              reversal.metadata,
              'approvedByEmail',
            ),
          },
          paymentReference: reversal.paymentReference,
          discountDetails: reversal.order.discountAmount.greaterThan(ZERO)
            ? {
                discountCode: reversal.order.discountCode,
                discountRate: reversal.order.discountRate,
                discountAmount: reversal.order.discountAmount,
              }
            : null,
        };
      }),
      ...discountedOrders.map((order) => ({
        id: `discount:${order.id}`,
        kind: 'DISCOUNT' as const,
        occurredAt: order.completedAt,
        orderId: order.id,
        orderStatus: order.status,
        amount: order.discountAmount,
        reasonCode: order.discountCode ?? 'ORDER_LEVEL_DISCOUNT',
        note: null,
        responsibleUser: order.createdBy,
        relatedUser: null,
        approvalContext: {
          requestedByUserId: null,
          requestedBy: null,
          approvedByUserId: null,
          approvedByEmail: null,
        },
        paymentReference: null,
        discountDetails: {
          discountCode: order.discountCode,
          discountRate: order.discountRate,
          discountAmount: order.discountAmount,
        },
      })),
    ]
      .filter((row) => {
        if (staffSearch) {
          const staffFields = [
            row.responsibleUser.email,
            row.responsibleUser.firstName,
            row.responsibleUser.lastName,
            row.relatedUser?.email ?? '',
            row.relatedUser?.firstName ?? '',
            row.relatedUser?.lastName ?? '',
            row.approvalContext.approvedByEmail ?? '',
          ]
            .join(' ')
            .toLowerCase();

          if (!staffFields.includes(staffSearch)) {
            return false;
          }
        }

        if (reasonSearch) {
          const reasonFields = [
            row.reasonCode ?? '',
            row.note ?? '',
            row.discountDetails?.discountCode ?? '',
          ]
            .join(' ')
            .toLowerCase();

          if (!reasonFields.includes(reasonSearch)) {
            return false;
          }
        }

        return true;
      })
      .sort((left, right) => {
        const timeComparison =
          right.occurredAt.getTime() - left.occurredAt.getTime();
        if (timeComparison !== 0) {
          return timeComparison;
        }

        return left.orderId.localeCompare(right.orderId);
      });

    const total = exceptionRows.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const pagedRows = exceptionRows.slice(
      (page - 1) * pageSize,
      page * pageSize,
    );

    const refundRows = exceptionRows.filter((row) => row.kind === 'REFUND');
    const voidRows = exceptionRows.filter((row) => row.kind === 'VOID');
    const discountRows = exceptionRows.filter((row) => row.kind === 'DISCOUNT');

    return {
      period: {
        from: currentRange.from.toISOString(),
        to: currentRange.to.toISOString(),
      },
      filters: {
        staffSearch: filters.staffSearch ?? null,
        reasonSearch: filters.reasonSearch ?? null,
        status: statusFilter,
        exceptionType,
      },
      summary: {
        totalExceptions: total,
        refundCount: refundRows.length,
        refundedAmount: sumDecimals(refundRows.map((row) => row.amount)),
        voidCount: voidRows.length,
        voidedAmount: sumDecimals(voidRows.map((row) => row.amount)),
        discountCount: discountRows.length,
        discountedAmount: sumDecimals(discountRows.map((row) => row.amount)),
      },
      rows: pagedRows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  private buildCompletedOrderWhere(filters: ReportFiltersDto) {
    return {
      status: OrderStatus.COMPLETED,
      completedAt: this.buildDateRange(filters),
    } satisfies Prisma.OrderWhereInput;
  }

  private buildDateRange(filters: ReportFiltersDto) {
    if (!filters.from && !filters.to) {
      return undefined;
    }

    return {
      gte: filters.from ? new Date(filters.from) : undefined,
      lte: filters.to ? new Date(filters.to) : undefined,
    };
  }

  private buildCompletedOrderWhereForRange(
    range: { from: Date; to: Date },
    filters: {
      staffSearch?: string;
      paymentMethod?: PaymentMethod;
    } = {},
  ): Prisma.OrderWhereInput {
    const staffSearch = filters.staffSearch?.trim();
    const andConditions: Prisma.OrderWhereInput[] = [];

    if (staffSearch) {
      andConditions.push({
        OR: [
          {
            createdBy: {
              email: {
                contains: staffSearch,
                mode: 'insensitive',
              },
            },
          },
          {
            createdBy: {
              firstName: {
                contains: staffSearch,
                mode: 'insensitive',
              },
            },
          },
          {
            createdBy: {
              lastName: {
                contains: staffSearch,
                mode: 'insensitive',
              },
            },
          },
        ],
      });
    }

    return {
      status: OrderStatus.COMPLETED,
      completedAt: {
        gte: range.from,
        lte: range.to,
      },
      payments: filters.paymentMethod
        ? {
            some: {
              method: filters.paymentMethod,
            },
          }
        : undefined,
      AND: andConditions.length > 0 ? andConditions : undefined,
    };
  }

  private buildRefundWhereForRange(
    range: { from: Date; to: Date },
    filters: {
      staffSearch?: string;
      paymentMethod?: PaymentMethod;
    } = {},
  ): Prisma.OrderReversalWhereInput {
    const staffSearch = filters.staffSearch?.trim();

    return {
      type: OrderReversalType.REFUND,
      occurredAt: {
        gte: range.from,
        lte: range.to,
      },
      order: {
        payments: filters.paymentMethod
          ? {
              some: {
                method: filters.paymentMethod,
              },
            }
          : undefined,
        OR: staffSearch
          ? [
              {
                createdBy: {
                  email: {
                    contains: staffSearch,
                    mode: 'insensitive',
                  },
                },
              },
              {
                createdBy: {
                  firstName: {
                    contains: staffSearch,
                    mode: 'insensitive',
                  },
                },
              },
              {
                createdBy: {
                  lastName: {
                    contains: staffSearch,
                    mode: 'insensitive',
                  },
                },
              },
            ]
          : undefined,
      },
    };
  }

  private buildReversalWhereForRange(
    range: { from: Date; to: Date },
    staffSearch?: string,
  ): Prisma.OrderReversalWhereInput {
    const normalizedSearch = staffSearch?.trim();

    return {
      occurredAt: {
        gte: range.from,
        lte: range.to,
      },
      OR: normalizedSearch
        ? [
            {
              actorUser: {
                email: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
            },
            {
              actorUser: {
                firstName: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
            },
            {
              actorUser: {
                lastName: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
            },
          ]
        : undefined,
    };
  }

  private normalizeLimit(limit?: number) {
    return Math.min(Math.max(limit ?? 5, 1), 50);
  }

  private resolveDateRange(filters: ReportFiltersDto) {
    const to = filters.to ? new Date(filters.to) : new Date();
    const from = filters.from ? new Date(filters.from) : new Date(to.getTime());

    return { from, to };
  }

  private shiftRange(range: { from: Date; to: Date }, offsetMs: number) {
    return {
      from: new Date(range.from.getTime() + offsetMs),
      to: new Date(range.to.getTime() + offsetMs),
    };
  }

  private getRangeLengthMs(range: { from: Date; to: Date }) {
    return Math.max(range.to.getTime() - range.from.getTime() + 1, 1);
  }

  private summarizeOrders(
    orders: Array<{
      subtotalAmount: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      totalAmount: Prisma.Decimal;
    }>,
  ) {
    const transactionCount = orders.length;
    const grossSales = sumDecimals(orders.map((order) => order.subtotalAmount));
    const discounts = sumDecimals(orders.map((order) => order.discountAmount));
    const netSales = sumDecimals(orders.map((order) => order.totalAmount));
    const averageOrderValue =
      transactionCount > 0 ? netSales.dividedBy(transactionCount) : ZERO;

    return {
      grossSales,
      netSales,
      discounts,
      transactionCount,
      averageOrderValue,
    };
  }

  private summarizeSalesAnalytics(
    orders: Array<{
      subtotalAmount: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      totalAmount: Prisma.Decimal;
    }>,
    refunds: Prisma.Decimal,
  ) {
    const summary = this.summarizeOrders(orders);
    return {
      ...summary,
      refunds,
      averageTicketSize: summary.averageOrderValue,
    };
  }

  private buildDashboardTrend(
    range: { from: Date; to: Date },
    orders: Array<{
      completedAt: Date;
      totalAmount: Prisma.Decimal;
    }>,
  ) {
    const fromDay = this.formatManilaDateInput(range.from);
    const toDay = this.formatManilaDateInput(range.to);

    if (fromDay === toDay) {
      const hourlyMap = new Map<
        number,
        { netSales: Prisma.Decimal; transactionCount: number }
      >();

      for (let hour = 0; hour < 24; hour += 1) {
        hourlyMap.set(hour, {
          netSales: ZERO,
          transactionCount: 0,
        });
      }

      for (const order of orders) {
        const hour = this.getManilaHour(order.completedAt);
        const current = hourlyMap.get(hour) ?? {
          netSales: ZERO,
          transactionCount: 0,
        };
        current.netSales = current.netSales.plus(order.totalAmount);
        current.transactionCount += 1;
        hourlyMap.set(hour, current);
      }

      return {
        granularity: 'hourly' as const,
        points: [...hourlyMap.entries()].map(([hour, value]) => ({
          bucketKey: `hour:${hour}`,
          label: this.formatHourLabel(hour),
          netSales: value.netSales,
          transactionCount: value.transactionCount,
        })),
      };
    }

    const dayKeys: string[] = [];
    let currentDay = fromDay;
    while (currentDay <= toDay) {
      dayKeys.push(currentDay);
      currentDay = this.shiftManilaDateInput(currentDay, 1);
    }

    const dailyMap = new Map<
      string,
      { label: string; netSales: Prisma.Decimal; transactionCount: number }
    >(
      dayKeys.map((dayKey) => [
        dayKey,
        {
          label: this.formatShortManilaDateLabel(dayKey),
          netSales: ZERO,
          transactionCount: 0,
        },
      ]),
    );

    for (const order of orders) {
      const dayKey = this.formatManilaDateInput(order.completedAt);
      const current = dailyMap.get(dayKey);
      if (!current) {
        continue;
      }

      current.netSales = current.netSales.plus(order.totalAmount);
      current.transactionCount += 1;
    }

    return {
      granularity: 'daily' as const,
      points: dayKeys.map((dayKey) => {
        const point = dailyMap.get(dayKey)!;
        return {
          bucketKey: `day:${dayKey}`,
          label: point.label,
          netSales: point.netSales,
          transactionCount: point.transactionCount,
        };
      }),
    };
  }

  private calculateGrowthRate(
    currentValue: Prisma.Decimal,
    previousValue: Prisma.Decimal,
  ) {
    if (previousValue.equals(ZERO)) {
      return null;
    }

    return currentValue
      .minus(previousValue)
      .dividedBy(previousValue)
      .toNumber();
  }

  private groupSalesAnalytics(
    groupBy: 'daily' | 'weekly' | 'monthly',
    orders: Array<{
      subtotalAmount: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      totalAmount: Prisma.Decimal;
      completedAt: Date;
    }>,
    refunds: Array<{
      amount: Prisma.Decimal;
      occurredAt: Date;
    }>,
  ) {
    const bucketMap = new Map<
      string,
      {
        bucketKey: string;
        label: string;
        sortKey: string;
        grossSales: Prisma.Decimal;
        netSales: Prisma.Decimal;
        discounts: Prisma.Decimal;
        refunds: Prisma.Decimal;
        transactionCount: number;
      }
    >();

    for (const order of orders) {
      const bucket = this.getSalesBucket(order.completedAt, groupBy);
      const current = bucketMap.get(bucket.bucketKey) ?? {
        ...bucket,
        grossSales: ZERO,
        netSales: ZERO,
        discounts: ZERO,
        refunds: ZERO,
        transactionCount: 0,
      };
      current.grossSales = current.grossSales.plus(order.subtotalAmount);
      current.netSales = current.netSales.plus(order.totalAmount);
      current.discounts = current.discounts.plus(order.discountAmount);
      current.transactionCount += 1;
      bucketMap.set(bucket.bucketKey, current);
    }

    for (const refund of refunds) {
      const bucket = this.getSalesBucket(refund.occurredAt, groupBy);
      const current = bucketMap.get(bucket.bucketKey) ?? {
        ...bucket,
        grossSales: ZERO,
        netSales: ZERO,
        discounts: ZERO,
        refunds: ZERO,
        transactionCount: 0,
      };
      current.refunds = current.refunds.plus(refund.amount);
      bucketMap.set(bucket.bucketKey, current);
    }

    return [...bucketMap.values()]
      .sort((left, right) => left.sortKey.localeCompare(right.sortKey))
      .map((bucket) => ({
        bucketKey: bucket.bucketKey,
        label: bucket.label,
        grossSales: bucket.grossSales,
        netSales: bucket.netSales,
        discounts: bucket.discounts,
        refunds: bucket.refunds,
        transactionCount: bucket.transactionCount,
        averageTicketSize:
          bucket.transactionCount > 0
            ? bucket.netSales.dividedBy(bucket.transactionCount)
            : ZERO,
      }));
  }

  private getTopProduct(
    orders: Array<{
      items: Array<{
        productNameSnapshot: string;
        quantity: number;
        lineSubtotal: Prisma.Decimal;
      }>;
    }>,
  ) {
    const productMap = new Map<
      string,
      { productName: string; quantitySold: number; revenue: Prisma.Decimal }
    >();

    for (const order of orders) {
      for (const item of order.items) {
        const current = productMap.get(item.productNameSnapshot) ?? {
          productName: item.productNameSnapshot,
          quantitySold: 0,
          revenue: ZERO,
        };

        current.quantitySold += item.quantity;
        current.revenue = current.revenue.plus(item.lineSubtotal);
        productMap.set(item.productNameSnapshot, current);
      }
    }

    return (
      [...productMap.values()].sort((left, right) => {
        if (right.quantitySold !== left.quantitySold) {
          return right.quantitySold - left.quantitySold;
        }

        return right.revenue.comparedTo(left.revenue);
      })[0] ?? null
    );
  }

  private getSalesBucket(date: Date, groupBy: 'daily' | 'weekly' | 'monthly') {
    const dayKey = this.formatManilaDateInput(date);

    if (groupBy === 'weekly') {
      const weekStart = this.getManilaWeekStart(dayKey);
      const weekEnd = this.shiftManilaDateInput(weekStart, 6);
      return {
        bucketKey: `week:${weekStart}`,
        label: `${weekStart} to ${weekEnd}`,
        sortKey: weekStart,
      };
    }

    if (groupBy === 'monthly') {
      const monthKey = dayKey.slice(0, 7);
      return {
        bucketKey: `month:${monthKey}`,
        label: this.formatManilaMonthLabel(monthKey),
        sortKey: `${monthKey}-01`,
      };
    }

    return {
      bucketKey: `day:${dayKey}`,
      label: dayKey,
      sortKey: dayKey,
    };
  }

  private formatManilaDateInput(date: Date) {
    return formatManilaBusinessDateInput(date);
  }

  private parseManilaDateInput(value: string) {
    return parseBusinessDateToDateOnlyUtc(value);
  }

  private shiftManilaDateInput(value: string, offsetDays: number) {
    return shiftManilaBusinessDateInput(value, offsetDays);
  }

  private getManilaWeekStart(value: string) {
    return getManilaWeekStartBusinessDate(value);
  }

  private formatManilaMonthLabel(monthKey: string) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: MANILA_TIMEZONE,
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${monthKey}-15T12:00:00${MANILA_OFFSET}`));
  }

  private formatShortManilaDateLabel(dayKey: string) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: MANILA_TIMEZONE,
      month: 'short',
      day: 'numeric',
    }).format(new Date(`${dayKey}T12:00:00${MANILA_OFFSET}`));
  }

  private getManilaHour(date: Date) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: MANILA_TIMEZONE,
      hour: '2-digit',
      hour12: false,
    });
    return Number(formatter.format(date));
  }

  private formatHourLabel(hour: number) {
    const normalizedHour = hour % 24;
    const suffix = normalizedHour >= 12 ? 'PM' : 'AM';
    const displayHour = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12;
    return `${displayHour}:00 ${suffix}`;
  }

  private matchesPeakDayType(date: Date, dayType: 'weekday' | 'weekend') {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: MANILA_TIMEZONE,
      weekday: 'short',
    });
    const weekday = formatter.format(date);
    const isWeekend = weekday === 'Sat' || weekday === 'Sun';
    return dayType === 'weekend' ? isWeekend : !isWeekend;
  }

  private getOverlappingRangeDurationMs(
    range: { from: Date; to: Date },
    startedAt: Date,
    endedAt: Date | null,
  ) {
    const rangeStartMs = range.from.getTime();
    const rangeEndExclusiveMs = range.to.getTime() + 1;
    const overlapStartMs = Math.max(rangeStartMs, startedAt.getTime());
    const overlapEndMs = Math.min(
      rangeEndExclusiveMs,
      endedAt ? endedAt.getTime() : rangeEndExclusiveMs,
    );

    return Math.max(overlapEndMs - overlapStartMs, 0);
  }

  private calculateVariantAvailabilityMetrics(
    events: Array<{
      occurredAt: Date;
      newIsSellable: boolean;
    }>,
    range: { from: Date; to: Date },
  ) {
    const rangeStartMs = range.from.getTime();
    const rangeEndExclusiveMs = range.to.getTime() + 1;
    let baselineIndex = -1;
    let eventCount = 0;

    for (let index = 0; index < events.length; index += 1) {
      const eventMs = events[index].occurredAt.getTime();
      if (eventMs <= rangeStartMs) {
        baselineIndex = index;
      }
      if (eventMs >= rangeStartMs && eventMs <= range.to.getTime()) {
        eventCount += 1;
      }
    }

    if (baselineIndex < 0) {
      return {
        trackedFromRangeStart: false,
        trackedDurationMs: 0,
        sellableDurationMs: 0,
        downtimeDurationMs: 0,
        eventCount,
      };
    }

    let currentState = events[baselineIndex].newIsSellable;
    let cursorMs = rangeStartMs;
    let trackedDurationMs = 0;
    let sellableDurationMs = 0;

    for (let index = baselineIndex + 1; index < events.length; index += 1) {
      const eventMs = events[index].occurredAt.getTime();
      if (eventMs <= rangeStartMs) {
        continue;
      }
      if (eventMs >= rangeEndExclusiveMs) {
        break;
      }

      const segmentDurationMs = Math.max(eventMs - cursorMs, 0);
      trackedDurationMs += segmentDurationMs;
      if (currentState) {
        sellableDurationMs += segmentDurationMs;
      }

      currentState = events[index].newIsSellable;
      cursorMs = eventMs;
    }

    const remainingDurationMs = Math.max(rangeEndExclusiveMs - cursorMs, 0);
    trackedDurationMs += remainingDurationMs;
    if (currentState) {
      sellableDurationMs += remainingDurationMs;
    }

    return {
      trackedFromRangeStart: true,
      trackedDurationMs,
      sellableDurationMs,
      downtimeDurationMs: Math.max(trackedDurationMs - sellableDurationMs, 0),
      eventCount,
    };
  }

  private convertMillisecondsToHours(value: number) {
    return new Prisma.Decimal(value).dividedBy(60 * 60 * 1000);
  }

  private getJsonString(metadata: Prisma.JsonValue | null, key: string) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return null;
    }

    const value = metadata[key];
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }
}
