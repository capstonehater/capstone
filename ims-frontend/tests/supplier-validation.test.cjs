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
const { normalizeSupplierPhone, validateSupplierDetails } = require('../src/lib/supplier-validation.ts');
const valid = { name: 'Waltermart', contactType: 'phone', contactInfo: '09123456789', latitude: '14.299', longitude: '120.958' };
test('accepts phone formatting and complete email addresses', () => {
  for (const contactInfo of ['09123456789', '+63 (912) 345-6789']) {
    assert.deepEqual(validateSupplierDetails({ ...valid, contactInfo }), []);
  }
  assert.deepEqual(validateSupplierDetails({ ...valid, contactType: 'email', contactInfo: 'supplier@example.com' }), []);
});
test('requires supplier name, contact information, and selected location', () => {
  assert.equal(validateSupplierDetails({ ...valid, name: ' ', contactInfo: '', latitude: '', longitude: '' }).length, 3);
});
test('normalizes eleven-digit local numbers and enforces Philippine mobile length', () => {
  assert.equal(normalizeSupplierPhone('09123456789'), '+639123456789');
  assert.equal(normalizeSupplierPhone('+639123456789'), '+639123456789');
  for (const contactInfo of ['+63912345678', '+6391234567890', '+638123456789']) {
    assert.equal(validateSupplierDetails({ ...valid, contactInfo }).length, 1);
  }
});
test('rejects malformed emails and invalid phone numbers', () => {
  for (const contactInfo of ['supplier', 'supplier@', 'supplier@example', 'a@@example.com', 'a b@example.com']) {
    assert.equal(validateSupplierDetails({ ...valid, contactType: 'email', contactInfo }).length, 1);
  }
  for (const contactInfo of ['abc09123456789', '123', '1234567890123456', '09+123456789']) {
    assert.equal(validateSupplierDetails({ ...valid, contactInfo }).length, 1);
  }
});
test('rejects incomplete, nonnumeric, and out-of-range map coordinates', () => {
  for (const location of [{ latitude: '' }, { longitude: 'bad' }, { latitude: '91' }, { longitude: '181' }]) {
    assert.equal(validateSupplierDetails({ ...valid, ...location }).length, 1);
  }
  assert.deepEqual(validateSupplierDetails({ ...valid, latitude: '0', longitude: '0' }), []);
});
