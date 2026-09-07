import { Prisma } from '@prisma/client';
import { AvailabilityService } from '../src/availability/availability.service';
import { CurrentSummaryRepairService } from '../src/availability/current-summary-repair.service';
import { InventoryStateHistoryService } from '../src/availability/inventory-state-history.service';
import { PrismaService } from '../src/prisma/prisma.service';

type ScriptOptions = {
  apply: boolean;
};

function parseArgs(argv: string[]): ScriptOptions {
  return {
    apply: argv.includes('--apply'),
  };
}

function formatDecimal(value: Prisma.Decimal | null | undefined) {
  return value ? value.toString() : 'null';
}

function formatDate(value: Date | null | undefined) {
  return value ? value.toISOString() : 'null';
}

function printRawMaterialPlan(
  plan: Awaited<ReturnType<CurrentSummaryRepairService['buildPlan']>>,
) {
  console.log('Raw-material summary changes:');
  if (plan.rawMaterials.length === 0) {
    console.log('  none');
    return;
  }

  for (const row of plan.rawMaterials) {
    console.log(
      [
        `  ${row.rawMaterialId}`,
        row.rawMaterialName,
        `reasons=${row.reasons.join('+')}`,
        `existing(onHand=${formatDecimal(row.existingSummary?.onHandQuantity)}, usable=${formatDecimal(row.existingSummary?.usableQuantity)}, activeBatches=${row.existingSummary?.activeBatchCount ?? 'null'}, nearestExpiry=${formatDate(row.existingSummary?.nearestExpiryDate)})`,
        `expected(onHand=${formatDecimal(row.expectedSummary.onHandQuantity)}, usable=${formatDecimal(row.expectedSummary.usableQuantity)}, activeBatches=${row.expectedSummary.activeBatchCount}, nearestExpiry=${formatDate(row.expectedSummary.nearestExpiryDate)})`,
        `remaining(total=${formatDecimal(row.totalRemainingQuantity)}, nonExpired=${formatDecimal(row.nonExpiredRemainingQuantity)}, expired=${formatDecimal(row.expiredRemainingQuantity)})`,
        `stockoutEvent=${row.predictedStockoutEventAction}`,
      ].join(' | '),
    );
  }
}

function printVariantPlan(
  plan: Awaited<ReturnType<CurrentSummaryRepairService['buildPlan']>>,
) {
  console.log('Variant summary changes:');
  if (plan.variants.length === 0) {
    console.log('  none');
    return;
  }

  for (const row of plan.variants) {
    console.log(
      [
        `  ${row.productVariantId}`,
        `${row.productName} / ${row.productVariantName}`,
        `reasons=${row.reasons.join('+')}`,
        `existing(inStock=${row.existingSummary?.isInStock ?? 'null'}, sellable=${row.existingSummary?.isSellable ?? 'null'}, availableBaseQty=${row.existingSummary?.availableBaseQty ?? 'null'}, blocking=${row.existingSummary?.blockingReason ?? 'null'})`,
        `expected(inStock=${row.expectedSummary.isInStock}, sellable=${row.expectedSummary.isSellable}, availableBaseQty=${row.expectedSummary.availableBaseQty}, blocking=${row.expectedSummary.blockingReason})`,
        `availabilityEvent=${row.predictedAvailabilityEvent}`,
      ].join(' | '),
    );
  }
}

async function ensureLocalImsDb(prisma: PrismaService) {
  const [{ current_database: currentDatabase }] = await prisma.$queryRaw<
    Array<{ current_database: string }>
  >`SELECT current_database();`;

  if (currentDatabase !== 'ims_db') {
    throw new Error(
      `Refusing to run summary repair outside local ims_db. Current database: ${currentDatabase}`,
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaService();
  const inventoryStateHistoryService = new InventoryStateHistoryService();
  const availabilityService = new AvailabilityService(
    prisma,
    inventoryStateHistoryService,
  );
  const repairService = new CurrentSummaryRepairService(
    prisma,
    availabilityService,
  );

  await prisma.$connect();

  try {
    await ensureLocalImsDb(prisma);

    const plan = await repairService.buildPlan();

    console.log(`Mode: ${options.apply ? 'APPLY' : 'DRY_RUN'}`);
    console.log(`Reference date: ${plan.referenceDate}`);
    console.log(
      `Planned summary changes: rawMaterials=${plan.rawMaterials.length}, variants=${plan.variants.length}`,
    );
    printRawMaterialPlan(plan);
    printVariantPlan(plan);

    if (!options.apply) {
      return;
    }

    const result = await repairService.applyPlan(plan);
    console.log(
      `Applied summary repair: rawMaterials=${result.rawMaterialIds.length}, variants=${result.variantIds.length}`,
    );

    const verificationPlan = await repairService.buildPlan();
    console.log(
      `Post-apply verification: rawMaterials=${verificationPlan.rawMaterials.length}, variants=${verificationPlan.variants.length}`,
    );

    if (
      verificationPlan.rawMaterials.length > 0 ||
      verificationPlan.variants.length > 0
    ) {
      printRawMaterialPlan(verificationPlan);
      printVariantPlan(verificationPlan);
      throw new Error(
        'Summary repair was not idempotent after apply; remaining differences were detected.',
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Summary repair failed: ${message}`);
  process.exitCode = 1;
});

export { parseArgs };
