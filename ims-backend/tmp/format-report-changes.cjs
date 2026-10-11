const fs = require('node:fs');
const prettier = require('prettier');
(async () => {
 const file = 'src/reports/reports.service.ts';
 let source = fs.readFileSync(file, 'utf8');
 const names = new Set(['getSalesOverview','getVariantMargin','getWasteSummary','getInventoryKpiSummary','getInventoryAvailabilityRisk','getPosDashboard','getPosSalesAnalytics','getPosPaymentReports','getPosProductPerformance','getPosStaffPerformance','getPosInventoryLinked','aggregateOrderSummary','summarizeOrders','summarizeSalesAnalytics','groupSalesAnalytics']);
 const methods = [...source.matchAll(/\n  (?:async |private (?:async )?)(\w+)/g)];
 const config = await prettier.resolveConfig(file);
 for (let i = methods.length - 1; i >= 0; i--) {
  const method = methods[i];
  if (!names.has(method[1])) continue;
  const start = method.index;
  const end = methods[i + 1]?.index ?? source.lastIndexOf('\n}');
  const formatted = await prettier.format('class Report {\n' + source.slice(start + 1, end) + '\n}', { ...config, parser: 'typescript' });
  const inner = formatted.split('\n').slice(1, -2).join('\n');
  source = source.slice(0, start) + '\n' + inner + '\n' + source.slice(end);
 }
 fs.writeFileSync(file, source);
})();
