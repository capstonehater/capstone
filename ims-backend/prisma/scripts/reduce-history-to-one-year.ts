import 'reflect-metadata';
import {
  InventorySourceType,
  InventoryTransactionType,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { AvailabilityService } from '../../src/availability/availability.service';
import type { InventoryStateHistoryService } from '../../src/availability/inventory-state-history.service';
import type { PrismaService } from '../../src/prisma/prisma.service';

/** Retain Philippine business dates 2025-10-07 through 2026-10-06, inclusive. */
const START_UTC = new Date('2025-10-06T16:00:00.000Z');
// Database operational columns are timestamp WITHOUT time zone and store UTC.
// Date parameters would be converted through the server's Asia/Kuala_Lumpur
// session zone, shifting the retention boundary by eight hours.
const START_TS = Prisma.sql`TIMESTAMP '2025-10-06 16:00:00'`;
const END_TS = Prisma.sql`TIMESTAMP '2026-10-06 16:00:00'`;
const OPENING_SOURCE = 'one-year-opening-2025-10-07';
const prisma = new PrismaClient();

const COUNT_TABLES = [
  'users', 'access_roles', 'user_roles', 'permissions', 'role_permissions',
  'auth_sessions', 'password_reset_tokens', 'email_verification_tokens',
  'authorization_audit_events',
  'categories', 'products', 'product_variants', 'modifier_groups',
  'modifiers', 'product_modifier_groups',
  'variant_recipe_items', 'modifier_recipe_adjustments', 'suppliers',
  'raw_materials', 'units', 'orders', 'order_items',
  'order_item_modifiers', 'order_payments', 'order_reversals',
  'stock_runs', 'stock_run_items', 'stock_batches',
  'inventory_transactions', 'inventory_transaction_lines',
  'raw_material_inventory_summaries', 'variant_availability_summaries',
  'inventory_daily_snapshots', 'alerts', 'stockout_events',
  'variant_availability_events', 'outbox_events', 'forecast_runs',
  'forecast_series', 'forecast_points', 'forecast_recommendations',
  'forecast_settings',
] as const;

type CountTable = (typeof COUNT_TABLES)[number];
type Tx = Prisma.TransactionClient;

async function counts(tx: Tx): Promise<Record<CountTable, number>> {
  const result = {} as Record<CountTable, number>;
  for (const table of COUNT_TABLES) {
    // Table names come only from the constant list above.
    const rows = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count FROM "${table}"`,
    );
    result[table] = Number(rows[0].count);
  }
  return result;
}

async function scalar(tx: Tx, query: Prisma.Sql): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ count: bigint }>>(query);
  return Number(rows[0].count);
}

async function verifyRetainedState(tx: Tx, masterBefore: Record<CountTable, number>) {
  const masterTables: CountTable[] = [
    'users', 'access_roles', 'user_roles', 'permissions', 'role_permissions',
    'auth_sessions', 'password_reset_tokens', 'email_verification_tokens',
    'authorization_audit_events',
    'categories', 'products', 'product_variants', 'modifier_groups',
    'modifiers', 'product_modifier_groups',
    'variant_recipe_items', 'modifier_recipe_adjustments',
    'suppliers', 'raw_materials', 'units', 'forecast_settings',
  ];
  const after = await counts(tx);
  for (const table of masterTables) {
    if (after[table] !== masterBefore[table]) {
      throw new Error(`Preserved master table ${table} changed; rolling back.`);
    }
  }

  const wrongDates = await scalar(tx, Prisma.sql`
    SELECT (
      (SELECT COUNT(*) FROM orders WHERE completed_at < ${START_TS} OR completed_at >= ${END_TS}) +
      (SELECT COUNT(*) FROM stock_runs WHERE posted_at < ${START_TS} OR posted_at >= ${END_TS}) +
      (SELECT COUNT(*) FROM inventory_transactions WHERE occurred_at < ${START_TS} OR occurred_at >= ${END_TS}) +
      (SELECT COUNT(*) FROM stock_batches WHERE received_at >= ${END_TS}) +
      (SELECT COUNT(*) FROM inventory_daily_snapshots WHERE snapshot_date < DATE '2025-10-07' OR snapshot_date > DATE '2026-10-06') +
      (SELECT COUNT(*) FROM forecast_runs WHERE history_end < DATE '2025-12-05' OR history_end > DATE '2026-10-06')
    )::bigint AS count
  `);
  if (wrongDates !== 0) throw new Error(`${wrongDates} retained records fall outside the allowed dates.`);

  const badLedger = await scalar(tx, Prisma.sql`
    SELECT COUNT(*)::bigint AS count FROM stock_batches b
    WHERE b.remaining_quantity < 0
       OR b.remaining_quantity > b.initial_quantity + 0.0001
       OR ABS(b.remaining_quantity - COALESCE((
         SELECT SUM(l.quantity_delta) FROM inventory_transaction_lines l WHERE l.stock_batch_id = b.id
       ), 0)) > 0.0001
  `);
  if (badLedger !== 0) throw new Error(`${badLedger} retained batch balances disagree with the ledger.`);

  const badSummary = await scalar(tx, Prisma.sql`
    WITH balances AS (
      SELECT raw_material_id, SUM(remaining_quantity) AS quantity
      FROM stock_batches GROUP BY raw_material_id
    )
    SELECT COUNT(*)::bigint AS count FROM raw_materials m
    LEFT JOIN balances b ON b.raw_material_id = m.id
    LEFT JOIN raw_material_inventory_summaries s ON s.raw_material_id = m.id
    WHERE s.raw_material_id IS NULL
       OR ABS(COALESCE(b.quantity, 0) - s.on_hand_quantity) > 0.0001
       OR s.on_hand_quantity < 0 OR s.usable_quantity < 0
       OR s.usable_quantity > s.on_hand_quantity + 0.0001
  `);
  if (badSummary !== 0) throw new Error(`${badSummary} material summaries disagree with retained batches.`);

  const badSources = await scalar(tx, Prisma.sql`
    SELECT COUNT(*)::bigint AS count FROM inventory_transactions t
    WHERE (t.source_type = 'ORDER' AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = t.source_id))
       OR (t.source_type = 'STOCK_RUN' AND NOT EXISTS (SELECT 1 FROM stock_runs r WHERE r.id = t.source_id))
       OR (t.source_type IN ('ORDER_VOID', 'ORDER_REFUND')
           AND NOT EXISTS (SELECT 1 FROM order_reversals r WHERE r.id = t.source_id))
       OR (t.source_type = 'WASTE' AND NOT EXISTS (SELECT 1 FROM stock_batches b WHERE b.id = t.source_id))
  `);
  if (badSources !== 0) throw new Error(`${badSources} inventory source links are orphaned.`);

  const latestHistory = await tx.$queryRaw<Array<{
    latest_snapshot: string | null; latest_order_day: string | null;
  }>>`SELECT
    (SELECT to_char(MAX(snapshot_date), 'YYYY-MM-DD') FROM inventory_daily_snapshots) AS latest_snapshot,
    (SELECT to_char(MAX((completed_at + INTERVAL '8 hours')::date), 'YYYY-MM-DD') FROM orders) AS latest_order_day`;
  if (latestHistory[0].latest_snapshot !== '2026-10-06' ||
      latestHistory[0].latest_order_day !== '2026-10-06') {
    throw new Error('The latest retained actual snapshot and POS sale must be October 6, 2026.');
  }

  const latest = await tx.forecastRun.findFirst({
    orderBy: { historyEnd: 'desc' },
    select: { historyEnd: true, startDate: true },
  });
  if (latest?.historyEnd?.toISOString().slice(0, 10) !== '2026-10-06' ||
      latest.startDate.toISOString().slice(0, 10) !== '2026-10-07') {
    throw new Error('The latest forecast must train through October 6 and start October 7, 2026.');
  }
  return after;
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('One-year synthetic history reduction is disabled in production.');
  }

  await prisma.$transaction(async (tx) => {
    // Stop concurrent operational writes until all dependent deletes and checks commit.
    await tx.$executeRawUnsafe(`LOCK TABLE
      orders, order_items, order_item_modifiers, order_payments, order_reversals,
      stock_runs, stock_run_items, stock_batches, stock_run_reference_counters,
      inventory_transactions, inventory_transaction_lines,
      inventory_daily_snapshots, raw_material_inventory_summaries,
      variant_availability_summaries, alerts, stockout_events,
      variant_availability_events, outbox_events,
      store_availability_searches, store_availability_results,
      forecast_runs, forecast_series, forecast_points, forecast_recommendations
      IN ACCESS EXCLUSIVE MODE`);

    const before = await counts(tx);
    console.log('Before reduction:', JSON.stringify(before, null, 2));
    if (before.orders < 10_000 || before.stock_runs < 300) {
      throw new Error('The expected five-year history is absent. This script is for the current dataset and runs only once.');
    }
    const previousOpening = await tx.inventoryTransaction.findFirst({
      where: { sourceType: InventorySourceType.SYSTEM_IMPORT, sourceId: OPENING_SOURCE },
      select: { id: true },
    });
    if (previousOpening) throw new Error('Opening balance marker already exists; refusing a second reduction.');

    await tx.$executeRaw`CREATE TEMP TABLE keep_orders ON COMMIT DROP AS
      SELECT id FROM orders WHERE completed_at >= ${START_TS} AND completed_at < ${END_TS}`;
    await tx.$executeRaw`CREATE TEMP TABLE keep_runs ON COMMIT DROP AS
      SELECT id FROM stock_runs WHERE posted_at >= ${START_TS} AND posted_at < ${END_TS}`;
    await tx.$executeRaw`CREATE TEMP TABLE opening_balances ON COMMIT DROP AS
      SELECT b.id AS batch_id, b.raw_material_id,
        COALESCE(old_lines.balance, 0)::numeric(14,4) AS balance
      FROM stock_batches b
      LEFT JOIN (
        SELECT l.stock_batch_id, SUM(l.quantity_delta) AS balance
        FROM inventory_transaction_lines l
        JOIN inventory_transactions t ON t.id = l.inventory_transaction_id
        WHERE t.occurred_at < ${START_TS}
        GROUP BY l.stock_batch_id
      ) old_lines ON old_lines.stock_batch_id = b.id
      WHERE b.received_at < ${START_TS}`;
    const negativeOpening = await scalar(tx, Prisma.sql`
      SELECT COUNT(*)::bigint AS count FROM opening_balances WHERE balance < 0
    `);
    if (negativeOpening) throw new Error(`${negativeOpening} batches have negative opening balances.`);

    await tx.$executeRaw`CREATE TEMP TABLE keep_batches ON COMMIT DROP AS
      SELECT b.id FROM stock_batches b
      LEFT JOIN opening_balances opening ON opening.batch_id = b.id
      WHERE (b.received_at >= ${START_TS} AND b.received_at < ${END_TS})
         OR (b.received_at < ${START_TS} AND (
              opening.balance > 0 OR EXISTS (
                SELECT 1 FROM inventory_transaction_lines l
                JOIN inventory_transactions t ON t.id = l.inventory_transaction_id
                WHERE l.stock_batch_id = b.id
                  AND t.occurred_at >= ${START_TS} AND t.occurred_at < ${END_TS}
              )))`;

    await tx.$executeRaw`CREATE TEMP TABLE keep_transactions ON COMMIT DROP AS
      SELECT t.id FROM inventory_transactions t
      WHERE t.occurred_at >= ${START_TS} AND t.occurred_at < ${END_TS}
        AND (
          (t.source_type = 'ORDER' AND EXISTS (SELECT 1 FROM keep_orders o WHERE o.id = t.source_id))
          OR (t.source_type = 'STOCK_RUN' AND EXISTS (SELECT 1 FROM keep_runs r WHERE r.id = t.source_id))
          OR (t.source_type IN ('ORDER_REFUND', 'ORDER_VOID')
              AND EXISTS (SELECT 1 FROM order_reversals r WHERE r.id = t.source_id))
          OR (t.source_type = 'WASTE' AND EXISTS (SELECT 1 FROM keep_batches b WHERE b.id = t.source_id))
          OR t.source_type IN ('SYSTEM_IMPORT', 'INVENTORY_ADJUSTMENT')
        )`;

    const excludedInWindow = await scalar(tx, Prisma.sql`
      SELECT COUNT(*)::bigint AS count FROM inventory_transactions t
      WHERE t.occurred_at >= ${START_TS} AND t.occurred_at < ${END_TS}
        AND NOT EXISTS (SELECT 1 FROM keep_transactions k WHERE k.id = t.id)
    `);
    if (excludedInWindow) throw new Error(`${excludedInWindow} in-window ledger transactions have unsupported sources.`);
    const invalidKeptBatch = await scalar(tx, Prisma.sql`
      SELECT COUNT(*)::bigint AS count FROM inventory_transaction_lines l
      JOIN keep_transactions k ON k.id = l.inventory_transaction_id
      WHERE NOT EXISTS (SELECT 1 FROM keep_batches b WHERE b.id = l.stock_batch_id)
    `);
    if (invalidKeptBatch) throw new Error(`${invalidKeptBatch} retained ledger lines point to batches outside the window.`);

    const plan = await tx.$queryRaw<Array<{
      orders: bigint; runs: bigint; batches: bigint; transactions: bigint;
      openingLines: bigint; crossBoundaryReversals: bigint;
    }>>`SELECT
      (SELECT COUNT(*) FROM keep_orders)::bigint AS orders,
      (SELECT COUNT(*) FROM keep_runs)::bigint AS runs,
      (SELECT COUNT(*) FROM keep_batches)::bigint AS batches,
      (SELECT COUNT(*) FROM keep_transactions)::bigint AS transactions,
      (SELECT COUNT(*) FROM opening_balances o JOIN keep_batches b ON b.id=o.batch_id WHERE o.balance>0)::bigint AS "openingLines",
      (SELECT COUNT(*) FROM inventory_transactions t JOIN keep_transactions k ON k.id=t.id
       JOIN order_reversals r ON r.id=t.source_id
       WHERE t.source_type IN ('ORDER_REFUND','ORDER_VOID')
         AND NOT EXISTS (SELECT 1 FROM keep_orders o WHERE o.id=r.order_id))::bigint AS "crossBoundaryReversals"`;
    console.log('Retention plan:', JSON.stringify(plan[0], (_key, value) =>
      typeof value === 'bigint' ? Number(value) : value, 2));

    // Keep an actual in-window stock return whose old order is being removed.
    // Its original reversal identity stays in metadata for auditability.
    await tx.$executeRaw`UPDATE inventory_transaction_lines l
      SET order_item_id = NULL
      FROM inventory_transactions t, order_reversals r
      WHERE l.inventory_transaction_id=t.id AND r.id=t.source_id
        AND EXISTS (SELECT 1 FROM keep_transactions k WHERE k.id=t.id)
        AND t.source_type IN ('ORDER_REFUND','ORDER_VOID')
        AND NOT EXISTS (SELECT 1 FROM keep_orders o WHERE o.id=r.order_id)`;
    await tx.$executeRaw`UPDATE inventory_transactions t
      SET type='ADJUSTMENT', source_type='INVENTORY_ADJUSTMENT', source_id=NULL,
          reason_code='ONE_YEAR_BOUNDARY_REVERSAL',
          metadata=COALESCE(t.metadata, '{}'::jsonb) || jsonb_build_object(
            'retentionOriginalSourceId', t.source_id,
            'retentionOriginalSourceType', t.source_type::text,
            'retentionOriginalType', t.type::text,
            'retentionOriginalOrderId', r.order_id,
            'retentionBoundary', '2025-10-07'),
          updated_at=(NOW() AT TIME ZONE 'UTC')
      FROM order_reversals r
      WHERE r.id=t.source_id AND EXISTS (SELECT 1 FROM keep_transactions k WHERE k.id=t.id)
        AND t.source_type IN ('ORDER_REFUND','ORDER_VOID')
        AND NOT EXISTS (SELECT 1 FROM keep_orders o WHERE o.id=r.order_id)`;

    // Transaction lines are removed before order items and batches that they reference.
    await tx.$executeRaw`DELETE FROM inventory_transaction_lines l
      WHERE NOT EXISTS (SELECT 1 FROM keep_transactions k WHERE k.id=l.inventory_transaction_id)`;
    await tx.$executeRaw`DELETE FROM inventory_transactions t
      WHERE NOT EXISTS (SELECT 1 FROM keep_transactions k WHERE k.id=t.id)`;

    await tx.$executeRaw`DELETE FROM order_item_modifiers m
      WHERE NOT EXISTS (SELECT 1 FROM order_items i JOIN keep_orders k ON k.id=i.order_id WHERE i.id=m.order_item_id)`;
    await tx.$executeRaw`DELETE FROM order_payments p
      WHERE NOT EXISTS (SELECT 1 FROM keep_orders k WHERE k.id=p.order_id)`;
    await tx.$executeRaw`DELETE FROM order_reversals r
      WHERE NOT EXISTS (SELECT 1 FROM keep_orders k WHERE k.id=r.order_id)`;
    await tx.$executeRaw`DELETE FROM order_items i
      WHERE NOT EXISTS (SELECT 1 FROM keep_orders k WHERE k.id=i.order_id)`;
    await tx.$executeRaw`DELETE FROM orders o
      WHERE NOT EXISTS (SELECT 1 FROM keep_orders k WHERE k.id=o.id)`;

    await tx.$executeRaw`DELETE FROM forecast_points p WHERE NOT EXISTS (
      SELECT 1 FROM forecast_series s JOIN forecast_runs r ON r.id=s.run_id
      WHERE s.id=p.series_id AND r.history_end >= DATE '2025-12-05'
        AND r.history_end <= DATE '2026-10-06' AND r.start_date > r.history_end)`;
    await tx.$executeRaw`DELETE FROM forecast_recommendations c WHERE NOT EXISTS (
      SELECT 1 FROM forecast_series s JOIN forecast_runs r ON r.id=s.run_id
      WHERE s.id=c.series_id AND r.history_end >= DATE '2025-12-05'
        AND r.history_end <= DATE '2026-10-06' AND r.start_date > r.history_end)`;
    await tx.$executeRaw`DELETE FROM forecast_series s WHERE NOT EXISTS (
      SELECT 1 FROM forecast_runs r WHERE r.id=s.run_id
        AND r.history_end >= DATE '2025-12-05'
        AND r.history_end <= DATE '2026-10-06' AND r.start_date > r.history_end)`;
    await tx.$executeRaw`DELETE FROM forecast_runs r WHERE r.history_end IS NULL
      OR r.history_end < DATE '2025-12-05' OR r.history_end > DATE '2026-10-06'
      OR r.start_date <= r.history_end`;

    await tx.$executeRaw`DELETE FROM inventory_daily_snapshots
      WHERE snapshot_date < DATE '2025-10-07' OR snapshot_date > DATE '2026-10-06'`;
    await tx.$executeRaw`DELETE FROM alerts
      WHERE first_triggered_at < ${START_TS} OR first_triggered_at >= ${END_TS}
         OR last_triggered_at >= ${END_TS}
         OR acknowledged_at >= ${END_TS}
         OR dismissed_at >= ${END_TS}
         OR resolved_at >= ${END_TS}`;
    await tx.$executeRaw`DELETE FROM stockout_events
      WHERE started_at < ${START_TS} OR started_at >= ${END_TS}`;
    await tx.$executeRaw`UPDATE stockout_events SET ended_at=NULL
      WHERE ended_at >= ${END_TS}`;
    await tx.$executeRaw`DELETE FROM variant_availability_events
      WHERE occurred_at < ${START_TS} OR occurred_at >= ${END_TS}`;
    await tx.$executeRaw`DELETE FROM outbox_events
      WHERE created_at < ${START_TS} OR created_at >= ${END_TS}
         OR (aggregate_type='stock_run' AND NOT EXISTS (SELECT 1 FROM keep_runs r WHERE r.id=aggregate_id))
         OR (aggregate_type='order' AND NOT EXISTS (SELECT 1 FROM keep_orders o WHERE o.id=aggregate_id))`;
    await tx.$executeRaw`DELETE FROM store_availability_results result
      WHERE EXISTS (SELECT 1 FROM store_availability_searches search
        WHERE search.id=result.search_id AND (search.created_at < ${START_TS} OR search.created_at >= ${END_TS}))`;
    await tx.$executeRaw`DELETE FROM store_availability_searches
      WHERE created_at < ${START_TS} OR created_at >= ${END_TS}`;

    // An old receiving run can be removed while its batch is still needed.
    await tx.$executeRaw`UPDATE stock_batches b SET stock_run_item_id=NULL
      FROM stock_run_items i
      WHERE b.stock_run_item_id=i.id
        AND EXISTS (SELECT 1 FROM keep_batches k WHERE k.id=b.id)
        AND NOT EXISTS (SELECT 1 FROM keep_runs r WHERE r.id=i.stock_run_id)`;
    await tx.$executeRaw`DELETE FROM stock_batches b
      WHERE NOT EXISTS (SELECT 1 FROM keep_batches k WHERE k.id=b.id)`;
    await tx.$executeRaw`DELETE FROM stock_run_items i
      WHERE NOT EXISTS (SELECT 1 FROM keep_runs r WHERE r.id=i.stock_run_id)`;
    await tx.$executeRaw`DELETE FROM stock_runs r
      WHERE NOT EXISTS (SELECT 1 FROM keep_runs k WHERE k.id=r.id)`;
    await tx.$executeRaw`DELETE FROM stock_run_reference_counters
      WHERE run_date < DATE '2025-10-07' OR run_date > DATE '2026-10-06'`;

    const openingTransaction = await tx.inventoryTransaction.create({
      data: {
        type: InventoryTransactionType.SYSTEM_IMPORT,
        sourceType: InventorySourceType.SYSTEM_IMPORT,
        sourceId: OPENING_SOURCE,
        actorUserId: null,
        reasonCode: 'ONE_YEAR_OPENING_BALANCE',
        note: 'Actual batch balances carried forward from history before 2025-10-07.',
        metadata: { retentionBoundary: '2025-10-07', kind: 'historical-opening-balance' },
        occurredAt: START_UTC,
        createdAt: START_UTC,
      },
    });
    await tx.$executeRaw`INSERT INTO inventory_transaction_lines
      (id, inventory_transaction_id, raw_material_id, stock_batch_id,
       quantity_delta, unit_cost_snapshot, total_cost_delta, created_at)
      SELECT gen_random_uuid()::text, ${openingTransaction.id},
        o.raw_material_id, o.batch_id, o.balance, b.cost_per_unit,
        ROUND(o.balance * b.cost_per_unit, 4), ${START_TS}
      FROM opening_balances o JOIN keep_batches k ON k.id=o.batch_id
      JOIN stock_batches b ON b.id=o.batch_id WHERE o.balance > 0`;

    // The database's balance is derived from the retained ledger, including the
    // opening entry. Removing the October 9 receipt therefore removes its stock.
    await tx.$executeRaw`UPDATE stock_batches b
      SET remaining_quantity=COALESCE((SELECT SUM(l.quantity_delta)
        FROM inventory_transaction_lines l WHERE l.stock_batch_id=b.id),0),
        updated_at=(NOW() AT TIME ZONE 'UTC')`;

    // Reuse application calculations without emitting new history events.
    const availability = new AvailabilityService(
      prisma as unknown as PrismaService,
      null as unknown as InventoryStateHistoryService,
    );
    const materialIds = (await tx.rawMaterial.findMany({ select: { id: true } })).map((m) => m.id);
    const materialSummaries = await availability.computeRawMaterialSummarySnapshots(tx, materialIds);
    for (const summary of materialSummaries) {
      await tx.rawMaterialInventorySummary.upsert({
        where: { rawMaterialId: summary.rawMaterialId },
        update: {
          onHandQuantity: summary.onHandQuantity,
          usableQuantity: summary.usableQuantity,
          nearestExpiryDate: summary.nearestExpiryDate,
          activeBatchCount: summary.activeBatchCount,
        },
        create: {
          rawMaterialId: summary.rawMaterialId,
          onHandQuantity: summary.onHandQuantity,
          usableQuantity: summary.usableQuantity,
          nearestExpiryDate: summary.nearestExpiryDate,
          activeBatchCount: summary.activeBatchCount,
        },
      });
    }
    const variantIds = (await tx.productVariant.findMany({ select: { id: true } })).map((v) => v.id);
    const variantSummaries = await availability.computeVariantAvailabilitySnapshots(tx, variantIds);
    for (const summary of variantSummaries) {
      await tx.variantAvailabilitySummary.upsert({
        where: { productVariantId: summary.productVariantId },
        update: {
          isInStock: summary.isInStock,
          isSellable: summary.isSellable,
          availableBaseQty: summary.availableBaseQty,
          blockingReason: summary.blockingReason,
        },
        create: {
          productVariantId: summary.productVariantId,
          isInStock: summary.isInStock,
          isSellable: summary.isSellable,
          availableBaseQty: summary.availableBaseQty,
          blockingReason: summary.blockingReason,
        },
      });
    }

    const after = await verifyRetainedState(tx, before);
    console.log('After reduction:', JSON.stringify(after, null, 2));
    console.log('One-year history retained: 2025-10-07 through 2026-10-06 (Asia/Manila).');
  }, { maxWait: 30_000, timeout: 1_200_000 });
}

main()
  .catch((error: unknown) => {
    console.error('History reduction failed; the transaction was rolled back.', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
