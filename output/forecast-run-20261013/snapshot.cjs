const path = require('path');
const fs = require('fs');
const backend = path.resolve(__dirname, '../../ims-backend');
require(path.join(backend, 'node_modules/dotenv')).config({path: path.join(backend, '.env'), quiet: true});
const {PrismaClient, Prisma} = require(path.join(backend, 'node_modules/@prisma/client'));
const {loadPosHistory} = require(path.join(backend, 'dist/src/forecasting/pos-history.js'));
const db = new PrismaClient();
(async () => {
  const startDate = '2026-10-14';
  const capturedAt = new Date();
  const input = await db.$transaction(async tx => {
    const materials = await tx.rawMaterial.findMany({where: {isActive: true}, include: {unit: true, summary: true}});
    const pos = await loadPosHistory(tx, startDate, capturedAt);
    return {startDate, forecastDays: 7, ...pos, materials: materials.map(m => ({id: m.id, name: m.name, sku: m.sku,
      unit: m.unit.code, currentStock: m.summary ? Number(m.summary.usableQuantity) : null}))};
  }, {isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60000});
  fs.writeFileSync(path.join(__dirname, 'input.json'), JSON.stringify(input));
  console.log(JSON.stringify({materials: input.materials.length, posDays: input.posDates.length,
    firstPOS: input.posDates[0], lastPOS: input.posDates.at(-1), capturedAt: input.capturedAt}));
})().catch(e => {console.error(e.message); process.exitCode=1;}).finally(() => db.$disconnect());
