const { PrismaClient, Role, AccountStatus } = require('@prisma/client');
const { existsSync } = require('node:fs');
const { join, resolve } = require('node:path');
const prisma = new PrismaClient();
async function main() {
  const [users, activeAdmins, activeStaff, orders, lines, snapshots, runs, latestOrder, latestTxn, latestSnapshot, latestForecast, payments, productImages] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: Role.ADMINISTRATOR, accountStatus: AccountStatus.ACTIVE, isActive: true } }),
    prisma.user.count({ where: { role: Role.STAFF, accountStatus: AccountStatus.ACTIVE, isActive: true } }),
    prisma.order.count(),
    prisma.inventoryTransactionLine.count(),
    prisma.inventoryDailySnapshot.count(),
    prisma.forecastRun.count(),
    prisma.order.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    prisma.inventoryTransaction.findFirst({ orderBy: { occurredAt: 'desc' }, select: { occurredAt: true } }),
    prisma.inventoryDailySnapshot.findFirst({ orderBy: { snapshotDate: 'desc' }, select: { snapshotDate: true } }),
    prisma.forecastRun.findFirst({ orderBy: { historyEnd: 'desc' }, select: { historyEnd: true, startDate: true, endDate: true } }),
    prisma.orderPayment.groupBy({ by: ['method'], _count: { _all: true } }),
    prisma.product.findMany({ select: { imageUrl: true } }),
  ]);
  const [zeroLines, batchMismatch] = await Promise.all([
    prisma.inventoryTransactionLine.count({ where: { quantityDelta: 0 } }),
    prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM stock_batches b
      LEFT JOIN (SELECT stock_batch_id, SUM(quantity_delta) AS delta
                 FROM inventory_transaction_lines GROUP BY stock_batch_id) x
      ON x.stock_batch_id = b.id
      WHERE ABS(b.remaining_quantity - COALESCE(x.delta, 0)) > 0.0001`),
  ]);
  const missingImageFiles = productImages.filter((product) => {
    if (!product.imageUrl?.startsWith('/product-images/')) return true;
    return !existsSync(join(resolve(process.cwd(), 'product-images'), product.imageUrl.split('/').pop()));
  }).length;
  const lastDay = '2026-10-06';
  if (zeroLines || batchMismatch[0].count || missingImageFiles ||
      latestSnapshot?.snapshotDate.toISOString().slice(0, 10) !== lastDay ||
      latestForecast?.historyEnd?.toISOString().slice(0, 10) !== lastDay) {
    throw new Error('Seed verification failed: zero ledger lines, batch mismatches, missing POS images, or wrong history cutoff.');
  }
  console.log(JSON.stringify({
    users, activeAdmins, activeStaff, orders, lines, snapshots, runs,
    latestOrder: latestOrder?.createdAt,
    latestTxn: latestTxn?.occurredAt,
    latestSnapshot: latestSnapshot?.snapshotDate,
    latestForecast,
    zeroLines,
    batchMismatch: batchMismatch[0].count,
    productImages: productImages.length,
    missingImageFiles,
    payments,
  }, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
