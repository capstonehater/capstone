require('ts-node/register');
const { PrismaClient } = require('@prisma/client');
const { StockRunsService } = require('../src/stock-runs/stock-runs.service');
const db = new PrismaClient();
const rollback = new Error('rollback verification');
async function main() {
  let verified = false;
  try {
    await db.$transaction(async tx => {
      const material = await tx.rawMaterial.findFirst({ where: { unit: { code: 'ML' } } });
      const user = await tx.user.findFirst({ select: { id: true } });
      if (!material || !user) throw new Error('Missing verification fixtures');
      const run = await tx.stockRun.create({ data: { name: 'Price basis verification (rolled back)', createdByUserId: user.id } });
      const service = new StockRunsService(tx, null, null, null);
      const item = await service.addStockRunItem(run.id, { rawMaterialId: material.id, quantity: 1000, costPerUnit: 75, costQuantity: 250, costUnitCode: 'ML' });
      const saved = await tx.stockRunItem.findUnique({ where: { id: item.id } });
      if (!saved.quantity.equals(1000) || !saved.costPerUnit.equals('0.3') || !saved.purchaseCost.equals(75) || !saved.priceQuantity.equals(250) || saved.priceUnitCode !== 'ML') throw new Error('Persisted price basis mismatch');
      verified = true;
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  if (!verified) throw new Error('Verification did not run');
  console.log('Verified database persistence: PHP 75 per 250 ML, 1000 ML received, PHP 0.30/ML and PHP 300 total. Verification records rolled back.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
