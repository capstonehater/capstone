/* eslint-disable @typescript-eslint/no-require-imports -- Test the shared alert display rules. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/alert-presentation.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const { alertColor, alertTitle, formatAlertMessage, formatAlertQuantity } = context.exports;
const base = { type: 'LOW_STOCK', severity: 'WARNING', title: 'Fresh Pizza Dough 250g is running low', remainingQuantity: '1' };

test('colors distinguish low stock, depletion, near expiry and expiry', () => {
  assert.equal(alertColor(base), 'lowStock');
  assert.equal(alertColor({ ...base, remainingQuantity: '0', severity: 'CRITICAL' }), 'depleted');
  assert.equal(alertColor({ ...base, type: 'NEAR_EXPIRY' }), 'nearExpiry');
  assert.equal(alertColor({ ...base, type: 'EXPIRED', severity: 'CRITICAL' }), 'expired');
});

test('zero usable quantity displays depleted immediately, including existing stored titles', () => {
  for (const remainingQuantity of ['0', '0.000', '-1']) {
    assert.equal(alertTitle({ ...base, remainingQuantity }), 'Fresh Pizza Dough 250g is depleted');
  }
  assert.equal(alertTitle(base), 'Fresh Pizza Dough 250g is running low');
  assert.equal(alertTitle({ ...base, title: 'Fresh Pizza Dough 250g is depleted' }), base.title);
  assert.equal(alertColor({ ...base, severity: 'CRITICAL' }), 'lowStock');
});

test('expiry titles are unaffected by low stock formatting', () => {
  const expired = { ...base, type: 'EXPIRED', title: 'Fresh Pizza Dough 250g batch has expired', remainingQuantity: '0' };
  assert.equal(alertTitle(expired), expired.title);
  assert.equal(alertColor(expired), 'expired');
});

test('all displayed quantities are rounded to whole numbers while dates and batch references remain intact', () => {
  assert.equal(formatAlertQuantity('751.7832'), '752');
  assert.equal(formatAlertQuantity('184.835'), '185');
  assert.equal(formatAlertQuantity(null), 'N/A');
  assert.equal(formatAlertMessage('Usable quantity is 751.7832 with a reorder point of 900.5000.'), 'Usable quantity is 752 with a reorder point of 901.');
  assert.equal(formatAlertMessage('Batch ST-12.50 expired on 2026-10-26 with 184.835 remaining.'), 'Batch ST-12.50 expired on 2026-10-26 with 185 remaining.');
});
