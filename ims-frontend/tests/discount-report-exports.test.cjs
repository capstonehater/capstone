/* eslint-disable @typescript-eslint/no-require-imports -- Exercise TS export helpers in Node. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
function load(file) {
  const filename = require.resolve(file);
  const compiled = new Module(filename, module); compiled.paths = module.paths;
  const originalRequire = compiled.require.bind(compiled);
  compiled.require = name => {
    if (name === './pos-utils') return { formatPeso: value => 'PHP ' + value, formatDateTime: value => value, formatName: value => value.firstName + ' ' + value.lastName };
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

test('discount audit CSV includes separate customer and ID columns', async () => {
  let blob;
  global.window = { URL: { createObjectURL(value) { blob = value; return 'blob:test'; }, revokeObjectURL() {} } };
  global.document = { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } };
  exportsApi.exportPosAuditExceptionsCsv(snapshot);
  const csv = await blob.text();
  assert.ok(csv.includes('"Discount Customer","Discount ID No."'));
  assert.ok(csv.includes('"Maria <Santos>","SC-123"'));
  delete global.window; delete global.document;
});
test('printable audit report includes escaped customer identity', () => {
  let html;
  global.window = { open: () => ({ document: { open() {}, write(value) { html = value; }, close() {} }, focus() {} }), setTimeout() {} };
  exportsApi.exportPosAuditExceptionsPdf(snapshot);
  assert.ok(html.includes('Discount Customer'));
  assert.ok(html.includes('Maria &lt;Santos&gt;'));
  assert.ok(html.includes('SC-123'));
  assert.ok(html.includes('A4 landscape'));
  delete global.window;
});
test('printed receipt includes discount ID details safely', () => {
  const order = { id: 'order-1', displayOrderNumber: 'POS-1', status: 'COMPLETED', completedAt: row.occurredAt, createdBy: row.responsibleUser, items: [], payments: [], subtotalAmount: '100', totalAmount: '80', taxAmount: '0', ...row.discountDetails };
  const html = receipt.buildReceiptHtml(order);
  assert.ok(html.includes('Senior Citizen ID No.: SC-123'));
  assert.ok(html.includes('Name: Maria &lt;Santos&gt;'));
});
