/* eslint-disable @typescript-eslint/no-require-imports -- Run isolated TypeScript availability logic with Node. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const filename = require.resolve('../src/lib/pos-cart-availability.ts');
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { remainingVariantQuantity } = compiled.exports;
const variant = (count, id = 'solo') => ({ id, isEnabled: true, availability: { isSellable: true, availableBaseQty: count } });
const line = (id, qty, variantId = 'solo') => ({ cartId: id, productVariantId: variantId, quantity: qty });

test('one available order permits one addition and then disables increases', () => {
  assert.equal(remainingVariantQuantity(variant(1), []), 1);
  assert.equal(remainingVariantQuantity(variant(1), [line('first', 1)]), 0);
});
test('separate configured lines reserve the same variant together', () => {
  assert.equal(remainingVariantQuantity(variant(22), [line('hot-a', 12), line('hot-b', 10)]), 0);
  assert.equal(remainingVariantQuantity(variant(22), [line('hot-a', 12), line('hot-b', 9)]), 1);
});
test('reducing or removing a cart item releases its reserved quantity', () => {
  assert.equal(remainingVariantQuantity(variant(3), [line('a', 2)]), 1);
  assert.equal(remainingVariantQuantity(variant(3), [line('a', 1)]), 2);
  assert.equal(remainingVariantQuantity(variant(3), []), 3);
});
test('editing excludes only the edited line and still reserves other matching lines', () => {
  const cart = [line('a', 2), line('b', 1), line('iced', 5, 'iced')];
  assert.equal(remainingVariantQuantity(variant(3), cart, 'a'), 2);
  assert.equal(remainingVariantQuantity(variant(5, 'iced'), cart, 'a'), 0);
});
test('unknown, disabled, unsellable, and invalid stock cannot be added', () => {
  assert.equal(remainingVariantQuantity(undefined, []), 0);
  assert.equal(remainingVariantQuantity({ ...variant(2), isEnabled: false }, []), 0);
  assert.equal(remainingVariantQuantity({ ...variant(2), availability: null }, []), 0);
  assert.equal(remainingVariantQuantity({ ...variant(2), availability: { isSellable: false, availableBaseQty: 2 } }, []), 0);
  for (const qty of [NaN, Infinity, -1, 0]) assert.equal(remainingVariantQuantity(variant(qty), []), 0);
});
test('fractional availability permits whole orders only and stale stock cannot go negative', () => {
  assert.equal(remainingVariantQuantity(variant(1.9), []), 1);
  assert.equal(remainingVariantQuantity(variant(1), [line('a', 3)]), 0);
});
