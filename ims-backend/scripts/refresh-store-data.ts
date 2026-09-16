import 'reflect-metadata';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { PrismaService } from '../src/prisma/prisma.service';
import { StoreAvailabilityService } from '../src/inventory/store-availability.service';

export const HELP = `Saved store-data refresh tool

  npm run store-data -- --list
  npm run store-data -- --material <raw-material-id> --dry-run
  npm run store-data -- --material <raw-material-id>
  npm run store-data -- --all --dry-run
  npm run store-data -- --all

--list      List active materials with previous searches and their latest status.
--material  Refresh one active material using its database ID.
--all       Refresh active materials with previous searches, sequentially.
--dry-run   Show selected materials without searching or changing the database.

Refreshes Serper evidence and Qwen rankings in store_availability_results.payload.
Each refresh creates a new search; historical results are preserved.
Existing pending searches are awaited. Keep this command running until it finishes.
`;

export function parseOptions(args: string[]) {
  if (!args.length || (args.length === 1 && args[0] === '--help')) {
    return { mode: 'help' as const, dryRun: false };
  }
  let mode: 'list' | 'all' | 'material' | undefined;
  let materialId: string | undefined;
  let dryRun = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--dry-run' && !dryRun) {
      dryRun = true;
    } else if (['--list', '--all', '--material'].includes(arg) && !mode) {
      mode = arg === '--list' ? 'list' : arg === '--all' ? 'all' : 'material';
      if (mode === 'material') {
        materialId = args[++index];
        if (!materialId || materialId.startsWith('--')) {
          throw new Error('--material requires a raw-material ID.');
        }
      }
    } else {
      throw new Error(`Invalid or conflicting option: ${arg}. Use --help.`);
    }
  }
  if (!mode || (mode === 'list' && dryRun)) {
    throw new Error('Choose --list, --all, or --material <id>. Use --help.');
  }
  return { mode, materialId, dryRun };
}

type Options = ReturnType<typeof parseOptions>;

export async function refreshStoreData(
  prisma: PrismaService,
  service: Pick<StoreAvailabilityService, 'start'>,
  options: Options,
  log: (line: string) => void = console.log,
  sleep: () => Promise<void> = () =>
    new Promise((done) => setTimeout(done, 2000)),
) {
  const materials = await prisma.rawMaterial.findMany({
    where: {
      isActive: true,
      ...(options.mode === 'material'
        ? { id: options.materialId }
        : { storeSearches: { some: {} } }),
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      storeSearches: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          status: true,
          completedAt: true,
          _count: { select: { results: true } },
        },
      },
    },
  });
  if (options.mode === 'material' && !materials.length) {
    throw new Error('No active material matches that database ID.');
  }
  log('Data table: store_availability_results.payload');
  log(
    'Material ID | Material | Latest status | Saved store rows | Completed at',
  );
  for (const material of materials) {
    const last = material.storeSearches[0];
    log(
      `${material.id} | ${material.name} | ${last?.status ?? 'Never searched'} | ${last?._count.results ?? 0} | ${last?.completedAt?.toISOString() ?? '-'}`,
    );
  }
  if (!materials.length) log('No previously searched active materials found.');
  if (options.mode === 'list' || options.dryRun || !materials.length) {
    log('Read-only: no searches started and no records changed.');
    return { completed: 0, failed: 0 };
  }

  let completed = 0;
  let failed = 0;
  for (const material of materials) {
    try {
      log(`Refreshing ${material.name}...`);
      const search = await service.start(material.id);
      log(`Search ID: ${search.id}`);
      let previousStatus = '';
      const deadline = Date.now() + 21 * 60 * 1000;
      while (true) {
        // Follow this exact search, even if a newer one is started elsewhere.
        const saved = await prisma.storeAvailabilitySearch.findUnique({
          where: { id: search.id },
          select: {
            status: true,
            error: true,
            _count: { select: { results: true } },
          },
        });
        if (!saved) throw new Error('The search record was removed.');
        if (saved.status !== previousStatus) {
          log(
            `${material.name}: ${saved.status} (${saved._count.results} saved store rows)`,
          );
          previousStatus = saved.status;
        }
        if (saved.status === 'COMPLETED') {
          completed++;
          break;
        }
        if (saved.status === 'FAILED')
          throw new Error(saved.error ?? 'Search failed.');
        if (!['PENDING', 'RANKING'].includes(saved.status)) {
          throw new Error(`Unexpected search status: ${saved.status}`);
        }
        if (Date.now() >= deadline) {
          // Stop the batch: do not start more work while this job may still run.
          throw new RefreshTimeoutError(
            `Timed out waiting for search ${search.id}. Check its saved status before retrying.`,
          );
        }
        await sleep();
      }
    } catch (error) {
      if (error instanceof RefreshTimeoutError) throw error;
      failed++;
      // Provider and database exception details may contain sensitive values.
      log(
        `${material.name}: refresh failed. Check the saved search status and provider configuration.`,
      );
    }
  }
  log(
    `Finished: ${completed} completed, ${failed} failed. Reopen Store Availability to see saved results.`,
  );
  return { completed, failed };
}

class RefreshTimeoutError extends Error {}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.mode === 'help') {
    console.log(HELP);
    return;
  }
  // Resolve paths from this tool so it also works outside the backend directory.
  process.chdir(resolve(__dirname, '..'));
  loadEnvFile();
  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    const summary = await refreshStoreData(
      prisma,
      new StoreAvailabilityService(prisma),
      options,
    );
    if (summary.failed) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch(() => {
    console.error(
      'Store-data tool failed. Check arguments (--help), database connection, and provider configuration.',
    );
    process.exitCode = 1;
  });
}
