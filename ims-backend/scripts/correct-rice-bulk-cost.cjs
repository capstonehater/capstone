// Confirmed Rice price: PHP 3100 for the whole 75 kg purchase.
// Run from ims-backend: node --env-file=.env scripts/correct-rice-bulk-cost.cjs --apply
const { PrismaClient, Prisma } = require('@prisma/client');
const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const db = new PrismaClient();
const batchId = '63c7e875-797f-445a-babd-8382967c2711';
async function main() {
  await db.$transaction(async (tx) => {
    const batch = await tx.stockBatch.findUnique({ where: { id: batchId }, include: {
      rawMaterial: { include: { unit: true } },
      stockRunItem: { include: { stockRun: { include: { items: true } } } },
      transactionLines: { include: { inventoryTransaction: true } },
    } });
    if (!batch) throw new Error('Confirmed Rice batch not found');
    const correctedCost = new Prisma.Decimal(3100).div(75000).toDecimalPlaces(8);
    const orderItemIds = [...new Set(batch.transactionLines.filter((line) => line.inventoryTransaction.type === 'CHECKOUT' && line.orderItemId).map((line) => line.orderItemId))];
    const orderItems = await tx.orderItem.findMany({ where: { id: { in: orderItemIds } }, include: { order: { include: { items: true } } } });
    if (batch.costPerUnit.equals(correctedCost)) {
      const item = batch.stockRunItem;
      const total = item.stockRun.items.reduce((sum, row) => sum.plus(row.quantity.mul(row.costPerUnit)), new Prisma.Decimal(0)).toDecimalPlaces(4);
      if (!item.costPerUnit.equals(correctedCost) || !item.stockRun.totalCost.equals(total) ||
          batch.transactionLines.some((line) => !line.unitCostSnapshot.equals(correctedCost) || !line.totalCostDelta.equals(line.quantityDelta.mul(correctedCost).toDecimalPlaces(4)))) {
        throw new Error('Corrected batch has inconsistent linked costs');
      }
      const allBatches = await tx.stockBatch.findMany({ where: { rawMaterialId: batch.rawMaterialId } });
      const inventoryValue = allBatches.reduce((sum, row) => sum.plus(row.remainingQuantity.mul(row.costPerUnit)), new Prisma.Decimal(0));
      for (const orderItem of orderItems) {
        const lines = await tx.inventoryTransactionLine.findMany({ where: { orderItemId: orderItem.id, inventoryTransaction: { type: 'CHECKOUT' } } });
        const cogs = lines.reduce((sum, line) => sum.minus(line.totalCostDelta), new Prisma.Decimal(0));
        const orderCogs = orderItem.order.items.reduce((sum, row) => sum.plus(row.lineCogsAmount), new Prisma.Decimal(0));
        if (!orderItem.lineCogsAmount.equals(cogs) || !orderItem.unitCogsAmount.equals(cogs.div(orderItem.quantity).toDecimalPlaces(4)) || !orderItem.order.totalCogsAmount.equals(orderCogs)) throw new Error('Order cost snapshots disagree with the corrected ledger');
      }
      console.log(`Verified Rice: corrected batch ${batch.remainingQuantity} g worth PHP ${batch.remainingQuantity.mul(correctedCost)}; total inventory value PHP ${inventoryValue}; run and ledger costs agree.`);
      return;
    }
    if (batch.rawMaterial.sku !== 'RM-RICE' || batch.rawMaterial.unit.code !== 'G' ||
        !batch.initialQuantity.equals(75000) || !batch.costPerUnit.equals('3.1') ||
        !batch.stockRunItem?.costPerUnit.equals('3.1')) {
      throw new Error('Batch differs from the confirmed error; no changes made');
    }
    if (batch.transactionLines.some((line) => !line.unitCostSnapshot.equals(batch.costPerUnit))) {
      throw new Error('Ledger has differing cost snapshots; no changes made');
    }
    const snapshots = await tx.inventoryDailySnapshot.findMany({ where: { rawMaterialId: batch.rawMaterialId } });
    const affectedSnapshots = snapshots.filter((snapshot) => {
      // These snapshots capture live inventory when created, at the start of
      // a Manila business day; their date label is not an end-of-day cutoff.
      return batch.transactionLines.some((line) => line.createdAt <= snapshot.createdAt);
    });
    // Snapshot corrections need their own historical reconstruction if any exist.
    if (affectedSnapshots.length) throw new Error('Historical snapshots include this batch; review needed before correction');
    const newTotal = batch.stockRunItem.stockRun.items.reduce((sum, item) =>
      sum.plus(item.quantity.mul(item.id === batch.stockRunItemId ? correctedCost : item.costPerUnit)), new Prisma.Decimal(0)).toDecimalPlaces(4);
    console.log(JSON.stringify({
      material: batch.rawMaterial.name, remainingGrams: batch.remainingQuantity,
      oldCostPerGram: batch.costPerUnit, newCostPerGram: correctedCost,
      oldInventoryValue: batch.remainingQuantity.mul(batch.costPerUnit),
      newInventoryValue: batch.remainingQuantity.mul(correctedCost),
      oldRunTotal: batch.stockRunItem.stockRun.totalCost, newRunTotal: newTotal,
      ledgerLines: batch.transactionLines.length, affectedSnapshots: affectedSnapshots.length,
      checkoutItemsToCorrect: orderItemIds.length,
      apply: process.argv.includes('--apply'),
    }, null, 2));
    if (!process.argv.includes('--apply')) return;
    const backupDir = join(__dirname, '..', '..', '.tmp-backups');
    mkdirSync(backupDir, { recursive: true });
    const backupPath = join(backupDir, `rice-bulk-cost-before-${Date.now()}.json`);
    writeFileSync(backupPath, JSON.stringify({ batch, snapshots, orderItems }, null, 2), { flag: 'wx' });
    await tx.stockBatch.update({ where: { id: batch.id }, data: { costPerUnit: correctedCost } });
    await tx.stockRunItem.update({ where: { id: batch.stockRunItemId }, data: { costPerUnit: correctedCost } });
    for (const line of batch.transactionLines) {
      await tx.inventoryTransactionLine.update({ where: { id: line.id }, data: {
        unitCostSnapshot: correctedCost, totalCostDelta: line.quantityDelta.mul(correctedCost).toDecimalPlaces(4),
      } });
    }
    await tx.stockRun.update({ where: { id: batch.stockRunItem.stockRunId }, data: { totalCost: newTotal } });
    for (const orderItem of orderItems) {
      const lines = await tx.inventoryTransactionLine.findMany({ where: { orderItemId: orderItem.id, inventoryTransaction: { type: 'CHECKOUT' } } });
      const cogs = lines.reduce((sum, line) => sum.minus(line.totalCostDelta), new Prisma.Decimal(0));
      await tx.orderItem.update({ where: { id: orderItem.id }, data: { lineCogsAmount: cogs, unitCogsAmount: cogs.div(orderItem.quantity).toDecimalPlaces(4) } });
    }
    for (const orderId of [...new Set(orderItems.map((row) => row.orderId))]) {
      const items = await tx.orderItem.findMany({ where: { orderId } });
      const totalCogsAmount = items.reduce((sum, row) => sum.plus(row.lineCogsAmount), new Prisma.Decimal(0));
      await tx.order.update({ where: { id: orderId }, data: { totalCogsAmount } });
    }
    console.log(`Corrected Rice cost. Backup: ${backupPath}`);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
