const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { unzipSync, strFromU8 } = require('fflate');
const { DOMParser } = require('linkedom');

const filename = path.resolve(__dirname, '../src/lib/report-excel.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(compiled, filename);
const { buildReportExcel, readReportSections } = loaded.exports;
const row = values => values.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(',');
const sample = [
  row(['Inventory Reports Export']), row(['From', '2026-10-01']), row(['To', '2026-10-08']), '',
  row(['Waste Summary']), row(['Metric', 'Value']), row(['Total Waste Cost', '629.20']), '',
  row(['Waste Insight Breakdown']), row(['Material', 'SKU', 'Reason', 'Events', 'Quantity', 'Cost']),
  row(['Rice, "Premium"\nBag', '00123', 'EXPIRED', 2, 11440, '629.20']), '',
  row(['Recent Sales-Linked Stock Movements']), row(['Order', 'Occurred At', 'Consumption Cost']),
  row(['00123', '2026-10-08T08:37:00Z', '113.78']), '',
  row(['Empty Report']), row(['Material', 'Quantity']), row(['No rows match the current report view.']), '',
  row(['Names and Notes']), row(['Material', 'Note']), row(['=1+1', 'A&B <test>']), '',
].join('\r\n');
const parsed = readReportSections(sample);
assert.equal(parsed.sections[1].rows[0][0], 'Rice, "Premium"\nBag');
assert.equal(parsed.sections[3].rows.length, 0);
const bytes = buildReportExcel(sample);
assert.equal(String.fromCharCode(bytes[0], bytes[1]), 'PK');
const files = unzipSync(bytes);
for (const [name, bytes] of Object.entries(files)) {
  if (!name.endsWith('.xml') && !name.endsWith('.rels')) continue;
  const doc = new DOMParser().parseFromString(strFromU8(bytes), 'text/xml');
  assert.ok(doc.documentElement, name);
  assert.equal(doc.querySelector('parsererror'), null, name);
}
assert.equal((strFromU8(files['xl/styles.xml']).match(/<name val="Century Gothic"\/>/g) || []).length, 3);
const workbook = strFromU8(files['xl/workbook.xml']);
assert.match(workbook, /name="Overview"/);
assert.match(workbook, /name="Waste Breakdown"/);
assert.match(workbook, /name="Sales Stock Movements"/);
const waste = strFromU8(files['xl/worksheets/sheet2.xml']);
assert.match(waste, /r="B6"[^>]*t="inlineStr"[^]*?00123/);
assert.match(waste, /r="E6" s="3"><v>11440<\/v>/);
assert.match(waste, /r="F6" s="4"><v>629.2<\/v>/);
assert.match(waste, /<f>SUM\(F6:F6\)<\/f>/);
assert.match(waste, /state="frozen"/);
assert.match(waste, /autoFilter ref="A5:F6"/);
assert.match(strFromU8(files['xl/worksheets/sheet3.xml']), /r="B6" s="6"><v>/);
const overview = strFromU8(files['xl/worksheets/sheet1.xml']);
assert.match(overview, /SUM\('Waste Breakdown'!F6:F6\)/);
const names = strFromU8(files['xl/worksheets/sheet5.xml']);
assert.match(names, /t="inlineStr"[^]*?=1\+1/);
assert.match(names, /A&amp;B &lt;test&gt;/);
assert.match(strFromU8(files['xl/worksheets/sheet4.xml']), /No records for the selected dates/);
const output = path.resolve(__dirname, '../../output/excel-export-check.xlsx');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, bytes);
console.log('Excel checks passed: genuine XLSX, section preservation, typed numbers, IDs, totals, filters, frozen headings, empty states, and safe text.');

// Exercise an actual report export, including its browser download and filename.
require.extensions['.ts'] = (loaded, filename) => loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
let downloadedName, downloadedBlob;
global.window = {};
global.document = {
  body: { appendChild() {} },
  createElement: () => ({ click() { downloadedName = this.download; }, remove() {} }),
};
const originalCreateUrl = URL.createObjectURL;
URL.createObjectURL = blob => { downloadedBlob = blob; return originalCreateUrl(blob); };
(async () => {
  const { exportPosPeakHoursExcel } = require('../src/lib/report-exports.ts');
  const filename = await exportPosPeakHoursExcel({
    filters: { from: '2026-10-01', to: '2026-10-08', dayType: 'all' },
    report: {
      summary: { totalTransactions: 7, totalNetSales: '500', busiestHour: { label: '4 PM' }, slowestHour: null },
      hourly: [{ label: '4 PM', transactionCount: 7, grossSales: '550', netSales: '500', averageTicketSize: '71.4286' }],
    },
  });
  assert.equal(filename, 'pos-peak-hours_2026-10-01_to_2026-10-08.xlsx');
  assert.equal(downloadedName, filename);
  assert.equal(downloadedBlob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const exported = unzipSync(new Uint8Array(await downloadedBlob.arrayBuffer()));
  assert.match(strFromU8(exported['xl/worksheets/sheet2.xml']), /r="D6" s="4"><v>500<\/v>/);
  console.log('Report export integration passed: selected dates, formatted data, Excel filename and download MIME type.');
})().catch(error => { console.error(error); process.exitCode = 1; });
