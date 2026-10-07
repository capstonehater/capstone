/* eslint-disable @typescript-eslint/no-require-imports -- Exercise TSX validation handlers in Node. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const filename = require.resolve('../src/components/staff-pos/modals/DiscountDetailsModal.tsx');
let state = [], cursor = 0;
const compiled = new Module(filename, module);
compiled.paths = module.paths;
const originalRequire = compiled.require.bind(compiled);
compiled.require = name => {
  if (name === 'react') return { useId: () => 'discount-test', useRef: () => ({ current: null }), useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = value; }]; } };
  if (name === './Modal') return { __esModule: true, default: () => null };
  if (name.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => key });
  return originalRequire(name);
};
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText, filename);
function elements(node, type, result = []) {
  if (Array.isArray(node)) { node.forEach(child => elements(child, type, result)); return result; }
  if (!node || typeof node !== 'object') return result;
  if (node.type === type) result.push(node);
  elements(node.props?.children, type, result);
  return result;
}
for (const discount of ['senior', 'pwd']) test(discount + ' requires both ID fields before applying', () => {
  state = []; let submitted;
  const render = () => { cursor = 0; return compiled.exports.default({ discount, onClose() {}, onSubmit(details) { submitted = details; } }); };
  let tree = render();
  assert.ok(tree.props.title.includes(discount === 'senior' ? 'Senior Citizen' : 'PWD'));
  let inputs = elements(tree, 'input');
  assert.ok(inputs.every(input => input.props.required));
  elements(tree, 'form')[0].props.onSubmit({ preventDefault() {} });
  tree = render(); inputs = elements(tree, 'input');
  assert.ok(inputs.every(input => input.props['aria-invalid']));
  assert.equal(submitted, undefined);
  inputs[0].props.onChange({ target: { value: '  Maria Santos  ' } });
  inputs[1].props.onChange({ target: { value: '   ' } });
  tree = render(); elements(tree, 'form')[0].props.onSubmit({ preventDefault() {} });
  tree = render(); inputs = elements(tree, 'input');
  assert.equal(inputs[0].props['aria-invalid'], false);
  assert.equal(inputs[1].props['aria-invalid'], true);
  assert.equal(submitted, undefined);
  inputs[1].props.onChange({ target: { value: '  ID-123  ' } });
  tree = render(); elements(tree, 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.deepEqual(submitted, { name: 'Maria Santos', idNumber: 'ID-123' });
});
