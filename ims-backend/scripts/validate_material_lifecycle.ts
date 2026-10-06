import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { InventoryService } from '../src/inventory/inventory.service';
import { withHistoricalMaterial } from '../src/inventory/material-history-snapshot';
import { ReportsService } from '../src/reports/reports.service';
import { OrdersService } from '../src/orders/orders.service';
import { InventoryActionsService } from '../src/inventory/inventory-actions.service';
import { InventoryLedgerService } from '../src/inventory/inventory-ledger.service';
import { AvailabilityService } from '../src/availability/availability.service';
import { OutboxService } from '../src/events/outbox.service';

// Exercise real foreign keys and history reads without leaving test data behind.
async function main() {
  const prisma = new PrismaClient();
  const rollback = new Error('validation complete: roll back test records');
  try {
    await prisma.$transaction(async (tx) => {
      const unit = await tx.unit.findFirstOrThrow();
      const user = await tx.user.findFirstOrThrow();
      const material = await tx.rawMaterial.create({
        data: { name: 'Lifecycle validation', sku: `CHECK-${randomUUID()}`, unitId: unit.id, isActive: false },
      });
      const run = await tx.stockRun.create({ data: { name: 'Lifecycle validation', status: 'POSTED', createdByUserId: user.id } });
      const item = await tx.stockRunItem.create({ data: { stockRunId: run.id, rawMaterialId: material.id, quantity: 10, costPerUnit: 2 } });
      const batch = await tx.stockBatch.create({
        data: { rawMaterialId: material.id, stockRunItemId: item.id, initialQuantity: 10, remainingQuantity: 9, costPerUnit: 2, receivedAt: new Date() },
      });
      const transaction = await tx.inventoryTransaction.create({
        data: { type: 'WASTE', sourceType: 'WASTE', occurredAt: new Date(), lines: { create: { rawMaterialId: material.id, stockBatchId: batch.id, quantityDelta: -1, unitCostSnapshot: 2, totalCostDelta: -2 } } },
      });
      const snapshot = await tx.inventoryDailySnapshot.create({
        data: { rawMaterialId: material.id, snapshotDate: new Date(), onHandQuantity: 9, usableQuantity: 9, inventoryValue: 18 },
      });
      const search = await tx.storeAvailabilitySearch.create({ data: { rawMaterialId: material.id, productName: material.name, status: 'COMPLETED' } });
      const checkout = await tx.inventoryTransaction.create({
        data: { type: 'CHECKOUT', sourceType: 'ORDER', occurredAt: new Date(), lines: { create: { rawMaterialId: material.id, stockBatchId: batch.id, quantityDelta: -1, unitCostSnapshot: 2, totalCostDelta: -2 } } },
      });
      const scopedPrisma = new Proxy(tx, {
        get(target, key) {
          if (key === '$transaction') return (callback: (client: Prisma.TransactionClient) => unknown) => callback(tx);
          return Reflect.get(target, key);
        },
      }) as unknown as PrismaService;
      const inventory = new InventoryService(scopedPrisma);
      const restored = await inventory.unarchiveRawMaterial(material.id);
      assert.equal(restored.isActive, true);
      await inventory.deleteRawMaterial(material.id);
      assert.equal(await tx.rawMaterial.findUnique({ where: { id: material.id } }), null);
      const histories = [
        await tx.stockRunItem.findUniqueOrThrow({ where: { id: item.id } }),
        await tx.stockBatch.findUniqueOrThrow({ where: { id: batch.id } }),
        await tx.inventoryTransactionLine.findFirstOrThrow({ where: { inventoryTransactionId: transaction.id } }),
        await tx.inventoryDailySnapshot.findUniqueOrThrow({ where: { id: snapshot.id } }),
        await tx.storeAvailabilitySearch.findUniqueOrThrow({ where: { id: search.id } }),
      ];
      for (const history of histories) {
        assert.equal(history.rawMaterialId, null);
        const recovered = withHistoricalMaterial({ ...history, rawMaterial: null });
        assert.equal(recovered.rawMaterialId, material.id);
        assert.equal(recovered.rawMaterial.name, material.name);
        assert.equal(recovered.rawMaterial.sku, material.sku);
        assert.equal(recovered.rawMaterial.unit.code, unit.code);
      }
      const reports = new ReportsService(scopedPrisma, inventory, {} as OrdersService);
      const waste = await reports.getWasteSummary({ limit: 1000 });
      assert.ok(waste.byMaterial.some((row) => row.rawMaterialId === material.id && row.name === material.name));
      const linked = await reports.getPosInventoryLinked({
        materialSearch: 'lifecycle validation',
        from: new Date(checkout.occurredAt.getTime() - 1000).toISOString(),
        to: new Date(checkout.occurredAt.getTime() + 1000).toISOString(),
      });
      assert.ok(linked.materials.some((row) => row.rawMaterial.id === material.id));
      const ledger = new InventoryLedgerService();
      const original = await tx.inventoryTransactionLine.findFirstOrThrow({ where: { inventoryTransactionId: checkout.id } });
      await ledger.appendTransaction(tx, {
        type: 'REFUND', sourceType: 'ORDER_REFUND',
        lines: [{ rawMaterialId: null, rawMaterialSnapshot: original.rawMaterialSnapshot as Prisma.InputJsonValue, stockBatchId: batch.id, quantityDelta: new Prisma.Decimal(1), unitCostSnapshot: new Prisma.Decimal(2), totalCostDelta: new Prisma.Decimal(2) }],
      });
      const actions = new InventoryActionsService(scopedPrisma, ledger, {} as AvailabilityService, {} as OutboxService);
      const history = await actions.listTransactionsForRawMaterial(material.id, {});
      assert.equal(history.length, 3);
      assert.ok(history.every((row) => row.lines.every((line) => line.rawMaterialId === material.id && line.rawMaterial.name === material.name)));
      console.log('PASS: Unarchive, deletion, five historical foreign keys, waste and POS reports, refund ledger snapshots, and history retrieval. Test data rolled back.');
      throw rollback;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
