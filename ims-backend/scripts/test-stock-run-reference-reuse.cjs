/* Integration check: all test stock runs and counter changes are rolled back. */
const assert = require('node:assert/strict');
require('dotenv').config({ quiet: true });
const { PrismaClient, StockRunStatus } = require('@prisma/client');
const prisma = new PrismaClient();
const rollback = new Error('ROLLBACK_REFERENCE_REUSE_TEST');

async function main() {
  try {
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('stock-run-draft-limit'))`;
      const user = await tx.user.findFirst({ select: { id: true } });
      assert.ok(user, 'An existing user is required for this rollback-only test');
      const create = () => tx.stockRun.create({ data: { name: 'Reference reuse integration test', createdByUserId: user.id } });
      const first = await create();
      await tx.stockRun.delete({ where: { id: first.id } });
      const replacement = await create();
      assert.equal(replacement.reference, first.reference, 'Deleted draft number must be reused');
      await tx.stockRun.update({ where: { id: replacement.id }, data: { status: StockRunStatus.POSTED } });
      const next = await create();
      const suffix = value => BigInt(value.split('-')[3]);
      assert.equal(suffix(next.reference), suffix(replacement.reference) + 1n, 'Posted run consumes its number');
      await tx.stockRun.delete({ where: { id: next.id } });
      const reused = await create();
      assert.equal(reused.reference, next.reference, 'Newest unfinished draft can be replaced without incrementing');
      const newer = await create();
      await tx.stockRun.delete({ where: { id: reused.id } });
      const afterMiddleDeletion = await create();
      assert.equal(suffix(afterMiddleDeletion.reference), suffix(newer.reference) + 1n, 'Deleting an older draft must not collide with a surviving newer run');
      const posted = await tx.stockRun.findUnique({ where: { id: replacement.id } });
      assert.equal(posted.reference, replacement.reference, 'Existing posted reference must remain unchanged');
      throw rollback;
    }, { timeout: 15000 });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log('PASS: deleted draft number reuse, posted numbering, and collision protection. All test data rolled back.');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
