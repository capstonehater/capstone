// Read-only comparison against a Git revision containing the previous reports.
// Usage: node scripts/verify-report-optimization.cjs <baseline-git-ref> [--benchmark]
require('dotenv').config({ quiet: true });
require('ts-node/register/transpile-only');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const { performance } = require('node:perf_hooks');
const { PrismaClient } = require('@prisma/client');
const { ReportsService } = require('../src/reports/reports.service');
const { OrdersService } = require('../src/orders/orders.service');

const baselineRef = process.argv[2];
if (!baselineRef || baselineRef.startsWith('-')) {
  console.error('Pass the Git revision containing the previous reports as the first argument.');
  process.exit(1);
}
const source = execFileSync('git', ['show', `${baselineRef}:ims-backend/src/reports/reports.service.ts`], {
  encoding: 'utf8', cwd: path.resolve(__dirname, '../..'),
});
const filename = path.resolve(__dirname, '../src/reports/baseline-report-comparison.cjs');
const baselineModule = new Module(filename, module);
baselineModule.filename = filename;
baselineModule.paths = Module._nodeModulePaths(path.dirname(filename));
baselineModule._compile(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023,
    experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true },
}).outputText, filename);

function normalize(result) {
  const value = JSON.parse(JSON.stringify(result));
  // Payment group order is not part of the API contract.
  if (value.paymentBreakdown) value.paymentBreakdown.sort((a, b) => a.method.localeCompare(b.method));
  return value;
}

function differingPaths(actual, expected, prefix = '') {
  if (JSON.stringify(actual) === JSON.stringify(expected)) return [];
  if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object') return [prefix];
  return [...new Set([...Object.keys(actual), ...Object.keys(expected)])]
    .flatMap((key) => differingPaths(actual[key], expected[key], `${prefix}.${key}`));
}

const prisma = new PrismaClient();
async function main() {
  // Reject writes, and keep both implementations on the same data snapshot.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const bounds = await tx.order.aggregate({ _min: { completedAt: true }, _max: { completedAt: true }, _count: { _all: true } });
    const from = bounds._min.completedAt ?? new Date('2026-01-01T00:00:00Z');
    const to = bounds._max.completedAt ?? new Date('2026-01-02T00:00:00Z');
    const range = { from: from.toISOString(), to: to.toISOString(), limit: 5 };
    const empty = { from: '1900-01-01T00:00:00Z', to: '1900-01-02T00:00:00Z', limit: 5 };
    const orders = { getDisplayOrderNumber: OrdersService.prototype.getDisplayOrderNumber };
    const baseline = new baselineModule.exports.ReportsService(tx, {}, orders);
    const optimized = new ReportsService(tx, {}, orders);
    const cases = [];
    for (const method of ['getSalesOverview', 'getVariantMargin', 'getPosDashboard', 'getPosPeakHours', 'getPosSalesAnalytics']) {
      cases.push([method, range, 'full history'], [method, empty, 'empty range']);
    }
    for (const groupBy of ['daily', 'weekly', 'monthly']) {
      cases.push(['getPosSalesAnalytics', { ...range, groupBy }, groupBy]);
    }
    for (const dayType of ['weekday', 'weekend']) {
      cases.push(['getPosPeakHours', { ...range, dayType }, dayType]);
    }
    for (const paymentMethod of ['CASH', 'CARD', 'GCASH', 'MAYA', 'OTHER']) {
      cases.push(['getPosSalesAnalytics', { ...range, paymentMethod }, paymentMethod]);
    }
    const user = await tx.user.findFirst({ where: { createdOrders: { some: {} } }, select: { firstName: true } });
    for (const staffSearch of [user?.firstName ?? 'missing-person', "' OR 1=1 --", 'no-matching-staff-optimization-check']) {
      cases.push(['getPosSalesAnalytics', { ...range, staffSearch }, 'staff filter']);
    }
    // Partial Manila days exercise grouping when a period starts mid-day.
    const boundaryRange = { from: '2026-09-01T15:59:59.999Z', to: '2026-09-03T16:00:00.000Z' };
    cases.push(['getPosSalesAnalytics', boundaryRange, 'Manila midnight'],
      ['getPosPeakHours', boundaryRange, 'Manila midnight']);
    for (const method of ['getSalesOverview', 'getVariantMargin']) {
      cases.push([method, {}, 'unbounded dates'],
        [method, { from: range.from }, 'from only'],
        [method, { to: range.to, limit: 50 }, 'to only, maximum limit']);
    }
    cases.push(['getPosSalesAnalytics', { ...range, staffSearch: ` ${user?.firstName ?? 'missing-person'} `, paymentMethod: 'CASH' }, 'combined filters']);
    let comparisonsPassed = 0;
    for (const [method, filters, label] of cases) {
      const oldResult = normalize(await baseline[method](filters));
      const newResult = normalize(await optimized[method](filters));
      try { assert.deepStrictEqual(newResult, oldResult); }
      catch { throw new Error(`Report comparison failed: ${method} (${label}); differing fields: ${differingPaths(newResult, oldResult).slice(0, 12).join(', ')}. Values omitted to protect customer data.`); }
      comparisonsPassed++;
    }
    // Changing session timezone must never change UTC predicates or Manila buckets.
    for (const zone of ['UTC', 'America/New_York']) {
      await tx.$queryRaw`SELECT set_config('TimeZone', ${zone}, true)`;
      for (const method of ['getSalesOverview', 'getPosSalesAnalytics', 'getPosPeakHours']) {
        try { assert.deepStrictEqual(normalize(await optimized[method](range)), normalize(await baseline[method](range))); }
        catch { throw new Error(`Timezone comparison failed: ${method} (${zone}).`); }
        comparisonsPassed++;
      }
    }
    console.log(JSON.stringify({ orders: bounds._count._all, comparisonsPassed }));
    const history = new OrdersService(
      { order: tx.order, $transaction: (operations) => Promise.all(operations) },
      {}, {}, {}, {}, {}, {}, {}, {},
    );
    const expectedHistory = await tx.order.findMany({
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }], take: 60, select: { id: true },
    });
    const collectedIds = [];
    let cursor;
    for (let page = 1; page <= 3; page++) {
      const result = await history.listOrders({ page, pageSize: 20, cursor });
      assert.ok(result.orders.length <= 20, 'History page exceeded its limit');
      assert.equal(result.pagination.total, bounds._count._all);
      collectedIds.push(...result.orders.map((row) => row.id));
      cursor = result.orders.at(-1)?.id;
      if (!cursor) break;
    }
    try { assert.deepStrictEqual(collectedIds, expectedHistory.map((row) => row.id)); }
    catch { throw new Error('Real database cursor pagination lost or duplicated history rows.'); }
    console.log(JSON.stringify({ cursorPaginationPassed: true, historyRowsChecked: collectedIds.length }));
    if (process.argv.includes('--benchmark')) {
      for (const method of ['getSalesOverview', 'getVariantMargin', 'getPosDashboard', 'getPosPeakHours', 'getPosSalesAnalytics']) {
        const samples = { baseline: [], optimized: [] };
        for (let trial = 0; trial < 5; trial++) {
          for (const [name, service] of [['baseline', baseline], ['optimized', optimized]]) {
            const started = performance.now();
            await service[method](range);
            samples[name].push(performance.now() - started);
          }
        }
        const median = (values) => Number(values.sort((a, b) => a - b)[2].toFixed(2));
        console.log(JSON.stringify({ method, baselineMedianMs: median(samples.baseline), optimizedMedianMs: median(samples.optimized) }));
      }
    }
  }, { isolationLevel: 'RepeatableRead', timeout: 120000 });
}
main().catch((error) => {
  console.error(error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[database URL]'));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
