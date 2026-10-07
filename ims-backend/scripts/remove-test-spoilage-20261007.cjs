const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
require("dotenv").config({ quiet: true });
require("reflect-metadata");
require("ts-node/register/transpile-only");
const { PrismaClient, Prisma } = require("@prisma/client");
const { AvailabilityService } = require("../src/availability/availability.service");
const { InventoryStateHistoryService } = require("../src/availability/inventory-state-history.service");
const prisma = new PrismaClient();
const availability = new AvailabilityService(prisma, new InventoryStateHistoryService());
const ids = ["4ad04c24-cc2b-4797-92bd-0b9211009419", "80a336b3-9784-4b59-b589-a22735a8f0e8", "9362db84-da4d-49ce-9e8f-7ea4158040a7", "inventory_reports_phase1_tx_waste"];

async function main() {
  const backupDir = path.resolve(__dirname, "../../.tmp-backups");
  await fs.mkdir(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, "test-spoilage-removal-" + Date.now() + ".json");
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM inventory_transactions WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`);
    const records = await tx.inventoryTransaction.findMany({ where: { id: { in: ids } }, include: { lines: true } });
    assert.equal(records.length, 4, "Expected the exact four waste transactions in the screenshot");
    const groups = new Map();
    for (const record of records) {
      assert.equal(record.type, "WASTE");
      assert.ok(["Spoilage", "SPOILAGE"].includes(record.reasonCode));
      const group = groups.get(record.reasonCode) || { count: 0, quantity: new Prisma.Decimal(0), cost: new Prisma.Decimal(0) };
      group.count++;
      for (const line of record.lines) {
        assert.ok(line.quantityDelta.lessThan(0));
        group.quantity = group.quantity.minus(line.quantityDelta);
        group.cost = group.cost.minus(line.totalCostDelta);
      }
      groups.set(record.reasonCode, group);
    }
    assert.equal(groups.get("SPOILAGE").count, 3);
    assert.equal(groups.get("SPOILAGE").quantity.toString(), "10000102");
    assert.equal(groups.get("SPOILAGE").cost.toString(), "1230000078.2");
    assert.equal(groups.get("Spoilage").count, 1);
    assert.equal(groups.get("Spoilage").quantity.toString(), "100");
    assert.equal(groups.get("Spoilage").cost.toString(), "30.01");
    const batchIds = [...new Set(records.flatMap(record => record.lines.map(line => line.stockBatchId)))].sort();
    await tx.$queryRaw(Prisma.sql`SELECT id FROM stock_batches WHERE id IN (${Prisma.join(batchIds)}) ORDER BY id FOR UPDATE`);
    const batches = await tx.stockBatch.findMany({ where: { id: { in: batchIds } } });
    const materialIds = [...new Set(records.flatMap(record => record.lines.map(line => line.rawMaterialId)).filter(Boolean))];
    const outbox = await tx.outboxEvent.findMany({ where: { aggregateType: "inventory_waste", aggregateId: { in: ids } } });
    const summaries = await tx.rawMaterialInventorySummary.findMany({ where: { rawMaterialId: { in: materialIds } } });
    await fs.writeFile(backupFile, JSON.stringify({ backedUpAt: new Date().toISOString(), purpose: "User-requested removal of the two test spoilage report groups", records, batches, summaries, outbox }, null, 2), { flag: "wx" });
    const restoreByBatch = new Map();
    for (const line of records.flatMap(record => record.lines)) {
      restoreByBatch.set(line.stockBatchId, (restoreByBatch.get(line.stockBatchId) || new Prisma.Decimal(0)).minus(line.quantityDelta));
    }
    for (const batch of batches) {
      const restored = batch.remainingQuantity.plus(restoreByBatch.get(batch.id));
      assert.ok(restored.lessThanOrEqualTo(batch.initialQuantity), "Restoration exceeds the original batch stock");
      await tx.stockBatch.update({ where: { id: batch.id }, data: { remainingQuantity: restored } });
    }
    await tx.outboxEvent.deleteMany({ where: { aggregateType: "inventory_waste", aggregateId: { in: ids } } });
    const deleted = await tx.inventoryTransaction.deleteMany({ where: { id: { in: ids }, type: "WASTE" } });
    assert.equal(deleted.count, 4);
    await availability.refreshRawMaterialSummaries(tx, materialIds);
    await availability.refreshVariantSummariesForRawMaterialIds(tx, materialIds);
    assert.equal(await tx.inventoryTransaction.count({ where: { type: "WASTE", reasonCode: { equals: "spoilage", mode: "insensitive" } } }), 0);
    return { removedWasteTransactions: deleted.count, restoredBatches: batches.length, refreshedMaterials: materialIds.length, backupFile };
  }, { timeout: 30000 });
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
