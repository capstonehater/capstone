const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const runs = await prisma.stockRun.findMany({ select: { id: true, reference: true } });
  assert(runs.every(r => /^ST-RUN-\d{8}-\d{3,}$/.test(r.reference)));
  const batches = await prisma.stockBatch.findMany({ where: { stockRunItemId: { not: null } }, include: { stockRunItem: { include: { stockRun: true } } } });
  assert(batches.every(b => b.reference.startsWith(b.stockRunItem.stockRun.reference + '-B')));
  const original = await prisma.stockRunReferenceCounter.findMany();
  let generated;
  try {
    await prisma.$transaction(async tx => {
      const first = await tx.$queryRawUnsafe('SELECT next_stock_run_reference() AS reference');
      const second = await tx.$queryRawUnsafe('SELECT next_stock_run_reference() AS reference');
      assert.notEqual(first[0].reference, second[0].reference);
      assert.equal(Number(second[0].reference.split('-').at(-1)), Number(first[0].reference.split('-').at(-1)) + 1);
      generated = [first[0].reference, second[0].reference];
      throw new Error('ROLLBACK_VERIFICATION');
    });
  } catch (error) { if (error.message !== 'ROLLBACK_VERIFICATION') throw error; }
  assert.deepEqual(await prisma.stockRunReferenceCounter.findMany(), original);
  // Competing transactions must serialize on the daily counter, even before commit.
  let release, entered;
  const hold = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { entered = resolve; });
  const first = prisma.$transaction(async tx => {
    const result = await tx.$queryRawUnsafe('SELECT next_stock_run_reference() AS reference');
    entered(); await hold; throw new Error('ROLLBACK_VERIFICATION');
  }).catch(error => { if (error.message !== 'ROLLBACK_VERIFICATION') throw error; });
  await ready;
  let finished = false;
  const second = prisma.$transaction(async tx => {
    await tx.$queryRawUnsafe('SELECT next_stock_run_reference() AS reference');
    finished = true; throw new Error('ROLLBACK_VERIFICATION');
  }).catch(error => { if (error.message !== 'ROLLBACK_VERIFICATION') throw error; });
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(finished, false); release(); await Promise.all([first, second]);
  assert.equal(finished, true);
  assert.deepEqual(await prisma.stockRunReferenceCounter.findMany(), original);
  console.log(JSON.stringify({ runsChecked: runs.length, batchesChecked: batches.length, generated, rollback: 'passed', concurrentAllocation: 'passed' }));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
