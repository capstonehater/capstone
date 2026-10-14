/* eslint-disable @typescript-eslint/no-require-imports -- Exercise TS export helpers in Node. */
require('./helpers/register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
let spreadsheet;
function load(file) {
  const filename = require.resolve(file);
  const compiled = new Module(filename, module); compiled.filename = filename; compiled.paths = module.paths;
  const originalRequire = compiled.require.bind(compiled);
  compiled.require = name => {
    if (name === './pos-utils') return { formatOrderReference: value => value.id, formatSplitPaymentOrderReference: value => value.id, formatPeso: value => 'PHP ' + value, formatDateTime: value => value, formatName: value => value.firstName + ' ' + value.lastName };
    if (name === './report-export-access') return { authorizeReportExport: async () => {} };
    if (name === './report-excel') return { downloadReportExcel: async (filename, content) => { spreadsheet = { filename, content }; } };
    if (name === './units') return { formatUnit: value => value };
    return originalRequire(name);
  };
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return compiled.exports;
}
const exportsApi = load('../src/lib/report-exports.ts');
const receipt = load('../src/lib/receipt.ts');
const row = {
  occurredAt: '2026-10-07T04:00:00Z', kind: 'DISCOUNT', orderId: 'order-1', orderStatus: 'COMPLETED',
  amount: '20', responsibleUser: { firstName: 'Cash', lastName: 'Ier' }, approvalContext: {},
  discountDetails: { discountCode: 'Senior Citizen (20%)', discountCustomerName: 'Maria <Santos>', discountIdNumber: 'SC-123', discountRate: '0.2', discountAmount: '20' },
};
const snapshot = { filters: { from: '2026-10-07', to: '2026-10-07', page: 1, pageSize: 10 }, report: { summary: { totalExceptions: 1, refundCount: 0, refundedAmount: '0', voidCount: 0, voidedAmount: '0', discountCount: 1, discountedAmount: '20' }, pagination: { totalPages: 1 }, rows: [row] } };

test('discount audit Excel includes separate customer and ID columns', async () => {
  const filename = await exportsApi.exportPosAuditExceptionsExcel(snapshot);
  assert.ok(filename.endsWith('.xlsx'));
  assert.equal(spreadsheet.filename, filename);
  assert.ok(spreadsheet.content.includes('"Discount Customer","Discount ID No."'));
  assert.ok(spreadsheet.content.includes('"Maria <Santos>","SC-123"'));
});
test('downloaded audit PDF retains customer identity and displayed-page scope', async () => {
  global.DOMParser = require('linkedom').DOMParser;
  const pdfModule = require('../src/lib/report-pdf.ts');
  const originalBuilder = pdfModule.buildReportPdfDocument;
  const originalWindow = global.window;
  let output;
  let saved;
  let reportContent;
  global.window = {};
  pdfModule.buildReportPdfDocument = content => {
    reportContent = content;
    const pdf = originalBuilder(content);
    output = pdf.output();
    pdf.save = async filename => { saved = filename; };
    return pdf;
  };
  try {
    await exportsApi.exportPosAuditExceptionsPdf(snapshot);
    assert.ok(reportContent.sections.some(section => section.headers.includes('Discount Customer')));
    assert.ok(output.includes('Maria <Santos>'));
    assert.ok(output.includes('SC-123'));
    assert.ok(output.includes('displayed page of results'));
    assert.equal(saved, 'pos-audit-exceptions_2026-10-07_to_2026-10-07.pdf');
  } finally {
    pdfModule.buildReportPdfDocument = originalBuilder;
    global.window = originalWindow;
  }
});
test('printed receipt includes discount ID details safely', () => {
  const order = { id: 'order-1', displayOrderNumber: 'POS-1', status: 'COMPLETED', completedAt: row.occurredAt, createdBy: row.responsibleUser, items: [], payments: [], subtotalAmount: '100', totalAmount: '80', taxAmount: '0', ...row.discountDetails };
  const html = receipt.buildReceiptHtml(order);
  assert.ok(html.includes('Senior Citizen ID No.: SC-123'));
  assert.ok(html.includes('Name: Maria &lt;Santos&gt;'));
});

test('complete-range exports retain the last transaction and exception with full-scope metadata', async () => {
  global.DOMParser = require('linkedom').DOMParser;
  const pdfModule = require('../src/lib/report-pdf.ts');
  const originalBuilder = pdfModule.buildReportPdfDocument;
  const originalWindow = global.window;
  const documents = [];
  global.window = {};
  pdfModule.buildReportPdfDocument = content => {
    const pdf = originalBuilder(content);
    documents.push({ content, output: pdf.output() });
    pdf.save = async () => {};
    return pdf;
  };
  try {
    const fullAudit = { ...snapshot, scope: 'all', report: {
      ...snapshot.report,
      pagination: { page: 1, pageSize: 100, total: 205, totalPages: 3 },
      rows: Array.from({ length: 205 }, (_, i) => ({ ...row, orderId: `order-${i}`, discountDetails: { ...row.discountDetails, discountIdNumber: `SC-${i}` } })),
    } };
    await exportsApi.exportPosAuditExceptionsExcel(fullAudit);
    assert.ok(spreadsheet.content.includes('SC-204'));
    assert.ok(spreadsheet.content.includes('All matching records in the selected date range'));
    assert.ok(!spreadsheet.content.includes('"Page Size"'));
    await exportsApi.exportPosAuditExceptionsPdf(fullAudit);
    const history = { scope: 'all', filters: snapshot.filters, report: {
      pagination: fullAudit.report.pagination,
      orders: Array.from({ length: 205 }, (_, i) => ({
        id: `order-${i}`, displayOrderNumber: `ORD-${i}`, completedAt: row.occurredAt, createdBy: row.responsibleUser,
        items: [], payments: [], subtotalAmount: '100', discountAmount: '20', taxAmount: '0', totalAmount: '80', status: 'COMPLETED',
      })),
    } };
    await exportsApi.exportPosTransactionHistoryExcel(history);
    assert.ok(spreadsheet.content.includes('ORD-204'));
    assert.ok(!spreadsheet.content.includes('Current filtered page'));
    assert.ok(spreadsheet.content.indexOf('KPI Summary') < spreadsheet.content.indexOf('"Transactions"'));
    assert.ok(spreadsheet.content.includes('"Most Completed Transactions","205"'));
    await exportsApi.exportPosTransactionHistoryPdf(history);
    assert.ok(documents[0].output.includes('SC-204'));
    assert.ok(documents[1].output.includes('ORD-204'));
    assert.equal(documents[1].content.sections[0].title, 'KPI Summary');
    assert.ok(documents[1].content.sections[0].rows.some(([label, value]) => label === 'Most Completed Transactions' && value === '205'));
    assert.equal(documents[1].content.sections.find(section => section.title === 'Staff Sales Ranking').rows[0][0], '1');
    for (const document of documents) {
      assert.ok(document.content.metadata.includes('Exported Records: 205'));
      assert.ok(document.output.includes('All matching records in the selected date range'));
      assert.ok(!document.output.includes('displayed page of results'));
    }
  } finally {
    pdfModule.buildReportPdfDocument = originalBuilder;
    global.window = originalWindow;
  }
});
