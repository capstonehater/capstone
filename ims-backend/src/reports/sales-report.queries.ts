import { PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SalesAmounts } from './report-accounting';

export type SalesRange = { from: Date; to: Date };
export type SalesQueryFilters = {
  staffSearch?: string;
  paymentMethod?: PaymentMethod;
};
export type SalesBucketRow = SalesAmounts & {
  completedAt: Date;
  subtotalAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  transactionCount: number;
};
export type SalesHourRow = {
  hour: number;
  grossSales: Prisma.Decimal;
  netSales: Prisma.Decimal;
  transactionCount: number;
};
export type VariantMarginRow = {
  productVariantId: string;
  productName: string;
  variantName: string;
  sku: string;
  quantitySold: number;
  revenue: Prisma.Decimal;
  cogs: Prisma.Decimal;
};

// Prisma DateTime columns store UTC in timestamp WITHOUT time zone. Convert
// explicitly so business-day grouping never depends on the database timezone.
// Bind ISO strings before casting to timestamp: Date parameters arrive as
// timestamptz and a direct cast would shift them by the session timezone.

// Use stored checkout VAT rather than re-taxing historical orders at today's rate.
// A refund is an adjustment on its own date; changing order status must not erase
// the original sale or cause its refund to be deducted a second time.
function salesEvents() {
  return Prisma.sql`
    checkout_costs AS (
      SELECT t.source_id AS order_id, SUM(-l.total_cost_delta) AS cost
      FROM inventory_transactions t JOIN inventory_transaction_lines l ON l.inventory_transaction_id = t.id
      WHERE t.type = 'CHECKOUT' AND t.source_type = 'ORDER'
      GROUP BY t.source_id
    ), checkout_item_costs AS (
      SELECT l.order_item_id AS item_id, SUM(-l.total_cost_delta) AS cost
      FROM inventory_transactions t JOIN inventory_transaction_lines l ON l.inventory_transaction_id = t.id
      WHERE t.type = 'CHECKOUT' AND t.source_type = 'ORDER' AND l.order_item_id IS NOT NULL
      GROUP BY l.order_item_id
    ),
    sales_events AS (
      SELECT o.id AS order_id, o.created_by_user_id, o.completed_at AS occurred_at,
        o.subtotal_amount - ROUND((o.subtotal_amount - o.total_amount) *
          CASE WHEN o.total_amount > 0 THEN o.tax_amount / o.total_amount ELSE 0 END, 2) - o.tax_amount AS gross,
        o.subtotal_amount - o.total_amount - ROUND((o.subtotal_amount - o.total_amount) *
          CASE WHEN o.total_amount > 0 THEN o.tax_amount / o.total_amount ELSE 0 END, 2) AS discount,
        o.total_amount - o.tax_amount AS net, o.tax_amount AS tax,
        o.total_amount AS collected, 0::numeric AS refund,
        COALESCE(c.cost, o.total_cogs_amount) AS cogs, 1 AS transactions, 1::numeric AS item_factor
      FROM orders o LEFT JOIN checkout_costs c ON c.order_id = o.id
      UNION ALL
      SELECT o.id, o.created_by_user_id, r.occurred_at,
        CASE WHEN r.type = 'VOID' THEN -(o.subtotal_amount - ROUND((o.subtotal_amount - o.total_amount) *
          CASE WHEN o.total_amount > 0 THEN o.tax_amount / o.total_amount ELSE 0 END, 2) - o.tax_amount) ELSE 0 END,
        CASE WHEN r.type = 'VOID' THEN -(o.subtotal_amount - o.total_amount - ROUND((o.subtotal_amount - o.total_amount) *
          CASE WHEN o.total_amount > 0 THEN o.tax_amount / o.total_amount ELSE 0 END, 2)) ELSE 0 END,
        -(r.amount - CASE WHEN o.total_amount > 0 THEN r.amount * o.tax_amount / o.total_amount ELSE 0 END),
        -CASE WHEN o.total_amount > 0 THEN r.amount * o.tax_amount / o.total_amount ELSE 0 END,
        -r.amount,
        CASE WHEN r.type = 'REFUND' THEN r.amount -
          CASE WHEN o.total_amount > 0 THEN r.amount * o.tax_amount / o.total_amount ELSE 0 END ELSE 0 END,
        -COALESCE(c.cost, o.total_cogs_amount) * CASE WHEN o.total_amount > 0 THEN r.amount / o.total_amount ELSE 1 END,
        0,
        -CASE WHEN o.total_amount > 0 THEN r.amount / o.total_amount ELSE 1 END
      FROM order_reversals r JOIN orders o ON o.id = r.order_id LEFT JOIN checkout_costs c ON c.order_id = o.id
    )`;
}

// Cumulative allocation keeps every item amount at cents and preserves the
// exact order total, even when a discount splits unevenly between items.
function itemEvents() {
  return Prisma.sql`${salesEvents()}, item_shares AS (
    SELECT i.*, e.occurred_at, e.item_factor, e.net, o.subtotal_amount AS order_subtotal,
      COALESCE(c.cost, i.line_cogs_amount) AS recorded_item_cost,
      SUM(i.line_subtotal) OVER (
        PARTITION BY e.order_id, e.occurred_at, e.item_factor ORDER BY i.id
      ) AS cumulative_subtotal
    FROM sales_events e JOIN orders o ON o.id = e.order_id
    JOIN order_items i ON i.order_id = o.id
    LEFT JOIN checkout_item_costs c ON c.item_id = i.id
  ), item_events AS (
    SELECT s.*, s.quantity * s.item_factor AS quantity_sold,
      s.recorded_item_cost * s.item_factor AS cogs,
      CASE WHEN s.order_subtotal > 0 THEN
        ROUND(s.net * s.cumulative_subtotal / s.order_subtotal, 2) -
        ROUND(s.net * (s.cumulative_subtotal - s.line_subtotal) / s.order_subtotal, 2)
        ELSE 0 END AS revenue
    FROM item_shares s
  )`;
}

const EVENT_LOCAL_TIME = Prisma.sql`e.occurred_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila'`;
const EVENT_SUMS = Prisma.sql`
  SUM(e.gross) AS "subtotalAmount", SUM(e.discount) AS "discountAmount",
  SUM(e.net) AS "totalAmount", SUM(e.tax) AS "taxAmount",
  SUM(e.refund) AS refunds, SUM(e.cogs) AS cogs,
  SUM(e.collected) AS "collectedAmount", SUM(e.transactions)::integer AS "transactionCount"`;

function orderFilters(filters: SalesQueryFilters) {
  const clauses: Prisma.Sql[] = [];
  const search = filters.staffSearch?.trim();
  if (search) {
    const pattern = `%${search}%`;
    clauses.push(Prisma.sql`EXISTS (
      SELECT 1 FROM users u WHERE u.id = o.created_by_user_id
      AND (u.email ILIKE ${pattern} OR u.first_name ILIKE ${pattern}
        OR u.last_name ILIKE ${pattern})
    )`);
  }
  if (filters.paymentMethod) {
    // EXISTS avoids counting split-tender orders more than once.
    clauses.push(Prisma.sql`EXISTS (
      SELECT 1 FROM order_payments p WHERE p.order_id = o.id
      AND p.method = ${filters.paymentMethod}::"PaymentMethod"
    )`);
  }
  return clauses.length
    ? Prisma.sql`AND ${Prisma.join(clauses, ' AND ')}`
    : Prisma.empty;
}

export class SalesReportQueries {
  constructor(private readonly prisma: PrismaService) {}

  variantMargins(
    filters: { from?: string; to?: string },
    limit: number,
    sortBy: 'revenue' | 'margin',
  ) {
    const dates: Prisma.Sql[] = [];
    if (filters.from)
      dates.push(
        Prisma.sql`i.occurred_at >= ${new Date(filters.from).toISOString()}::timestamp`,
      );
    if (filters.to)
      dates.push(
        Prisma.sql`i.occurred_at <= ${new Date(filters.to).toISOString()}::timestamp`,
      );
    const dateFilter = dates.length
      ? Prisma.sql`AND ${Prisma.join(dates, ' AND ')}`
      : Prisma.empty;
    const sort =
      sortBy === 'margin'
        ? Prisma.sql`t.revenue - t.cogs DESC`
        : Prisma.sql`t.revenue DESC`;
    return this.prisma.$queryRaw<VariantMarginRow[]>(Prisma.sql`
      WITH ${itemEvents()}, matched_items AS (
        SELECT COALESCE(i.product_variant_id, 'deleted:' || i.sku_snapshot) AS variant_key,
          i.product_name_snapshot, i.variant_name_snapshot, i.sku_snapshot,
          i.quantity_sold AS quantity, i.revenue AS line_subtotal,
          i.cogs AS line_cogs_amount, i.occurred_at AS completed_at, i.id
        FROM item_events i WHERE TRUE ${dateFilter}
      ), totals AS (
        SELECT variant_key, SUM(quantity)::integer AS quantity,
          SUM(line_subtotal) AS revenue, SUM(line_cogs_amount) AS cogs
        FROM matched_items GROUP BY variant_key
      ), snapshots AS (
        SELECT DISTINCT ON (variant_key) variant_key, product_name_snapshot,
          variant_name_snapshot, sku_snapshot
        FROM matched_items ORDER BY variant_key, completed_at DESC, id DESC
      )
      SELECT t.variant_key AS "productVariantId", s.product_name_snapshot AS "productName",
        s.variant_name_snapshot AS "variantName", s.sku_snapshot AS sku,
        t.quantity AS "quantitySold", t.revenue, t.cogs
      FROM totals t JOIN snapshots s USING (variant_key)
      ORDER BY ${sort}, t.variant_key LIMIT ${limit}
    `);
  }

  dailySales(range: SalesRange, filters: SalesQueryFilters = {}) {
    return this.prisma.$queryRaw<SalesBucketRow[]>(Prisma.sql`
      WITH ${salesEvents()}
      SELECT ((${EVENT_LOCAL_TIME})::date + time '00:00' - interval '8 hours') AS "completedAt",
        ${EVENT_SUMS}
      FROM sales_events e JOIN orders o ON o.id = e.order_id
      WHERE e.occurred_at >= ${range.from.toISOString()}::timestamp
        AND e.occurred_at <= ${range.to.toISOString()}::timestamp ${orderFilters(filters)}
      GROUP BY (${EVENT_LOCAL_TIME})::date ORDER BY "completedAt"
    `);
  }

  totals(range: SalesRange, filters: SalesQueryFilters = {}) {
    return this.prisma.$queryRaw<SalesBucketRow[]>(Prisma.sql`
      WITH ${salesEvents()}
      SELECT ${EVENT_SUMS}
      FROM sales_events e JOIN orders o ON o.id = e.order_id
      WHERE e.occurred_at >= ${range.from.toISOString()}::timestamp
        AND e.occurred_at <= ${range.to.toISOString()}::timestamp ${orderFilters(filters)}
      HAVING COUNT(*) > 0
    `);
  }

  staffSales(range: SalesRange) {
    return this.prisma.$queryRaw<
      Array<
        SalesBucketRow & {
          createdByUserId: string;
          email: string;
          firstName: string;
          lastName: string;
        }
      >
    >(Prisma.sql`
      WITH ${salesEvents()}
      SELECT e.created_by_user_id AS "createdByUserId", u.email, u.first_name AS "firstName", u.last_name AS "lastName", ${EVENT_SUMS}
      FROM sales_events e JOIN users u ON u.id = e.created_by_user_id
      WHERE e.occurred_at >= ${range.from.toISOString()}::timestamp
        AND e.occurred_at <= ${range.to.toISOString()}::timestamp
      GROUP BY e.created_by_user_id, u.email, u.first_name, u.last_name
    `);
  }

  productSales(range: SalesRange) {
    return this.prisma.$queryRaw<
      Array<{
        productId: string;
        productName: string;
        quantitySold: number;
        revenue: Prisma.Decimal;
        cogs: Prisma.Decimal;
        orderId: string;
      }>
    >(Prisma.sql`
      WITH ${itemEvents()}
      SELECT COALESCE(v.product_id, 'deleted:' || i.sku_snapshot) AS "productId", i.product_name_snapshot AS "productName", i.order_id AS "orderId",
        SUM(i.quantity_sold)::integer AS "quantitySold",
        SUM(i.revenue) AS revenue,
        SUM(i.cogs) AS cogs
      FROM item_events i
      LEFT JOIN product_variants v ON v.id = i.product_variant_id
      WHERE i.occurred_at >= ${range.from.toISOString()}::timestamp
        AND i.occurred_at <= ${range.to.toISOString()}::timestamp
      GROUP BY COALESCE(v.product_id, 'deleted:' || i.sku_snapshot), i.product_name_snapshot, i.order_id
    `);
  }

  variantTotals(filters: { from?: string; to?: string }) {
    const dates: Prisma.Sql[] = [];
    if (filters.from)
      dates.push(
        Prisma.sql`i.occurred_at >= ${new Date(filters.from).toISOString()}::timestamp`,
      );
    if (filters.to)
      dates.push(
        Prisma.sql`i.occurred_at <= ${new Date(filters.to).toISOString()}::timestamp`,
      );
    return this.prisma.$queryRaw<
      Array<{
        quantitySold: number;
        revenue: Prisma.Decimal;
        cogs: Prisma.Decimal;
      }>
    >(Prisma.sql`
      WITH ${itemEvents()}
      SELECT COALESCE(SUM(i.quantity_sold), 0)::integer AS "quantitySold",
        COALESCE(SUM(i.revenue), 0) AS revenue,
        COALESCE(SUM(i.cogs), 0) AS cogs
      FROM item_events i
      ${dates.length ? Prisma.sql`WHERE ${Prisma.join(dates, ' AND ')}` : Prisma.empty}
    `);
  }

  dailyRefunds(range: SalesRange, filters: SalesQueryFilters = {}) {
    return this.prisma.$queryRaw<
      Array<{ occurredAt: Date; amount: Prisma.Decimal }>
    >(Prisma.sql`
      SELECT ((r.occurred_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::date
          + time '00:00' - interval '8 hours') AS "occurredAt",
        SUM(r.amount) AS amount
      FROM order_reversals r JOIN orders o ON o.id = r.order_id
      WHERE r.type = 'REFUND'::"OrderReversalType"
        AND r.occurred_at >= ${range.from.toISOString()}::timestamp
        AND r.occurred_at <= ${range.to.toISOString()}::timestamp
        ${orderFilters(filters)}
      GROUP BY (r.occurred_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::date
      ORDER BY "occurredAt"
    `);
  }

  hourlySales(
    range: SalesRange,
    dayType: 'all' | 'weekday' | 'weekend' = 'all',
  ) {
    const dayFilter =
      dayType === 'all'
        ? Prisma.empty
        : dayType === 'weekend'
          ? Prisma.sql`AND EXTRACT(ISODOW FROM (${EVENT_LOCAL_TIME})) IN (6, 7)`
          : Prisma.sql`AND EXTRACT(ISODOW FROM (${EVENT_LOCAL_TIME})) BETWEEN 1 AND 5`;
    return this.prisma.$queryRaw<SalesHourRow[]>(Prisma.sql`
      WITH ${salesEvents()}
      SELECT EXTRACT(HOUR FROM (${EVENT_LOCAL_TIME}))::integer AS hour,
        SUM(e.gross) AS "grossSales", SUM(e.net) AS "netSales",
        SUM(e.transactions)::integer AS "transactionCount"
      FROM sales_events e
      WHERE e.occurred_at >= ${range.from.toISOString()}::timestamp
        AND e.occurred_at <= ${range.to.toISOString()}::timestamp ${dayFilter}
      GROUP BY hour ORDER BY hour
    `);
  }
}
