// Reviewed legacy G prices use a 1000 g price basis. Frozen manifest makes this
// correction repeatable without dividing an already-corrected cost again.
// Run from ims-backend with --env-file=.env. Dry-run, --apply, or --verify.
// Add --ml to review/correct ML prices using 1000 ml (1 litre).
const { PrismaClient, Prisma } = require('@prisma/client');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const db = new PrismaClient();
const backupDir = join(__dirname, '..', '..', '.tmp-backups');
const unitCode = process.argv.includes('--ml') ? 'ML' : 'G';
const costFilePrefix = unitCode === 'ML' ? 'existing-ml-cost' : 'existing-gram-cost';
const planPath = join(backupDir, `${costFilePrefix}-plan.json`);
const sum = (values) => values.reduce((total, value) => total.plus(value), new Prisma.Decimal(0));
async function main() {
  mkdirSync(backupDir, { recursive: true });
  if (!existsSync(planPath)) {
    const batches = await db.stockBatch.findMany({ where: {
      rawMaterial: { unit: { code: { equals: unitCode, mode: 'insensitive' } } },
      // Reviewed high legacy entries, including adjustment-created batches.
      // Existing normalized historical costs range from 0.055 to 1.15/g.
      costPerUnit: { gte: 3 },
    }, include: { rawMaterial: true }, orderBy: { id: 'asc' } });
    const plan = batches.map(batch => ({ id: batch.id, rawMaterialId: batch.rawMaterialId,
      name: batch.rawMaterial.name, oldCost: batch.costPerUnit.toString(),
      newCost: batch.costPerUnit.div(1000).toDecimalPlaces(8).toString(),
    }));
    writeFileSync(planPath, JSON.stringify(plan, null, 2), { flag: 'wx' });
  }
  const plan = JSON.parse(readFileSync(planPath, 'utf8').replace(/^\uFEFF/, ''));
  await db.$transaction(async (tx) => {
    const batches = await tx.stockBatch.findMany({ where: { id: { in: plan.map(row => row.id) } }, include: {
      rawMaterial: { include: { unit: true } }, stockRunItem: true,
      transactionLines: { include: { inventoryTransaction: true } },
    } });
    if (batches.length !== plan.length) throw new Error('A reviewed batch is missing');
    const planById = new Map(plan.map(row => [row.id, row]));
    const materialIds = [...new Set(plan.map(row => row.rawMaterialId))];
    const runIds = [...new Set(batches.filter(row => row.stockRunItem).map(row => row.stockRunItem.stockRunId))];
    const runs = await tx.stockRun.findMany({ where: { id: { in: runIds } }, include: { items: true } });
    const itemIds = [...new Set(batches.flatMap(row => row.transactionLines.filter(line => line.inventoryTransaction.type === 'CHECKOUT' && line.orderItemId).map(line => line.orderItemId)))];
    const orderItems = await tx.orderItem.findMany({ where: { id: { in: itemIds } }, include: { order: { include: { items: true } } } });
    const snapshots = await tx.inventoryDailySnapshot.findMany({ where: { rawMaterialId: { in: materialIds } } });
    if (process.argv.includes('--verify')) {
      for (const batch of batches) {
        const cost = new Prisma.Decimal(planById.get(batch.id).newCost);
        if (!batch.costPerUnit.equals(cost) || (batch.stockRunItem && !batch.stockRunItem.costPerUnit.equals(cost)) ||
            batch.transactionLines.some(line => !line.unitCostSnapshot.equals(cost) || !line.totalCostDelta.equals(line.quantityDelta.mul(cost).toDecimalPlaces(4)))) throw new Error(`Inconsistent corrected costs: ${batch.rawMaterial.name}`);
      }
      for (const run of runs) if (!run.totalCost.equals(sum(run.items.map(item => item.quantity.mul(item.costPerUnit))).toDecimalPlaces(4))) throw new Error(`Run total mismatch: ${run.name}`);
      for (const item of orderItems) {
        const lines = await tx.inventoryTransactionLine.findMany({ where: { orderItemId: item.id, inventoryTransaction: { type: 'CHECKOUT' } } });
        const cogs = sum(lines.map(line => line.totalCostDelta.negated())).toDecimalPlaces(4);
        if (!item.lineCogsAmount.equals(cogs) || !item.unitCogsAmount.equals(cogs.div(item.quantity).toDecimalPlaces(4)) ||
            !item.order.totalCogsAmount.equals(sum(item.order.items.map(row => row.lineCogsAmount)).toDecimalPlaces(4))) throw new Error('Checkout cost mismatch');
      }
      const baselinePath = join(backupDir, `${costFilePrefix}-before.json`);
      const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
      for (const snapshot of snapshots) {
        const old = baseline.snapshots.find(row => row.id === snapshot.id);
        if (!old) continue;
        const adjustment = sum(batches.filter(batch => batch.rawMaterialId === snapshot.rawMaterialId).map(batch => {
          const quantity = sum(batch.transactionLines.filter(line => line.createdAt <= snapshot.createdAt).map(line => line.quantityDelta));
          const row = planById.get(batch.id);
          return quantity.mul(new Prisma.Decimal(row.newCost).minus(row.oldCost));
        }));
        if (!snapshot.inventoryValue.equals(new Prisma.Decimal(old.inventoryValue).plus(adjustment).toDecimalPlaces(4))) throw new Error('Snapshot correction mismatch');
      }
      console.log(`Verified ${batches.length} batches, ${runs.length} stock runs, ${orderItems.length} checkout items, and ${snapshots.length} snapshots.`);
      const materials = await tx.rawMaterial.findMany({ where: { id: { in: materialIds } }, include: { stockBatches: true }, orderBy: { name: 'asc' } });
      console.log(JSON.stringify(materials.map(row => ({ name: row.name, inventoryValue: sum(row.stockBatches.map(batch => batch.remainingQuantity.mul(batch.costPerUnit))).toString() })), null, 2));
      return;
    }
    for (const batch of batches) {
      const expected = planById.get(batch.id);
      if (batch.rawMaterial.unit.code.toUpperCase() !== unitCode || !batch.costPerUnit.equals(expected.oldCost) ||
          (batch.stockRunItem && !batch.stockRunItem.costPerUnit.equals(expected.oldCost)) ||
          batch.transactionLines.some(line => !line.unitCostSnapshot.equals(expected.oldCost))) throw new Error(`Reviewed costs have changed: ${expected.name}`);
      if (!sum(batch.transactionLines.map(line => line.quantityDelta)).equals(batch.remainingQuantity)) throw new Error(`Incomplete quantity history: ${expected.name}`);
    }
    const snapshotUpdates = snapshots.map(snapshot => {
      const adjustment = sum(batches.filter(batch => batch.rawMaterialId === snapshot.rawMaterialId).map(batch => {
        const quantity = sum(batch.transactionLines.filter(line => line.createdAt <= snapshot.createdAt).map(line => line.quantityDelta));
        if (quantity.isNegative()) throw new Error('Negative historical batch quantity');
        const row = planById.get(batch.id);
        return quantity.mul(new Prisma.Decimal(row.newCost).minus(row.oldCost));
      }));
      const value = snapshot.inventoryValue.plus(adjustment).toDecimalPlaces(4);
      if (value.isNegative()) throw new Error(`Snapshot correction would be negative: ${snapshot.id}`);
      return { id: snapshot.id, inventoryValue: value, changed: !adjustment.isZero() };
    }).filter(row => row.changed);
    console.log(JSON.stringify({ batches: plan, stockRuns: runs.length, checkoutItems: orderItems.length,
      snapshotsToCorrect: snapshotUpdates.length, apply: process.argv.includes('--apply') }, null, 2));
    if (!process.argv.includes('--apply')) return;
    writeFileSync(join(backupDir, `${costFilePrefix}-before.json`), JSON.stringify({ batches, runs, orderItems, snapshots }, null, 2), { flag: 'wx' });
    for (const batch of batches) {
      const cost = new Prisma.Decimal(planById.get(batch.id).newCost);
      await tx.stockBatch.update({ where: { id: batch.id }, data: { costPerUnit: cost } });
      if (batch.stockRunItem) await tx.stockRunItem.update({ where: { id: batch.stockRunItemId }, data: { costPerUnit: cost } });
      for (const line of batch.transactionLines) await tx.inventoryTransactionLine.update({ where: { id: line.id }, data: {
        unitCostSnapshot: cost, totalCostDelta: line.quantityDelta.mul(cost).toDecimalPlaces(4),
      } });
    }
    for (const run of runs) {
      const items = await tx.stockRunItem.findMany({ where: { stockRunId: run.id } });
      await tx.stockRun.update({ where: { id: run.id }, data: { totalCost: sum(items.map(row => row.quantity.mul(row.costPerUnit))).toDecimalPlaces(4) } });
    }
    for (const item of orderItems) {
      const lines = await tx.inventoryTransactionLine.findMany({ where: { orderItemId: item.id, inventoryTransaction: { type: 'CHECKOUT' } } });
      const cogs = sum(lines.map(line => line.totalCostDelta.negated())).toDecimalPlaces(4);
      await tx.orderItem.update({ where: { id: item.id }, data: { lineCogsAmount: cogs, unitCogsAmount: cogs.div(item.quantity).toDecimalPlaces(4) } });
    }
    for (const orderId of [...new Set(orderItems.map(row => row.orderId))]) {
      const items = await tx.orderItem.findMany({ where: { orderId } });
      await tx.order.update({ where: { id: orderId }, data: { totalCogsAmount: sum(items.map(row => row.lineCogsAmount)).toDecimalPlaces(4) } });
    }
    for (const snapshot of snapshotUpdates) await tx.inventoryDailySnapshot.update({ where: { id: snapshot.id }, data: { inventoryValue: snapshot.inventoryValue } });
    console.log(`Applied reviewed ${unitCode} cost corrections; original records backed up in .tmp-backups.`);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60000 });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
