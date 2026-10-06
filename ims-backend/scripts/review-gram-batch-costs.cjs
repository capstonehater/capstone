const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
async function main() {
  const rows = await db.rawMaterial.findMany({
    where: { unit: { code: { equals: process.argv.includes('--ml') ? 'ML' : 'G', mode: 'insensitive' } } },
    orderBy: { name: 'asc' },
    include: { stockBatches: { include: { stockRunItem: { include: { stockRun: true } },
      transactionLines: { include: { inventoryTransaction: true } } } }, stockRunItems: { where: { stockRun: { status: 'DRAFT' } } },
      inventoryDailySnapshots: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  if (process.argv.includes('--summary')) {
    console.log(JSON.stringify(rows.filter(row => row.stockBatches.length).map(row => ({
      name: row.name,
      batches: row.stockBatches.map(batch => ({ id: batch.id, initial: batch.initialQuantity, remaining: batch.remainingQuantity,
        costPerGram: batch.costPerUnit, stockRun: batch.stockRunItem?.stockRun.name || null,
        ledgerLines: batch.transactionLines.length })),
    })), null, 2));
    return;
  }
  console.log(JSON.stringify(rows.map(row => ({ id: row.id, name: row.name, sku: row.sku,
    batches: row.stockBatches.map(batch => ({ id: batch.id, quantity: batch.initialQuantity, remaining: batch.remainingQuantity,
      costPerGram: batch.costPerUnit, receivedAt: batch.receivedAt, createdAt: batch.createdAt, expirationDate: batch.expirationDate,
      stockRunItemId: batch.stockRunItemId, stockRunName: batch.stockRunItem?.stockRun.name,
      itemCost: batch.stockRunItem?.costPerUnit,
      lines: batch.transactionLines.map(line => ({ id: line.id, type: line.inventoryTransaction.type, quantityDelta: line.quantityDelta,
        costPerGram: line.unitCostSnapshot, totalCost: line.totalCostDelta, orderItemId: line.orderItemId })) })),
    draftItems: row.stockRunItems, latestSnapshot: row.inventoryDailySnapshots[0],
  })), null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
