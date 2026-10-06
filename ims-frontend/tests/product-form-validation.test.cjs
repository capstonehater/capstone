/* eslint-disable @typescript-eslint/no-require-imports -- Load TypeScript for Node tests. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};
const { productFormErrors } = require('../src/lib/products/form-validation.ts');
const variant = { name: 'Solo', sku: 'SL-SOLO', price: '120', isEnabled: true };
const validate = (variants) => productFormErrors('Spanish Latte', 'drinks', ['drinks'], variants, true);
test('accepts complete products including zero-priced variants', () => {
  assert.deepEqual(validate([variant]), {});
  assert.deepEqual(validate([{ ...variant, price: '0' }]), {});
});
test('identifies missing product fields and initial variants', () => {
  assert.deepEqual(Object.keys(productFormErrors(' ', '', ['drinks'], [], true)), ['name', 'categoryId', 'initialVariants']);
  const errors = validate([{ name: '', sku: '', price: '', isEnabled: true }]);
  assert.ok(errors['initialVariants.0.name']);
  assert.equal(errors['initialVariants.0.sku'], undefined);
  assert.ok(errors['initialVariants.0.price']);
});
test('rejects duplicate names and generated SKUs', () => {
  const errors = validate([variant, { ...variant, name: ' solo ' }]);
  assert.ok(errors['initialVariants.1.name']);
  assert.equal(errors['initialVariants.1.sku'], undefined);
});
test('rejects invalid prices and unavailable categories', () => {
  for (const price of ['-1', '1.5', 'abc', ' ', '9007199254740992']) {
    assert.ok(validate([{ ...variant, price }])['initialVariants.0.price']);
  }
  assert.ok(productFormErrors('Latte', 'missing', ['drinks'], [variant], true).categoryId);
});
test('editing metadata does not require new variants', () => {
  assert.deepEqual(productFormErrors('Latte', 'drinks', ['drinks'], [], false), {});
});
