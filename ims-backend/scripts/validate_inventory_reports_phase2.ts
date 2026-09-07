import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { ReportsService } from '../src/reports/reports.service';

const prisma = new PrismaClient();
const ZERO = new Prisma.Decimal(0);

const SAMPLE = {
  materials: {
    beans: 'inventory_reports_phase2_material_beans',
    milk: 'inventory_reports_phase2_material_milk',
  },
  variants: {
    espresso: 'inventory_reports_phase2_variant_espresso',
    latte: 'inventory_reports_phase2_variant_latte',
    mocha: 'inventory_reports_phase2_variant_mocha',
  },
};

function expect(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function expectApprox(
  actual: Prisma.Decimal | null | undefined,
  expected: number,
  label: string,
  tolerance = 0.01,
) {
  if (!actual) {
    throw new Error(`${label} expected ${expected.toFixed(2)} but received null`);
  }

  const actualNumber = Number(actual.toString());
  if (Math.abs(actualNumber - expected) > tolerance) {
    throw new Error(
      `${label} expected ${expected.toFixed(2)} but received ${actualNumber.toFixed(2)}`,
    );
  }
}

function overlapDurationMs(
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

function calculateVariantAvailabilityMetrics(
  events: Array<{ occurredAt: Date; newIsSellable: boolean }>,
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

async function computeExpectedAvailabilityMetrics(range: { from: Date; to: Date }) {
  const [activeRawMaterials, activeVariants, topSellingOrderItems] = await Promise.all([
    prisma.rawMaterial.findMany({
      where: { isActive: true },
      select: { id: true },
    }),
    prisma.productVariant.findMany({
      where: {
        isEnabled: true,
        product: {
          isEnabled: true,
        },
      },
      select: { id: true },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          status: 'COMPLETED',
          completedAt: {
            gte: range.from,
            lte: range.to,
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
          },
        },
      },
    }),
  ]);

  const topSellerMap = new Map<
    string,
    { productVariantId: string; quantitySold: number; revenue: Prisma.Decimal }
  >();

  for (const orderItem of topSellingOrderItems) {
    if (!orderItem.productVariant) {
      continue;
    }

    const current = topSellerMap.get(orderItem.productVariantId) ?? {
      productVariantId: orderItem.productVariantId,
      quantitySold: 0,
      revenue: ZERO,
    };
    current.quantitySold += orderItem.quantity;
    current.revenue = current.revenue.plus(orderItem.lineSubtotal);
    topSellerMap.set(orderItem.productVariantId, current);
  }

  const topSellingVariantIds = [...topSellerMap.values()]
    .sort((left, right) => {
      if (right.quantitySold !== left.quantitySold) {
        return right.quantitySold - left.quantitySold;
      }
      return right.revenue.comparedTo(left.revenue);
    })
    .slice(0, 5)
    .map((row) => row.productVariantId);

  const variantIdsForHistory = [
    ...new Set([
      ...activeVariants.map((variant) => variant.id),
      ...topSellingVariantIds,
    ]),
  ];

  const [stockoutEvents, variantEvents] = await Promise.all([
    prisma.stockoutEvent.findMany({
      where: {
        rawMaterialId: {
          in: activeRawMaterials.map((material) => material.id),
        },
        startedAt: {
          lte: range.to,
        },
        OR: [
          { endedAt: null },
          {
            endedAt: {
              gte: range.from,
            },
          },
        ],
      },
      select: {
        rawMaterialId: true,
        startedAt: true,
        endedAt: true,
      },
    }),
    prisma.variantAvailabilityEvent.findMany({
      where: {
        productVariantId: {
          in: variantIdsForHistory,
        },
        occurredAt: {
          lte: range.to,
        },
      },
      select: {
        productVariantId: true,
        occurredAt: true,
        newIsSellable: true,
      },
      orderBy: [{ productVariantId: 'asc' }, { occurredAt: 'asc' }],
    }),
  ]);

  const rangeDurationMs = range.to.getTime() - range.from.getTime() + 1;
  const totalStockoutDurationMs = stockoutEvents.reduce((sum, event) => {
    return sum + overlapDurationMs(range, event.startedAt, event.endedAt);
  }, 0);

  const variantEventsByVariantId = new Map<
    string,
    Array<{ occurredAt: Date; newIsSellable: boolean }>
  >();
  for (const event of variantEvents) {
    const rows = variantEventsByVariantId.get(event.productVariantId) ?? [];
    rows.push({
      occurredAt: event.occurredAt,
      newIsSellable: event.newIsSellable,
    });
    variantEventsByVariantId.set(event.productVariantId, rows);
  }

  const trackedVariantMetrics = activeVariants
    .map((variant) =>
      calculateVariantAvailabilityMetrics(
        variantEventsByVariantId.get(variant.id) ?? [],
        range,
      ),
    )
    .filter((metrics) => metrics.trackedFromRangeStart && metrics.trackedDurationMs > 0);

  const totalTrackedVariantDurationMs = trackedVariantMetrics.reduce(
    (sum, metrics) => sum + metrics.trackedDurationMs,
    0,
  );
  const totalTrackedVariantSellableMs = trackedVariantMetrics.reduce(
    (sum, metrics) => sum + metrics.sellableDurationMs,
    0,
  );

  const trackedTopSellerMetrics = topSellingVariantIds
    .map((variantId) =>
      calculateVariantAvailabilityMetrics(
        variantEventsByVariantId.get(variantId) ?? [],
        range,
      ),
    )
    .filter((metrics) => metrics.trackedFromRangeStart && metrics.trackedDurationMs > 0);

  const totalTrackedTopSellerDurationMs = trackedTopSellerMetrics.reduce(
    (sum, metrics) => sum + metrics.trackedDurationMs,
    0,
  );
  const totalTrackedTopSellerSellableMs = trackedTopSellerMetrics.reduce(
    (sum, metrics) => sum + metrics.sellableDurationMs,
    0,
  );

  return {
    stockoutRatePercentage:
      activeRawMaterials.length > 0
        ? new Prisma.Decimal(totalStockoutDurationMs)
            .dividedBy(activeRawMaterials.length * rangeDurationMs)
            .mul(100)
        : null,
    menuItemAvailabilityRate:
      totalTrackedVariantDurationMs > 0
        ? new Prisma.Decimal(totalTrackedVariantSellableMs)
            .dividedBy(totalTrackedVariantDurationMs)
            .mul(100)
        : null,
    topSellingItemAvailabilityPercentage:
      totalTrackedTopSellerDurationMs > 0
        ? new Prisma.Decimal(totalTrackedTopSellerSellableMs)
            .dividedBy(totalTrackedTopSellerDurationMs)
            .mul(100)
        : null,
  };
}

async function main() {
  const prismaService = new PrismaService();
  await prismaService.$connect();
  const reportsService = new ReportsService(prismaService, null as never, null as never);

  try {
    const fullRange = {
      from: '2036-05-01T00:00:00.000+08:00',
      to: '2036-05-02T23:59:59.999+08:00',
    };
    const dayOneRange = {
      from: '2036-05-01T00:00:00.000+08:00',
      to: '2036-05-01T23:59:59.999+08:00',
    };
    const dayTwoRange = {
      from: '2036-05-02T00:00:00.000+08:00',
      to: '2036-05-02T23:59:59.999+08:00',
    };

    const [fullReport, dayOneReport, dayTwoReport] = await Promise.all([
      reportsService.getInventoryAvailabilityRisk(fullRange),
      reportsService.getInventoryAvailabilityRisk(dayOneRange),
      reportsService.getInventoryAvailabilityRisk(dayTwoRange),
    ]);

    const [expectedFull, expectedDayOne, expectedDayTwo] = await Promise.all([
      computeExpectedAvailabilityMetrics({
        from: new Date(fullRange.from),
        to: new Date(fullRange.to),
      }),
      computeExpectedAvailabilityMetrics({
        from: new Date(dayOneRange.from),
        to: new Date(dayOneRange.to),
      }),
      computeExpectedAvailabilityMetrics({
        from: new Date(dayTwoRange.from),
        to: new Date(dayTwoRange.to),
      }),
    ]);

    expect(
      fullReport.definitions.stockoutRate.includes('percentage of total tracked raw-material time'),
      'Phase 2 validation expects stockout rate to be implemented as percentage of tracked material time out of stock.',
    );

    expectApprox(
      fullReport.summary.stockoutRatePercentage,
      Number((expectedFull.stockoutRatePercentage ?? ZERO).toString()),
      'Full-range stockout rate',
    );
    expectApprox(
      dayOneReport.summary.stockoutRatePercentage,
      Number((expectedDayOne.stockoutRatePercentage ?? ZERO).toString()),
      'Day-one stockout rate',
    );
    expectApprox(
      dayTwoReport.summary.stockoutRatePercentage,
      Number((expectedDayTwo.stockoutRatePercentage ?? ZERO).toString()),
      'Day-two stockout rate',
    );

    expectApprox(
      fullReport.summary.menuItemAvailabilityRate,
      Number((expectedFull.menuItemAvailabilityRate ?? ZERO).toString()),
      'Full-range menu item availability rate',
    );
    expectApprox(
      dayOneReport.summary.menuItemAvailabilityRate,
      Number((expectedDayOne.menuItemAvailabilityRate ?? ZERO).toString()),
      'Day-one menu item availability rate',
    );
    expectApprox(
      dayTwoReport.summary.menuItemAvailabilityRate,
      Number((expectedDayTwo.menuItemAvailabilityRate ?? ZERO).toString()),
      'Day-two menu item availability rate',
    );

    expectApprox(
      fullReport.summary.topSellingItemAvailabilityPercentage,
      Number((expectedFull.topSellingItemAvailabilityPercentage ?? ZERO).toString()),
      'Full-range top-selling item availability',
    );
    expectApprox(
      dayOneReport.summary.topSellingItemAvailabilityPercentage,
      Number((expectedDayOne.topSellingItemAvailabilityPercentage ?? ZERO).toString()),
      'Day-one top-selling item availability',
    );
    expectApprox(
      dayTwoReport.summary.topSellingItemAvailabilityPercentage,
      Number((expectedDayTwo.topSellingItemAvailabilityPercentage ?? ZERO).toString()),
      'Day-two top-selling item availability',
    );

    const topSellerIds = fullReport.topSellingVariants.map((row) => row.productVariant.id);
    expect(
      topSellerIds[0] === SAMPLE.variants.mocha &&
        topSellerIds[1] === SAMPLE.variants.espresso &&
        topSellerIds[2] === SAMPLE.variants.latte,
      'Top-selling variants should be Mocha, Espresso, then Latte for the seeded sample range.',
    );

    const espressoRow = fullReport.topSellingVariants.find(
      (row) => row.productVariant.id === SAMPLE.variants.espresso,
    );
    const latteRow = fullReport.topSellingVariants.find(
      (row) => row.productVariant.id === SAMPLE.variants.latte,
    );
    const mochaRow = fullReport.topSellingVariants.find(
      (row) => row.productVariant.id === SAMPLE.variants.mocha,
    );

    expect(espressoRow?.trackedFromRangeStart === true, 'Espresso should have baseline coverage.');
    expectApprox(espressoRow?.availabilityPercentage, 75, 'Espresso availability %');
    expectApprox(espressoRow?.sellableDurationHours, 36, 'Espresso sellable hours');
    expectApprox(espressoRow?.downtimeDurationHours, 12, 'Espresso downtime hours');

    expect(latteRow?.trackedFromRangeStart === true, 'Latte should have baseline coverage.');
    expectApprox(latteRow?.availabilityPercentage, 50, 'Latte availability %');
    expectApprox(latteRow?.sellableDurationHours, 24, 'Latte sellable hours');
    expectApprox(latteRow?.downtimeDurationHours, 24, 'Latte downtime hours');

    expect(
      mochaRow?.trackedFromRangeStart === false,
      'Mocha should be untracked without a baseline event before the range start.',
    );
    expect(
      mochaRow?.availabilityPercentage === null,
      'Mocha availability percentage should be null when baseline coverage is missing.',
    );

    const beansRow = fullReport.stockoutMaterials.find(
      (row) => row.rawMaterial.id === SAMPLE.materials.beans,
    );
    const milkRow = fullReport.stockoutMaterials.find(
      (row) => row.rawMaterial.id === SAMPLE.materials.milk,
    );

    expect(!!beansRow, 'Sample beans stockout row should appear in the full-range report.');
    expect(!!milkRow, 'Sample milk stockout row should appear in the full-range report.');
    expectApprox(beansRow?.stockoutDurationHours, 6, 'Beans stockout hours');
    expectApprox(beansRow?.stockoutRatePercentage, 12.5, 'Beans stockout rate %');
    expect(beansRow?.currentlyOutOfStock === false, 'Beans event should be closed/recovered.');
    expect(
      !!beansRow?.blockingContexts.includes('USABLE_QUANTITY_ZERO'),
      'Beans stockout row should carry the expected blocking context.',
    );

    expectApprox(milkRow?.stockoutDurationHours, 12, 'Milk stockout hours');
    expectApprox(milkRow?.stockoutRatePercentage, 25, 'Milk stockout rate %');
    expect(milkRow?.currentlyOutOfStock === true, 'Milk stockout row should still be open.');

    const dayOneBeansRow = dayOneReport.stockoutMaterials.find(
      (row) => row.rawMaterial.id === SAMPLE.materials.beans,
    );
    const dayOneMilkRow = dayOneReport.stockoutMaterials.find(
      (row) => row.rawMaterial.id === SAMPLE.materials.milk,
    );
    expectApprox(dayOneBeansRow?.stockoutDurationHours, 6, 'Day-one beans stockout hours');
    expect(!dayOneMilkRow, 'Milk stockout should not appear in the day-one window.');

    const dayTwoBeansRow = dayTwoReport.stockoutMaterials.find(
      (row) => row.rawMaterial.id === SAMPLE.materials.beans,
    );
    const dayTwoMilkRow = dayTwoReport.stockoutMaterials.find(
      (row) => row.rawMaterial.id === SAMPLE.materials.milk,
    );
    expect(!dayTwoBeansRow, 'Beans stockout should not appear in the day-two window.');
    expectApprox(dayTwoMilkRow?.stockoutDurationHours, 12, 'Day-two milk stockout hours');

    console.log('Inventory Reports Phase 2 validation passed.');
    console.log(
      'Validated event-based analytics: stockout rate (% of tracked material time out of stock), menu item availability rate, and top-selling item availability.',
    );
    console.log('Sample rows verified: Beans=6h recovered, Milk=12h open, Espresso=75%, Latte=50%, Mocha=no baseline.');
  } finally {
    await prismaService.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
