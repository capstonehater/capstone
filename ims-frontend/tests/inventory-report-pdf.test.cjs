/* eslint-disable @typescript-eslint/no-require-imports -- Exercise TypeScript exports in Node. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { DOMParser } = require('linkedom');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};
global.DOMParser = DOMParser;
const { buildInventoryReportsPdfHtml, exportInventoryReportsPdf } = require('../src/lib/report-exports.ts');
const { readReportPdfContent, buildReportPdfDocument } = require('../src/lib/report-pdf.ts');

function fixture(count = 1) {
  const material = {
    rawMaterial: { name: 'Rice <premium> & grain', sku: 'RICE-01', unit: { code: 'kg' }, reorderPoint: '10' },
    consumedQuantity: '12', consumptionCost: '360', orderCount: 4, variantCount: 2,
    currentOnHandQuantity: '9', currentUsableQuantity: '8', isLowStock: true,
    activeLowStockAlert: { severity: 'HIGH', title: 'Reorder rice', message: 'Stock is below reorder point' },
  };
  const productVariant = { name: 'Regular', product: { name: 'Rice Bowl', category: { name: 'Meals' } } };
  const summary = { quantitySold: 6, revenue: '900', cogs: '360', grossMargin: '540', materialConsumptionQuantity: '12', materialConsumptionCost: '360' };
  return {
    filters: { from: '2026-10-01', to: '2026-10-06' },
    kpiSummary: {
      summary: { foodCostPercentage: '40', wastePercentage: '0', inventoryTurnoverRate: null },
      totals: { revenue: '900', cogs: '360', checkoutCost: '360', wasteCost: '0', totalInventoryUsedCost: '360', averageInventory: null, snapshotDayCount: 0, expectedSnapshotDayCount: 6 },
    },
    availabilityRisk: {
      summary: { stockoutRatePercentage: '5', materialsWithStockoutCount: 1, trackedMaterialCount: 2, overlappingStockoutEventCount: 3, menuItemAvailabilityRate: '95', trackedVariantCount: 1, untrackedVariantCount: 1, topSellingItemAvailabilityPercentage: null, trackedTopSellingVariantCount: 0, totalTopSellingVariantCount: 1 },
      definitions: { stockoutRate: 'Recorded material downtime', menuItemAvailabilityRate: 'Tracked sellable time', topSellingItemAvailability: 'Availability of top sellers' },
      stockoutMaterials: [{ rawMaterial: material.rawMaterial, stockoutDurationHours: '2', stockoutRatePercentage: '5', overlappingStockoutEventCount: 3, currentlyOutOfStock: false, blockingContexts: ['Insufficient stock'] }],
      topSellingVariants: [{ productVariant, quantitySold: 6, revenue: '900', availabilityPercentage: null, sellableDurationHours: null, downtimeDurationHours: null, eventCount: 0, trackedFromRangeStart: false }],
    },
    inventoryLinked: {
      filters: { from: '2026-10-01', to: '2026-10-06', materialSearch: 'Rice', drilldownVariantName: 'Rice Bowl - Regular' },
      report: {
        summary: { salesLinkedTransactionCount: 4, totalMaterialConsumptionQuantity: '12', totalConsumptionCost: '360', distinctMaterialsConsumed: 1, distinctVariantsSold: 1, lowStockConsumedMaterialCount: 1 },
        materials: Array.from({ length: count }, (_, i) => ({ ...material, rawMaterial: { ...material.rawMaterial, sku: `RICE-${i}` } })),
        lowStockMaterials: Array.from({ length: 12 }, () => material),
        variants: [{ productVariant, ...summary, orderCount: 4 }],
        recentSalesLinkedMovements: [{ transactionId: 'TX-1', orderId: 'ORDER-1', occurredAt: '2026-10-06T02:00:00Z', movementLineCount: 1, rawMaterialCount: 1, variantCount: 1, consumedQuantity: '12', consumptionCost: '360' }],
        selectedVariantBreakdown: { productVariant, summary, materials: [material] },
      },
    },
  };
}

test('PDF content includes every report section, filters, totals, alerts and all low-stock rows', () => {
  const html = buildInventoryReportsPdfHtml(fixture(), 'inventory.pdf');
  assert.ok(html.includes('Rice &lt;premium&gt; &amp; grain'));
  const content = readReportPdfContent(html);
  assert.equal(content.title, 'Inventory Reports');
  assert.ok(content.metadata.includes('Material Search: Rice'));
  assert.ok(content.metadata.includes('From: 2026-10-01'));
  assert.equal(content.sections.length, 12);
  const section = title => content.sections.find(row => row.title === title);
  assert.ok(section('KPI Summary').rows.some(row => row[0] === 'Total Inventory Used Cost'));
  assert.ok(section('Availability & Stock Risk Summary').rows.some(row => row[0] === 'Overlapping Stockout Events' && row[1] === '3'));
  assert.ok(section('KPI Summary').rows.some(row => row[0] === 'Waste %' && row[1] === '0.00%'));
  assert.ok(section('KPI Summary').rows.some(row => row[0] === 'Inventory Turnover' && row[1] === 'N/A'));
  const usage = section('High-Usage Ingredients');
  assert.equal(usage.rows[0][0], 'Rice <premium> & grain');
  assert.equal(usage.headers.length, usage.rows[0].length);
  assert.ok(usage.rows[0].at(-1).includes('HIGH: Reorder rice'));
  assert.equal(section('Low-Stock or Reorder-Oriented Materials').rows.length, 12);
  assert.equal(section('Recent Sales-Linked Stock Movements').rows[0][0], 'TX-1');
  assert.ok(section('Selected Variant Summary').rows.some(row => row[1] === 'Rice Bowl - Regular'));
  assert.equal(section('Selected Variant Material Breakdown').rows.length, 1);
});

test('actual PDF paginates a large report, repeats headings, retains the final row and labels PHP', () => {
  const content = readReportPdfContent(buildInventoryReportsPdfHtml(fixture(160), 'large.pdf'));
  const pdf = buildReportPdfDocument(content);
  const output = pdf.output();
  assert.ok(output.startsWith('%PDF-'));
  assert.ok(pdf.getNumberOfPages() > 3);
  assert.ok(output.includes('RICE-159'));
  assert.ok(output.includes('PHP 360.00'));
  assert.ok(output.includes(`Page ${pdf.getNumberOfPages()} of ${pdf.getNumberOfPages()}`));
  assert.ok(output.split('(Consumed Qty)').length > 3);
});

test('empty data and absent drilldown produce a valid PDF with explicit empty states', () => {
  const snapshot = fixture(0);
  snapshot.availabilityRisk.stockoutMaterials = [];
  snapshot.availabilityRisk.topSellingVariants = [];
  snapshot.inventoryLinked.report.lowStockMaterials = [];
  snapshot.inventoryLinked.report.variants = [];
  snapshot.inventoryLinked.report.recentSalesLinkedMovements = [];
  snapshot.inventoryLinked.report.selectedVariantBreakdown = null;
  const content = readReportPdfContent(buildInventoryReportsPdfHtml(snapshot, 'empty.pdf'));
  assert.equal(content.sections.length, 10);
  assert.ok(!content.sections.some(section => section.title === 'Selected Variant Summary'));
  assert.ok(buildReportPdfDocument(content).output().includes('No rows match the current report view.'));
});

test('PDF export rejects server-side use clearly', async () => {
  await assert.rejects(exportInventoryReportsPdf(fixture()), /only available in the browser/);
});

test('browser export saves a PDF directly and propagates download failures', async () => {
  const { jsPDF } = require('jspdf');
  // jsPDF exposes save on each constructed document, so intercept the builder.
  const pdfModule = require('../src/lib/report-pdf.ts');
  const originalBuilder = pdfModule.buildReportPdfDocument;
  const originalWindow = global.window;
  const downloads = [];
  global.window = {};
  pdfModule.buildReportPdfDocument = content => {
    const pdf = originalBuilder(content);
    assert.ok(pdf instanceof jsPDF || pdf.output().startsWith('%PDF-'));
    pdf.save = async (filename, options) => downloads.push({ filename, options });
    return pdf;
  };
  try {
    const filename = await exportInventoryReportsPdf(fixture());
    assert.equal(filename, 'inventory-reports_2026-10-01_to_2026-10-06.pdf');
    assert.deepEqual(downloads, [{ filename, options: { returnPromise: true } }]);
    pdfModule.buildReportPdfDocument = () => ({ save: async () => { throw new Error('Download failed'); } });
    await assert.rejects(exportInventoryReportsPdf(fixture()), /Download failed/);
  } finally {
    pdfModule.buildReportPdfDocument = originalBuilder;
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
  }
});
