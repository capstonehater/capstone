// Exercises production SQL against in-memory PostgreSQL CTE fixtures. No writes.
require('dotenv').config({ quiet: true });
require('ts-node/register/transpile-only');
const assert = require('node:assert/strict');
const { PrismaClient, Prisma } = require('@prisma/client');
const { SalesReportQueries } = require('../src/reports/sales-report.queries');
const { summarizeSales } = require('../src/reports/report-accounting');
const prisma = new PrismaClient();
const fixture = `orders(id, created_by_user_id, completed_at, subtotal_amount, total_amount, tax_amount, total_cogs_amount) AS (
  VALUES ('refunded','seller',timestamp '2026-10-01 05:00',1120::numeric,1008::numeric,108::numeric,300::numeric),
    ('paid','seller',timestamp '2026-10-01 05:00',112,112,12,40),
    ('voided','seller',timestamp '2026-10-01 05:00',224,224,24,80),
    ('free','seller',timestamp '2026-10-01 05:00',100,0,0,10),
    ('pennies','seller',timestamp '2026-10-01 05:00',0.05,0.04,0,0),
    ('exempt','seller',timestamp '2026-10-01 05:00',100,90,0,20)
), order_reversals(order_id, occurred_at, type, amount) AS (
  VALUES ('refunded',timestamp '2026-10-02 06:00','REFUND',1008::numeric),
    ('voided',timestamp '2026-10-03 07:00','VOID',224::numeric)
), order_items(id, order_id, product_variant_id, product_name_snapshot, variant_name_snapshot, sku_snapshot, quantity, line_subtotal, line_cogs_amount) AS (
  VALUES ('a','refunded','variant','Product','Regular','SKU',1,373.33::numeric,100::numeric),
    ('b','refunded','variant','Product','Regular','SKU',1,373.33,100),
    ('c','refunded','variant','Product','Regular','SKU',1,373.34,100),
    ('d','paid','variant','Product','Regular','SKU',1,112,40),
    ('e','voided','variant','Product','Regular','SKU',1,224,80),
    ('f','free','variant','Product','Regular','SKU',1,100,10),
    ('g','pennies','variant','Product','Regular','SKU',1,0.02,0),
    ('h','pennies','variant','Product','Regular','SKU',1,0.02,0),
    ('i','pennies','variant','Product','Regular','SKU',1,0.01,0),
    ('j','exempt','variant','Product','Regular','SKU',1,100,20)
), inventory_transactions(id, source_id, type, source_type) AS (
  VALUES ('checkout-refunded','refunded','CHECKOUT','ORDER'), ('checkout-paid','paid','CHECKOUT','ORDER')
), inventory_transaction_lines(inventory_transaction_id, order_item_id, total_cost_delta) AS (
  VALUES ('checkout-refunded','a',-60::numeric), ('checkout-refunded','b',-50::numeric),
    ('checkout-refunded','c',-40::numeric), ('checkout-paid','d',-55::numeric)
), product_variants(id, product_id) AS (VALUES ('variant','product')), `;
const queries = new SalesReportQueries({ $queryRaw: sql =>
  prisma.$queryRawUnsafe(sql.text.replace(/WITH\s+checkout_costs/, `WITH ${fixture}checkout_costs`), ...sql.values)
});
const money = (actual, expected, label) => assert.ok(actual.equals(new Prisma.Decimal(expected)), label);
const sum = rows => rows.reduce((total, row) => total.plus(row), new Prisma.Decimal(0));
(async () => {
  const range = { from: new Date('2026-10-01T00:00:00+08:00'), to: new Date('2026-10-03T23:59:59.999+08:00') };
  const [daily, totals, hours, products, variants] = await Promise.all([
    queries.dailySales(range), queries.totals(range), queries.hourlySales(range),
    queries.productSales(range), queries.variantTotals({ from: range.from.toISOString(), to: range.to.toISOString() }),
  ]);
  assert.equal(daily.length, 3);
  money(daily[0].totalAmount, '1290.04', 'Sale-day revenue excludes stored VAT and discounts');
  money(daily[1].totalAmount, '-900', 'Later refund reverses the sale once');
  money(daily[2].totalAmount, '-200', 'Later void reverses the sale');
  const summary = summarizeSales(totals);
  money(summary.netSales, '190.04', 'Range net revenue');
  money(summary.taxes, '12', 'VAT is reversed on refund and void');
  money(summary.cogs, '85', 'COGS includes free products and reverses returned stock');
  money(summary.grossMargin, '105.04', 'Gross profit');
  money(summary.grossSales.minus(summary.discounts).minus(summary.refunds), '190.04', 'Gross - discounts - refunds = net');
  money(sum(hours.map(row => row.netSales)), '190.04', 'Hourly sums equal summary');
  money(sum(products.map(row => row.revenue)), '190.04', 'Item allocations preserve every cent');
  money(variants[0].revenue, '190.04', 'Variant sums match');
  money(variants[0].cogs, '85', 'Variant COGS matches');
  const empty = await queries.totals({ from: new Date('2027-01-01'), to: new Date('2027-01-02') });
  assert.deepEqual(empty, []);
  console.log('SQL fixtures passed: discounts, stored VAT, VAT-exempt sales, free items, rounding cents, cross-period refunds/voids, ledger COGS overriding stale snapshots, products, variants, hourly buckets and empty periods.');
})().catch(error => {
  console.error(error instanceof assert.AssertionError ? error.message : `Fixture verification failed (${error.code ?? error.name}).`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
