// Run from ims-backend: node scripts/convert-voided-orders-to-refunds.cjs [--apply]
// Idempotent: a later Prisma migration deployment safely finds nothing to convert.
const { PrismaClient } = require('@prisma/client');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const prisma = new PrismaClient();

async function counts(tx) {
  return {
    voidedOrders: await tx.order.count({ where: { status: 'VOIDED' } }),
    voidReversals: await tx.orderReversal.count({ where: { type: 'VOID' } }),
    refundedOrders: await tx.order.count({ where: { status: 'REFUNDED' } }),
  };
}

async function financialSnapshot(tx) {
  return JSON.stringify({
    stock: await tx.stockBatch.aggregate({ _sum: { remainingQuantity: true }, _count: true }),
    ledger: await tx.inventoryTransactionLine.aggregate({ _sum: { quantityDelta: true, totalCostDelta: true }, _count: true }),
    payments: await tx.orderPayment.aggregate({ _sum: { amount: true }, _count: true }),
    reversals: await tx.orderReversal.aggregate({ _sum: { amount: true }, _count: true }),
  });
}

async function main() {
  if (!process.argv.includes('--apply')) {
    console.log(JSON.stringify(await counts(prisma)));
    return;
  }
  const sql = readFileSync(join(__dirname, '../prisma/migrations/20260922000000_convert_voided_orders_to_refunds/migration.sql'), 'utf8');
  const result = await prisma.$transaction(async (tx) => {
    const before = await counts(tx);
    const snapshot = await financialSnapshot(tx);
    const inconsistent = await tx.order.count({ where: { status: 'VOIDED', OR: [{ reversal: null }, { reversal: { type: { not: 'VOID' } } }] } });
    if (inconsistent) throw new Error('Voided orders have inconsistent reversal records; no conversion performed.');
    const updated = [];
    for (const statement of sql.split(';').map((part) => part.trim()).filter(Boolean)) {
      updated.push(await tx.$executeRawUnsafe(statement));
    }
    if (snapshot !== await financialSnapshot(tx)) throw new Error('Financial or inventory totals changed; conversion rolled back.');
    return { before, after: await counts(tx), updated, inventoryAndPaymentTotalsUnchanged: true };
  }, { isolationLevel: 'Serializable', timeout: 30000 });
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error.code || error.name, 'Conversion failed; no partial changes were committed.');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
