require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.unit.findMany({ include: { _count: true }, orderBy: { code: 'asc' } })
  .then(units => console.log(JSON.stringify(units, null, 2)))
  .catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
