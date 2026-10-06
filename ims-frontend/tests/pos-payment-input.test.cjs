/* eslint-disable @typescript-eslint/no-require-imports -- Exercise TSX event handlers in Node. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const filename = require.resolve('../src/components/staff-pos/modals/PaymentModal.tsx');
const compiled = new Module(filename, module);
compiled.paths = module.paths;
const originalRequire = compiled.require.bind(compiled);
compiled.require = name => {
  if (name === '@/lib/pos-utils') return { formatPeso: value => `PHP ${value}` };
  if (name === './Modal') return { __esModule: true, default: () => null };
  if (name.endsWith('.module.css')) return {};
  return originalRequire(name);
};
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, filename);
function fields(node, result = []) {
  if (Array.isArray(node)) { node.forEach(child => fields(child, result)); return result; }
  if (!node || typeof node !== 'object') return result;
  if (node.type === 'input') result.push(node.props);
  fields(node.props?.children, result);
  return result;
}
function setup() {
  let payments = { cash: '', gcash: '', maya: '', card: '' };
  const tree = compiled.exports.default({ total: 100, cartCount: 1, payments,
    setPayments: update => { payments = update(payments); }, onClose() {}, onConfirm() {} });
  return { inputs: fields(tree), value: () => payments };
}
test('all four payment inputs accept five digits and reject invalid pasted values', () => {
  const { inputs, value } = setup();
  assert.equal(inputs.length, 4);
  inputs.forEach((input, index) => {
    assert.equal(input.maxLength, 5);
    assert.equal(input.inputMode, 'numeric');
    const key = ['cash', 'gcash', 'maya', 'card'][index];
    input.onChange({ target: { value: '99999' } });
    assert.equal(value()[key], '99999');
    for (const invalid of ['100000', '12abc', '1e3', '-100', '+100', '1.25', ' 12 ']) {
      input.onChange({ target: { value: invalid } });
      assert.equal(value()[key], '99999');
    }
    input.onChange({ target: { value: '' } });
    assert.equal(value()[key], '');
  });
});
test('typing rejects letters and punctuation while retaining editing and shortcuts', () => {
  const { inputs } = setup();
  for (const key of ['e', 'a', '-', '+', '.', ' ']) {
    let prevented = false;
    inputs[0].onKeyDown({ key, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
  }
  for (const event of [{ key: '5' }, { key: 'Backspace' }, { key: 'ArrowLeft' }, { key: 'Tab' }, { key: 'v', ctrlKey: true }, { key: 'a', metaKey: true }]) {
    let prevented = false;
    inputs[0].onKeyDown({ ...event, preventDefault() { prevented = true; } });
    assert.equal(prevented, false);
  }
});
