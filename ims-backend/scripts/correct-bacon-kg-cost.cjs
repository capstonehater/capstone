// One-time correction for the confirmed Bacon receiving error. Dry-run by default.
// Run from ims-backend: node --env-file=.env scripts/correct-bacon-kg-cost.cjs --apply
const { PrismaClient, Prisma } = require('@prisma/client');
const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const db = new PrismaClient();
const batchId = '2527470d-4b24-4c9e-9991-da516e01b6ea';
async function main() {
  await db.$transaction(async (tx) => {
    const batch = await tx.stockBatch.findUnique({ where: { id: batchId }, include: {
      rawMaterial: { include: { unit: true } },
      stockRunItem: { include: { stockRun: { include: { items: true } } } },
      transactionLines: { include: { inventoryTransaction: true } },
    } });
    if (!batch) throw new Error('Confirmed Bacon batch not found');
    const correctedCost = new Prisma.Decimal('0.12');
    if (batch.costPerUnit.equals(correctedCost)) {
      const item = batch.stockRunItem;
      const total = item.stockRun.items.reduce((sum, row) => sum.plus(row.quantity.mul(row.costPerUnit)), new Prisma.Decimal(0));
      if (!item.costPerUnit.equals(correctedCost) || !item.stockRun.totalCost.equals(total) ||
          batch.transactionLines.some((line) => !line.unitCostSnapshot.equals(correctedCost) || !line.totalCostDelta.equals(line.quantityDelta.mul(correctedCost)))) {
        throw new Error('Corrected batch has inconsistent linked costs');
      }
      console.log(`Verified Bacon: ${batch.remainingQuantity} g, PHP ${batch.remainingQuantity.mul(correctedCost)} value; run and ledger costs agree.`);
      return;
    }
    if (batch.rawMaterial.sku !== 'RM-BACON' || batch.rawMaterial.unit.code !== 'G' ||
        !batch.initialQuantity.equals(3000) || !batch.costPerUnit.equals('120.0001') ||
        !batch.stockRunItem?.costPerUnit.equals('120.0001')) {
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
      sum.plus(item.quantity.mul(item.id === batch.stockRunItemId ? correctedCost : item.costPerUnit)), new Prisma.Decimal(0));
    console.log(JSON.stringify({
      material: batch.rawMaterial.name, remainingGrams: batch.remainingQuantity,
      oldCostPerGram: batch.costPerUnit, newCostPerGram: correctedCost,
      oldInventoryValue: batch.remainingQuantity.mul(batch.costPerUnit),
      newInventoryValue: batch.remainingQuantity.mul(correctedCost),
      oldRunTotal: batch.stockRunItem.stockRun.totalCost, newRunTotal: newTotal,
      ledgerLines: batch.transactionLines.length, affectedSnapshots: affectedSnapshots.length,
      apply: process.argv.includes('--apply'),
    }, null, 2));
    if (!process.argv.includes('--apply')) return;
    const backupDir = join(__dirname, '..', '..', '.tmp-backups');
    mkdirSync(backupDir, { recursive: true });
    const backupPath = join(backupDir, `bacon-cost-before-${Date.now()}.json`);
    writeFileSync(backupPath, JSON.stringify({ batch, snapshots }, null, 2), { flag: 'wx' });
    await tx.stockBatch.update({ where: { id: batch.id }, data: { costPerUnit: correctedCost } });
    await tx.stockRunItem.update({ where: { id: batch.stockRunItemId }, data: { costPerUnit: correctedCost } });
    for (const line of batch.transactionLines) {
      await tx.inventoryTransactionLine.update({ where: { id: line.id }, data: {
        unitCostSnapshot: correctedCost, totalCostDelta: line.quantityDelta.mul(correctedCost),
      } });
    }
    await tx.stockRun.update({ where: { id: batch.stockRunItem.stockRunId }, data: { totalCost: newTotal } });
    console.log(`Corrected Bacon cost. Backup: ${backupPath}`);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
