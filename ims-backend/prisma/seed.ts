import { PrismaClient } from '@prisma/client';
import { findExistingActors, seedCatalog } from './seeds/catalog-seed';
import { seedOperationalHistory } from './seeds/operational-history';
import { resetBusinessData } from './seeds/reset-business-data';
import { addDays, manilaToday, subtractCalendarYears } from './seeds/deterministic';
import { validateSeedCatalog } from './seeds/validate-catalog';

const prisma = new PrismaClient();

function resolveAsOfDate(): string {
  const today = manilaToday();
  const configured = process.env.SYNTHETIC_SEED_AS_OF?.trim();
  const asOf = configured || '2026-10-07';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error('SYNTHETIC_SEED_AS_OF must use YYYY-MM-DD.');
  const parsed = new Date(`${asOf}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== asOf) {
    throw new Error('SYNTHETIC_SEED_AS_OF must be a valid calendar date.');
  }
  if (asOf > today) throw new Error('SYNTHETIC_SEED_AS_OF cannot be in the future.');
  if (asOf !== '2026-10-07') throw new Error('This menu dataset requires an exclusive end date of 2026-10-07.');
  return asOf;
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Synthetic operational data is disabled when NODE_ENV=production.');
  }
  if (process.env.ALLOW_BUSINESS_DATA_RESET !== 'true') {
    throw new Error('This seed replaces business data. Set ALLOW_BUSINESS_DATA_RESET=true to proceed. No records were changed.');
  }

  const endDateExclusive = resolveAsOfDate();
  const startDate = subtractCalendarYears(endDateExclusive, 5);
  const lastHistoryDate = addDays(endDateExclusive, -1);
  validateSeedCatalog();
  // Read and validate actors before the destructive reset. No auth/RBAC rows are written.
  const actors = await findExistingActors(prisma);
  console.log(`Replacing business data with synthetic Café Salvacion history from ${startDate} through ${lastHistoryDate} (Asia/Manila).`);

  const deleted = await resetBusinessData(prisma);
  console.log('Existing operational records removed in a single FK-ordered transaction.');
  const ids = await seedCatalog(prisma, startDate, endDateExclusive, actors);
  const counts = await seedOperationalHistory(prisma, ids, startDate, endDateExclusive);

  console.log('Synthetic business-data seed completed. Existing users, passwords, profiles, roles, permissions, sessions, and auth records were preserved.');
  console.log(JSON.stringify({ startDate, lastHistoryDate, deleted, ...counts }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error('Synthetic seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
