import { Prisma, PrismaClient } from "@prisma/client";
import { generateVariantSku, makeMaterialSku } from "../../../ims-frontend/src/lib/sku-generation";

const prisma = new PrismaClient();

type MoneyTable = "orders" | "order_payments" | "order_reversals";
type ReferenceTable = "stock_runs" | "stock_batches";
type ReferenceUpdate = { id: string; reference: string };

function manilaDateStamp(date: Date): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}${part("month")}${part("day")}`;
}

function formatRunReference(dateStamp: string, sequence: number): string {
  const number = String(sequence);
  return `ST-RUN-${dateStamp}-${number.padStart(Math.max(3, number.length), "0")}`;
}

async function updateReferences(
  tx: Prisma.TransactionClient,
  table: ReferenceTable,
  updates: ReferenceUpdate[],
): Promise<void> {
  const quotedTable = Prisma.raw(`"${table}"`);
  for (let offset = 0; offset < updates.length; offset += 500) {
    const chunk = updates.slice(offset, offset + 500);
    const values = Prisma.join(chunk.map(({ id, reference }) => Prisma.sql`(${id}::text, ${reference}::text)`));
    await tx.$executeRaw(Prisma.sql`
      UPDATE ${quotedTable} AS target
      SET "reference" = source.reference
      FROM (VALUES ${values}) AS source(id, reference)
      WHERE target.id = source.id
    `);
  }
}

async function fractionalMoneyCount(
  tx: Prisma.TransactionClient,
  table: MoneyTable,
  column: string,
): Promise<number> {
  // Identifiers are restricted to this script's literal union / fixed column names.
  const rows = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE "${column}" <> ROUND("${column}")`,
  );
  return Number(rows[0]?.count ?? 0n);
}

async function main() {
  const before = await prisma.$transaction(async (tx) => {
    const [materials, variants, runAudit, stockRunReferences, batchReferences, orderCount, paymentCount, reversalCount,
      fractionalDiscounts, fractionalTaxes, fractionalTotals, fractionalPayments, fractionalReversals] = await Promise.all([
      tx.rawMaterial.findMany({ select: { id: true, name: true, sku: true, createdAt: true } }),
      tx.productVariant.findMany({
        select: { id: true, name: true, sku: true, createdAt: true, product: { select: { name: true } } },
      }),
      tx.stockRun.findMany({
        select: {
          status: true,
          postedAt: true,
          createdByUserId: true,
          _count: { select: { items: true } },
          items: { select: { supplierId: true, stockBatch: { select: { id: true } } } },
        },
      }),
      tx.stockRun.findMany({
        select: {
          reference: true,
          createdAt: true,
          items: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { stockBatch: { select: { reference: true } } },
          },
        },
      }),
      tx.stockBatch.findMany({ select: { reference: true } }),
      tx.order.count(),
      tx.orderPayment.count(),
      tx.orderReversal.count(),
      fractionalMoneyCount(tx, "orders", "discount_amount"),
      fractionalMoneyCount(tx, "orders", "tax_amount"),
      fractionalMoneyCount(tx, "orders", "total_amount"),
      fractionalMoneyCount(tx, "order_payments", "amount"),
      fractionalMoneyCount(tx, "order_reversals", "amount"),
    ]);

    const validMaterials = materials.filter((row) =>
      makeMaterialSku(row.name, materials.filter((candidate) => candidate.id !== row.id).map((candidate) => candidate.sku)) === row.sku,
    );
    const validVariants = variants.filter((row) => generateVariantSku(row.product.name, row.name) === row.sku);
    const problematicRuns = runAudit.filter((run) =>
      run.status === "POSTED" && (!run.postedAt || !run.createdByUserId || run._count.items === 0 ||
        run.items.some((item) => !item.supplierId || !item.stockBatch)),
    );
    const validRunReferences = new Set(stockRunReferences
      .map((run) => run.reference)
      .filter((reference) => /^ST-RUN-\d{8}-\d{3,}$/.test(reference)));
    const nonSystemBatchReferences = stockRunReferences.reduce((count, run) => {
      const expectedPrefix = /^ST-RUN-\d{8}-\d{3,}$/.test(run.reference) ? run.reference : "";
      return count + run.items.filter((item, index) =>
        item.stockBatch && item.stockBatch.reference !== `${expectedPrefix}-B${String(index + 1).padStart(2, "0")}`,
      ).length;
    }, 0);

    return {
      materialCount: materials.length,
      validMaterialSkuCount: validMaterials.length,
      materialSkuUpdates: materials.length - validMaterials.length,
      variantCount: variants.length,
      validVariantSkuCount: validVariants.length,
      variantSkuUpdates: variants.length - validVariants.length,
      stockRunCount: runAudit.length,
      problematicPostedRunCount: problematicRuns.length,
      stockRunReferencesAlreadyCanonical: validRunReferences.size,
      stockRunReferencesToRepair: stockRunReferences.length - validRunReferences.size,
      linkedBatchReferencesToRepair: nonSystemBatchReferences,
      stockBatchCount: batchReferences.length,
      orderCount,
      paymentCount,
      reversalCount,
      fractionalDiscounts,
      fractionalTaxes,
      fractionalTotals,
      fractionalPayments,
      fractionalReversals,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  console.log("Generated-data repair: before");
  console.log(JSON.stringify(before, null, 2));

  const after = await prisma.$transaction(async (tx) => {
    const materials = await tx.rawMaterial.findMany({
      select: { id: true, name: true, sku: true, createdAt: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const variants = await tx.productVariant.findMany({
      select: { id: true, name: true, sku: true, createdAt: true, product: { select: { name: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    const stockRunsForReferences = await tx.stockRun.findMany({
      select: {
        id: true,
        reference: true,
        createdAt: true,
        items: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true, stockBatch: { select: { id: true, reference: true } } },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    const occupiedRunReferences = new Set(stockRunsForReferences
      .map((run) => run.reference)
      .filter((reference) => /^ST-RUN-\d{8}-\d{3,}$/.test(reference)));
    const runReferenceUpdates: ReferenceUpdate[] = [];
    const sequenceByDate = new Map<string, number>();
    for (const run of stockRunsForReferences) {
      if (/^ST-RUN-\d{8}-\d{3,}$/.test(run.reference)) continue;
      const dateStamp = manilaDateStamp(run.createdAt);
      let sequence = sequenceByDate.get(dateStamp) ?? 1;
      let reference = formatRunReference(dateStamp, sequence);
      while (occupiedRunReferences.has(reference)) {
        sequence += 1;
        reference = formatRunReference(dateStamp, sequence);
      }
      occupiedRunReferences.add(reference);
      sequenceByDate.set(dateStamp, sequence + 1);
      runReferenceUpdates.push({ id: run.id, reference });
    }
    const referenceByRunId = new Map(stockRunsForReferences.map((run) => [run.id, run.reference]));
    for (const update of runReferenceUpdates) referenceByRunId.set(update.id, update.reference);

    const batchReferenceUpdates: ReferenceUpdate[] = [];
    for (const run of stockRunsForReferences) {
      const reference = referenceByRunId.get(run.id)!;
      run.items.forEach((item, index) => {
        if (!item.stockBatch) return;
        const expectedReference = `${reference}-B${String(index + 1).padStart(2, "0")}`;
        if (item.stockBatch.reference !== expectedReference) {
          batchReferenceUpdates.push({ id: item.stockBatch.id, reference: expectedReference });
        }
      });
    }
    const batchUpdatesById = new Map(batchReferenceUpdates.map((update) => [update.id, update.reference]));
    const allBatchReferences = await tx.stockBatch.findMany({ select: { id: true, reference: true } });
    const plannedBatchReferences = new Set<string>();
    for (const update of batchReferenceUpdates) {
      if (plannedBatchReferences.has(update.reference)) {
        throw new Error(`Duplicate stock batch reference planned: ${update.reference}; no data was committed.`);
      }
      plannedBatchReferences.add(update.reference);
      const conflictingBatch = allBatchReferences.find((batch) =>
        batch.reference === update.reference && !batchUpdatesById.has(batch.id),
      );
      if (conflictingBatch) {
        throw new Error(`Stock batch reference ${update.reference} is already used by an unrelated batch; no data was committed.`);
      }
    }

    // Stage changed references under temporary unique values so the unique indexes
    // remain satisfied while canonical run and batch identifiers are assigned.
    await updateReferences(tx, "stock_runs", runReferenceUpdates.map(({ id }) => ({ id, reference: `__repair_run_${id}` })));
    await updateReferences(tx, "stock_batches", batchReferenceUpdates.map(({ id }) => ({ id, reference: `__repair_batch_${id}` })));
    await updateReferences(tx, "stock_runs", runReferenceUpdates);
    await updateReferences(tx, "stock_batches", batchReferenceUpdates);

    let rawMaterialSkuUpdates = 0;
    // Reserve all currently valid values; allocate replacements only to invalid values.
    const validMaterialIds = new Set(materials.filter((row) =>
      makeMaterialSku(row.name, materials.filter((candidate) => candidate.id !== row.id).map((candidate) => candidate.sku)) === row.sku,
    ).map((row) => row.id));
    const reservedMaterialSkus = materials.filter((row) => validMaterialIds.has(row.id)).map((row) => row.sku);
    const invalidMaterials = materials.filter((row) => !validMaterialIds.has(row.id));
    // Free stale values in-transaction so they cannot conflict with a SKU produced by
    // the application helper. These temporary identifiers are never committed.
    for (const row of invalidMaterials) {
      await tx.rawMaterial.update({ where: { id: row.id }, data: { sku: `__sku_repair_${row.id}` } });
    }
    for (const row of materials) {
      if (validMaterialIds.has(row.id)) continue;
      const sku = makeMaterialSku(row.name, reservedMaterialSkus);
      await tx.rawMaterial.update({ where: { id: row.id }, data: { sku } });
      reservedMaterialSkus.push(sku);
      rawMaterialSkuUpdates += 1;
    }

    const expectedByVariantId = new Map(variants.map((row) => [row.id, generateVariantSku(row.product.name, row.name)]));
    const variantsByExpectedSku = new Map<string, typeof variants>();
    for (const row of variants) {
      const expectedSku = expectedByVariantId.get(row.id) ?? "";
      if (!expectedSku) continue;
      const group = variantsByExpectedSku.get(expectedSku) ?? [];
      group.push(row);
      variantsByExpectedSku.set(expectedSku, group);
    }
    const variantSkuConflicts = [...variantsByExpectedSku.entries()]
      .filter(([, group]) => group.length > 1)
      .map(([sku, group]) => ({
        sku,
        variants: group.map((row) => ({ id: row.id, product: row.product.name, variant: row.name, existingSku: row.sku })),
      }));
    const conflictedVariantIds = new Set(variantSkuConflicts.flatMap((conflict) => conflict.variants.map((row) => row.id)));

    const validVariantIds = new Set(variants.filter((row) => expectedByVariantId.get(row.id) === row.sku).map((row) => row.id));
    // The application helper does not resolve duplicate outputs. Keep every member
    // of such a collision unchanged rather than inventing a SKU format.
    const variantsToUpdate = variants.filter((row) => !validVariantIds.has(row.id) && !conflictedVariantIds.has(row.id));
    let productVariantSkuUpdates = 0;
    // Temporary values permit swaps/overlaps with stale values without violating the unique index.
    for (const row of variantsToUpdate) {
      await tx.productVariant.update({ where: { id: row.id }, data: { sku: `__sku_repair_${row.id}` } });
    }
    for (const row of variantsToUpdate) {
      const sku = expectedByVariantId.get(row.id);
      if (!sku) throw new Error(`Cannot derive application SKU for variant ${row.id}; no data was committed.`);
      await tx.productVariant.update({ where: { id: row.id }, data: { sku } });
      productVariantSkuUpdates += 1;
    }

    // Round only fractional order money snapshots and payment/reversal amounts. Prices,
    // quantities, COGS, methods, statuses, links, and transaction timestamps are untouched.
    const roundedOrderFields = await tx.$executeRaw`
      UPDATE "orders"
      SET "discount_amount" = ROUND("discount_amount"),
          "tax_amount" = ROUND("tax_amount"),
          "total_amount" = ROUND("total_amount"),
          "updated_at" = NOW()
      WHERE "discount_amount" <> ROUND("discount_amount")
         OR "tax_amount" <> ROUND("tax_amount")
         OR "total_amount" <> ROUND("total_amount")
    `;
    const roundedPaymentAmounts = await tx.$executeRaw`
      UPDATE "order_payments"
      SET "amount" = ROUND("amount"), "updated_at" = NOW()
      WHERE "amount" <> ROUND("amount")
    `;
    const roundedReversalAmounts = await tx.$executeRaw`
      UPDATE "order_reversals"
      SET "amount" = ROUND("amount"), "updated_at" = NOW()
      WHERE "amount" <> ROUND("amount")
    `;

    const [stockRunAudit, repairedMaterials, repairedVariants, repairedRunReferences, repairedBatchReferences, fractionalDiscounts,
      fractionalTaxes, fractionalTotals, fractionalPayments, fractionalReversals] = await Promise.all([
      tx.stockRun.findMany({
        select: { status: true, postedAt: true, createdByUserId: true, _count: { select: { items: true } },
          items: { select: { supplierId: true, stockBatch: { select: { id: true } } } } },
      }),
      tx.rawMaterial.findMany({ select: { id: true, name: true, sku: true } }),
      tx.productVariant.findMany({ select: { id: true, name: true, sku: true, product: { select: { name: true } } } }),
      tx.stockRun.findMany({
        select: { reference: true, createdAt: true, items: { orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { stockBatch: { select: { reference: true } } } } },
      }),
      tx.stockBatch.findMany({ select: { reference: true } }),
      fractionalMoneyCount(tx, "orders", "discount_amount"),
      fractionalMoneyCount(tx, "orders", "tax_amount"),
      fractionalMoneyCount(tx, "orders", "total_amount"),
      fractionalMoneyCount(tx, "order_payments", "amount"),
      fractionalMoneyCount(tx, "order_reversals", "amount"),
    ]);
    const problematicPostedRunCount = stockRunAudit.filter((run) =>
      run.status === "POSTED" && (!run.postedAt || !run.createdByUserId || run._count.items === 0 ||
        run.items.some((item) => !item.supplierId || !item.stockBatch)),
    ).length;
    const validMaterialSkuCount = repairedMaterials.filter((row) =>
      makeMaterialSku(row.name, repairedMaterials.filter((candidate) => candidate.id !== row.id).map((candidate) => candidate.sku)) === row.sku,
    ).length;
    const validVariantSkuCount = repairedVariants.filter((row) =>
      generateVariantSku(row.product.name, row.name) === row.sku,
    ).length;
    const nonCanonicalRunReferenceCount = repairedRunReferences.filter((run) =>
      !/^ST-RUN-\d{8}-\d{3,}$/.test(run.reference),
    ).length;
    const nonCanonicalBatchReferenceCount = repairedRunReferences.reduce((count, run) => {
      const validRunReference = /^ST-RUN-\d{8}-\d{3,}$/.test(run.reference);
      return count + run.items.filter((item, index) =>
        item.stockBatch && (!validRunReference || item.stockBatch.reference !== `${run.reference}-B${String(index + 1).padStart(2, "0")}`),
      ).length;
    }, 0);

    return {
      rawMaterialSkuUpdates,
      productVariantSkuUpdates,
      unresolvedVariantSkuConflictCount: conflictedVariantIds.size,
      unresolvedVariantSkuConflicts: variantSkuConflicts,
      roundedOrderFields: Number(roundedOrderFields),
      roundedPaymentAmounts: Number(roundedPaymentAmounts),
      roundedReversalAmounts: Number(roundedReversalAmounts),
      rawMaterialCount: repairedMaterials.length,
      validMaterialSkuCount,
      productVariantCount: repairedVariants.length,
      validVariantSkuCount,
      stockRunCount: stockRunAudit.length,
      stockRunReferencesUpdated: runReferenceUpdates.length,
      nonCanonicalStockRunReferences: nonCanonicalRunReferenceCount,
      linkedBatchReferencesUpdated: batchReferenceUpdates.length,
      nonCanonicalLinkedBatchReferences: nonCanonicalBatchReferenceCount,
      stockBatchCount: repairedBatchReferences.length,
      problematicPostedRunCount,
      fractionalDiscounts,
      fractionalTaxes,
      fractionalTotals,
      fractionalPayments,
      fractionalReversals,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });

  console.log("Generated-data repair: after");
  console.log(JSON.stringify(after, null, 2));
  if (after.problematicPostedRunCount > 0) {
    console.warn("Some POSTED stock runs still fail the integrity audit. No batches or relationships were fabricated.");
  }
  if (after.unresolvedVariantSkuConflictCount > 0) {
    console.warn("Some variant SKUs remain unchanged because the application generator returns duplicate values. Resolve these product/variant name collisions in application logic before repairing them.");
  }
}

main()
  .catch((error: unknown) => {
    console.error("Generated-data repair failed; transaction rolled back.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
