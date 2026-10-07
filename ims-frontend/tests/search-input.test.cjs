/* eslint-disable @typescript-eslint/no-require-imports -- Exercise TSX input handlers in Node. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
function load(file, overrides = {}) {
  const filename = require.resolve(file);
  const compiled = new Module(filename, module);
  compiled.paths = module.paths;
  const originalRequire = compiled.require.bind(compiled);
  compiled.require = name => overrides[name] || originalRequire(name);
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return compiled.exports;
}
const helper = load('../src/lib/search-input.ts');
const SearchInput = load('../src/components/ui/SearchInput.tsx', { '@/lib/search-input': helper }).default;

test('removes emoji sequences and preserves ordinary search characters', () => {
  for (const emoji of ['😀', '💵', '👨‍👩‍👧‍👦', '👍🏽', '🇵🇭', '1️⃣', '#️⃣', '❤️', '🏳️‍🌈']) {
    assert.equal(helper.removeSearchEmojis('Milk ' + emoji + ' 123'), 'Milk  123');
  }
  const normal = 'José café 中文 ORD-123 user@example.com #1 * + /';
  assert.equal(helper.removeSearchEmojis(normal), normal);
});

test('mobile typing blocks emojis and retains existing keyboard handlers', () => {
  let keys = 0;
  const { props } = SearchInput({ onKeyDown() { keys++; } });
  for (const data of ['😀', '👍🏽', '🇵🇭']) {
    let prevented = false;
    props.onBeforeInput({ nativeEvent: { data }, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    prevented = false;
    props.onKeyDown({ key: data, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
  }
  for (const data of ['a', '1', '-', null]) {
    props.onBeforeInput({ nativeEvent: { data }, preventDefault() { assert.fail('Normal text blocked'); } });
  }
  props.onKeyDown({ key: 'Enter', preventDefault() { assert.fail('Enter blocked'); } });
  assert.equal(keys, 4);
});

test('paste and fallback input clean the visible field and search callback while retaining cursor', () => {
  let received;
  const { props } = SearchInput({ onChange(event) { received = event.target.value; } });
  let selection;
  const target = { value: 'ca😀fé', selectionStart: 4, setSelectionRange(...range) { selection = range; } };
  props.onChange({ target, currentTarget: target });
  assert.equal(target.value, 'café');
  assert.equal(received, 'café');
  assert.deepEqual(selection, [2, 2]);
});
