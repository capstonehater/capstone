import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  InventorySourceType,
  InventoryTransactionType,
  OrderStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();
const ZERO = new Prisma.Decimal(0);

function expect(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function expectApprox(actual: Prisma.Decimal, expected: number, label: string, tolerance = 0.01) {
  const actualNumber = Number(actual.toString());
  if (Math.abs(actualNumber - expected) > tolerance) {
    throw new Error(`${label} expected ${expected.toFixed(2)} but received ${actualNumber.toFixed(2)}`);
  }
}

async function calculateKpiRange(from: string, to: string) {
  const [orders, lines] = await Promise.all([
    prisma.order.aggregate({
      where: {
        status: OrderStatus.COMPLETED,
        completedAt: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
      _sum: {
        totalAmount: true,
        totalCogsAmount: true,
      },
    }),
    prisma.inventoryTransactionLine.findMany({
      where: {
        inventoryTransaction: {
          type: {
            in: [InventoryTransactionType.CHECKOUT, InventoryTransactionType.WASTE],
          },
          occurredAt: {
            gte: new Date(from),
            lte: new Date(to),
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
  ]);

  let checkoutCost = ZERO;
  let wasteCost = ZERO;

  for (const line of lines) {
    const absoluteCost = new Prisma.Decimal(line.totalCostDelta).abs();

    if (line.inventoryTransaction.type === InventoryTransactionType.CHECKOUT) {
      checkoutCost = checkoutCost.plus(absoluteCost);
    } else if (line.inventoryTransaction.type === InventoryTransactionType.WASTE) {
      wasteCost = wasteCost.plus(absoluteCost);
    }
  }

  const revenue = orders._sum.totalAmount ?? ZERO;
  const cogs = orders._sum.totalCogsAmount ?? ZERO;
  const totalInventoryUsedCost = checkoutCost.plus(wasteCost);

  return {
    revenue,
    cogs,
    foodCostPercentage: revenue.greaterThan(0) ? cogs.dividedBy(revenue).mul(100) : null,
    wastePercentage: totalInventoryUsedCost.greaterThan(0)
      ? wasteCost.dividedBy(totalInventoryUsedCost).mul(100)
      : null,
  };
}

async function main() {
  const fullRange = await calculateKpiRange(
    '2036-04-01T00:00:00.000+08:00',
    '2036-04-02T23:59:59.999+08:00',
  );
  const dayOneRange = await calculateKpiRange(
    '2036-04-01T00:00:00.000+08:00',
    '2036-04-01T23:59:59.999+08:00',
  );
  const dayTwoRange = await calculateKpiRange(
    '2036-04-02T00:00:00.000+08:00',
    '2036-04-02T23:59:59.999+08:00',
  );

  expectApprox(fullRange.revenue, 3300, 'Full-range revenue');
  expectApprox(fullRange.cogs, 1300, 'Full-range COGS');
  expectApprox(fullRange.foodCostPercentage ?? ZERO, 39.3939, 'Full-range food cost %');
  expectApprox(fullRange.wastePercentage ?? ZERO, 28.5714, 'Full-range waste %');

  expectApprox(dayOneRange.revenue, 2500, 'Apr 1 revenue');
  expectApprox(dayOneRange.cogs, 1000, 'Apr 1 COGS');
  expectApprox(dayOneRange.foodCostPercentage ?? ZERO, 40, 'Apr 1 food cost %');
  expectApprox(dayOneRange.wastePercentage ?? ZERO, 28.5714, 'Apr 1 waste %');

  expectApprox(dayTwoRange.revenue, 800, 'Apr 2 revenue');
  expectApprox(dayTwoRange.cogs, 300, 'Apr 2 COGS');
  expectApprox(dayTwoRange.foodCostPercentage ?? ZERO, 37.5, 'Apr 2 food cost %');
  expect(dayTwoRange.wastePercentage === null, 'Apr 2 waste % should be null');

  const milkFilteredLines = await prisma.inventoryTransactionLine.findMany({
    where: {
      inventoryTransaction: {
        type: InventoryTransactionType.CHECKOUT,
        sourceType: InventorySourceType.ORDER,
        occurredAt: {
          gte: new Date('2036-04-01T00:00:00.000+08:00'),
          lte: new Date('2036-04-02T23:59:59.999+08:00'),
        },
      },
      OR: [
        {
          rawMaterial: {
            name: {
              contains: 'milk',
              mode: 'insensitive',
            },
          },
        },
        {
          rawMaterial: {
            sku: {
              contains: 'milk',
              mode: 'insensitive',
            },
          },
        },
      ],
    },
    include: {
      rawMaterial: true,
    },
  });

  expect(milkFilteredLines.length === 1, 'Milk material filter should match one checkout line');
  expect(
    milkFilteredLines[0]?.rawMaterial.name.includes('Milk'),
    'Milk material filter should resolve to the milk sample row',
  );
  expectApprox(
    new Prisma.Decimal(milkFilteredLines[0]?.totalCostDelta ?? 0).abs(),
    300,
    'Milk filtered checkout cost',
  );

  const exportSource = readFileSync(
    join(process.cwd(), '..', 'ims-frontend', 'src', 'lib', 'report-exports.ts'),
    'utf8',
  );

  expect(
    exportSource.includes('export function exportInventoryReportsCsv'),
    'Inventory Reports CSV export function should exist',
  );
  expect(exportSource.includes('KPI Summary'), 'Export source should include KPI Summary section');
  expect(
    exportSource.includes('Inventory-Linked Sales Consumption Summary'),
    'Export source should include inventory-linked export section',
  );

  const removedLegacySections = [
    'export function exportBusinessReportsCsv',
    'Active Operational Alerts',
    'Variant Margin',
    'Recent Orders',
    'Inventory Health Summary',
    'Stock-Run Spend by Supplier',
    'Waste Summary by Material',
  ];

  for (const title of removedLegacySections) {
    expect(!exportSource.includes(title), `Export source should not include legacy section: ${title}`);
  }

  console.log('Inventory Reports Phase 1 validation passed.');
  console.log('Food Cost % = 39.39%, Waste % = 28.57%, Manila date filters verified.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
