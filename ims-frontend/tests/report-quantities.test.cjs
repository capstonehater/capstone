/* eslint-disable @typescript-eslint/no-require-imports -- Test TS report helpers in Node. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (loaded, filename) => loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { formatReportQuantity, formatReportQuantities } = require('../src/lib/report-quantities.ts');

test('report quantities retain decimal usage instead of rounding stock up', () => {
  assert.equal(formatReportQuantity('112353.3'), '112,353.3');
  assert.equal(formatReportQuantity('-0.0125'), '-0.0125');
  assert.equal(formatReportQuantity('0'), '0');
});

test('piece quantities display whole numbers while weight and volume retain decimals', () => {
  for (const unit of ['pc', 'pcs', 'count']) {
    assert.equal(formatReportQuantity('116.9', unit), '117');
  }
  assert.equal(formatReportQuantity('61314.9', 'g'), '61,314.9');
  assert.equal(formatReportQuantity('50334.5', 'ml'), '50,334.5');
  assert.equal(formatReportQuantities([{ unit: 'pc', quantity: '116.9' }]), '117 pc');
});

test('quantities show their units independently, including stock returned by a reversal', () => {
  assert.equal(formatReportQuantities([
    { unit: 'g', quantity: '112353.3' }, { unit: 'ml', quantity: '250' }, { unit: 'pcs', quantity: '-3' },
  ]), '112,353.3 g · 250 ml · -3 pc');
  assert.equal(formatReportQuantities([]), 'No material usage');
});
