import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { ReportsService } from '../src/reports/reports.service';

const prisma = new PrismaClient();

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

async function main() {
  const prismaService = new PrismaService();
  await prismaService.$connect();
  const reportsService = new ReportsService(prismaService, null as never, null as never);

  try {
    const fullCoverageRange = {
      from: '2036-06-01T00:00:00.000+08:00',
      to: '2036-06-03T23:59:59.999+08:00',
    };
    const incompleteCoverageRange = {
      from: '2036-06-01T00:00:00.000+08:00',
      to: '2036-06-04T23:59:59.999+08:00',
    };

    const [fullReport, incompleteReport] = await Promise.all([
      reportsService.getInventoryKpiSummary(fullCoverageRange),
      reportsService.getInventoryKpiSummary(incompleteCoverageRange),
    ]);

    const groupedSnapshotTotals = await prisma.inventoryDailySnapshot.groupBy({
      by: ['snapshotDate'],
      where: {
        snapshotDate: {
          gte: new Date('2036-06-01T00:00:00.000+08:00'),
          lte: new Date('2036-06-03T00:00:00.000+08:00'),
        },
      },
      _sum: {
        inventoryValue: true,
      },
      orderBy: {
        snapshotDate: 'asc',
      },
    });

    const dailyTotals = groupedSnapshotTotals.map((row) =>
      Number((row._sum.inventoryValue ?? new Prisma.Decimal(0)).toString()),
    );
    expect(
      dailyTotals.length === 3 &&
        dailyTotals[0] === 1000 &&
        dailyTotals[1] === 800 &&
        dailyTotals[2] === 1200,
      'Snapshot totals should be 1000, 800, and 1200 for the seeded range.',
    );

    expectApprox(fullReport.totals.cogs, 2500, 'Full-range COGS');
    expect(
      fullReport.totals.expectedSnapshotDayCount === 3,
      'Full-range should expect exactly 3 snapshot days.',
    );

    if (
      fullReport.summary.inventoryTurnoverRate === null ||
      fullReport.totals.averageInventory === null ||
      fullReport.totals.snapshotDayCount !== 3
    ) {
      throw new Error(
        `Inventory Turnover validation exposed a live implementation issue: seeded full coverage exists for 2036-06-01 to 2036-06-03, but the report returned snapshotDayCount=${fullReport.totals.snapshotDayCount}, expectedSnapshotDayCount=${fullReport.totals.expectedSnapshotDayCount}, averageInventory=${fullReport.totals.averageInventory ?? 'null'}, turnover=${fullReport.summary.inventoryTurnoverRate ?? 'null'}.`,
      );
    }

    expectApprox(fullReport.totals.averageInventory, 1000, 'Full-range average inventory');
    expectApprox(fullReport.summary.inventoryTurnoverRate, 2.5, 'Full-range turnover');

    expect(
      incompleteReport.summary.inventoryTurnoverRate === null,
      'Incomplete snapshot coverage should return a null turnover rate.',
    );
    expect(
      incompleteReport.totals.averageInventory === null,
      'Incomplete snapshot coverage should return a null average inventory.',
    );
    expect(
      incompleteReport.totals.snapshotDayCount === 3,
      'Incomplete-range report should still count the 3 existing snapshot days.',
    );
    expect(
      incompleteReport.totals.expectedSnapshotDayCount === 4,
      'Incomplete-range report should expect 4 snapshot days.',
    );

    console.log('Inventory Reports Phase 3 validation passed.');
    console.log(
      'Validated turnover = COGS / average inventory using daily snapshots, with correct null fallback for incomplete snapshot coverage.',
    );
    console.log('Sample turnover: 2500 / 1000 = 2.50 for 2036-06-01 to 2036-06-03.');
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
