require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const units = await prisma.unit.findMany();
  const sources = units.filter(unit => /^IRP[123]-(MASS|VOLUME|COUNT)$/.test(unit.code) || unit.code === 'BOTTLE');
  const materials = await prisma.rawMaterial.findMany({ where: { unitId: { in: sources.map(unit => unit.id) } } });
  const backup = path.join(__dirname, 'unit-cleanup-backup.json');
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, JSON.stringify({ units: sources, materials }, null, 2));
  const result = await prisma.$transaction(async tx => {
    const changes = [];
    for (const unit of sources) {
      const code = unit.code === 'BOTTLE' ? 'PCS' : { MASS: 'G', VOLUME: 'ML', COUNT: 'PCS' }[unit.dimension];
      const target = units.find(candidate => candidate.code === code);
      if (!target || !unit.conversionFactor.equals(target.conversionFactor)) throw new Error(`Unsafe conversion for ${unit.code}`);
      const updated = await tx.rawMaterial.updateMany({ where: { unitId: unit.id }, data: { unitId: target.id } });
      await tx.unit.delete({ where: { id: unit.id } });
      changes.push({ removed: unit.code, replacement: code, materials: updated.count });
    }
    return changes;
  });
  console.log(JSON.stringify(result, null, 2));
  console.log('Remaining units:', (await prisma.unit.findMany({ orderBy: { code: 'asc' } })).map(unit => unit.code).join(', '));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
