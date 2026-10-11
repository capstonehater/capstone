// Read-only reconciliation of the same date range across report endpoints.
require('dotenv').config({ quiet: true });
require('ts-node/register/transpile-only');
const assert = require('node:assert/strict');
const { PrismaClient, Prisma } = require('@prisma/client');
const { SalesReportQueries } = require('../src/reports/sales-report.queries');
const { ReportsService } = require('../src/reports/reports.service');
const { summarizeSales } = require('../src/reports/report-accounting');
const prisma = new PrismaClient();
const sum = values => values.reduce((a, b) => a.plus(b), new Prisma.Decimal(0));
const equalMoney = (a, b, label) => assert.ok(a.minus(b).abs().lessThan('0.005'), label);

(async () => {
  const from = process.argv[2] ?? '2026-10-01T00:00:00+08:00';
  const to = process.argv[3] ?? '2026-10-11T23:59:59.999+08:00';
  const range = { from: new Date(from), to: new Date(to) };
  const queries = new SalesReportQueries(prisma);
  const service = new ReportsService(prisma, {}, { getDisplayOrderNumber: id => id });
  const [daily, hours, totalRows, products, variants, analytics, kpi, linked, staff, payments, marginRows, overview, availability] = await Promise.all([
    queries.dailySales(range), queries.hourlySales(range), queries.totals(range),
    service.getPosProductPerformance({ from, to }), queries.variantTotals({ from, to }),
    service.getPosSalesAnalytics({ from, to }), service.getInventoryKpiSummary({ from, to }),
    service.getPosInventoryLinked({ from, to }), service.getPosStaffPerformance({ from, to }),
    service.getPosPaymentReports({ from, to }),
    queries.variantMargins({ from, to }, 50, 'margin'),
    service.getSalesOverview({ from, to }),
    service.getInventoryAvailabilityRisk({ from, to }),
  ]);
  const totals = summarizeSales(totalRows);
  equalMoney(totals.grossSales.minus(totals.discounts).minus(totals.refunds), totals.netSales, 'Gross - discounts - refunds = net');
  equalMoney(totals.collectedAmount.minus(totals.taxes), totals.netSales, 'Collected - VAT = net');
  equalMoney(totals.netSales.minus(totals.cogs), totals.grossMargin, 'Net - COGS = gross profit');
  equalMoney(sum(daily.map(row => row.totalAmount)), totals.netSales, 'Daily = summary');
  equalMoney(sum(hours.map(row => row.netSales)), totals.netSales, 'Hourly = summary');
  equalMoney(products.summary.totalRevenue, totals.netSales, 'Products = summary');
  equalMoney(variants[0].revenue, totals.netSales, 'Variants = summary');
  equalMoney(products.summary.totalGrossMargin, totals.grossMargin, 'Product profit = summary profit');
  equalMoney(sum(analytics.groups.map(row => row.netSales)), totals.netSales, 'Analytics buckets = summary');
  equalMoney(kpi.totals.revenue, totals.netSales, 'Inventory KPI revenue = sales');
  equalMoney(kpi.totals.cogs, totals.cogs, 'Inventory COGS = sales COGS');
  equalMoney(linked.summary.totalConsumptionCost, totals.cogs, 'Inventory ledger usage = COGS');
  assert.ok(marginRows.every(row => row.revenue.isFinite() && row.cogs.isFinite()), 'Variant margin rows are valid');
  equalMoney(staff.summary.totalNetSales, totals.netSales, 'Staff = sales');
  equalMoney(payments.summary.totalCollected, totals.collectedAmount, 'Payment collections = sales collections');
  equalMoney(overview.summary.totalSales, totals.netSales, 'Sales overview = net sales');
  equalMoney(overview.summary.totalCogs, totals.cogs, 'Sales overview = COGS');
  equalMoney(sum(overview.paymentBreakdown.map(row => row.amount)), totals.collectedAmount, 'Overview payment methods = collected');
  assert.ok(availability.topSellingVariants.every(row => row.revenue.isFinite()), 'Availability revenue is valid');
  equalMoney(sum(payments.breakdown.map(row => row.amount)), payments.summary.totalCollected, 'Payment methods = collected');
  for (const group of linked.summary.materialQuantitiesByUnit) {
    const materialTotal = sum(linked.materials.filter(row => row.rawMaterial.unit.code === group.unit).map(row => row.consumedQuantity));
    equalMoney(group.quantity, materialTotal, 'Unit group = corresponding materials');
  }
  console.log('Reconciliation passed: sales, VAT, refunds, profit, daily/hourly groups, products, variants, staff, payments, inventory KPIs and material units.');
})().catch(error => {
  // Do not echo connection strings or record details on a database error.
  console.error(error instanceof assert.AssertionError ? error.message : `Verification failed (${error.code ?? error.name}).`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
