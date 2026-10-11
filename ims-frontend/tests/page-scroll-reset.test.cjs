/* eslint-disable @typescript-eslint/no-require-imports -- Verify route and browser restoration lifecycle. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');

function mount({ small = true, hash = '' } = {}) {
  const filename = require.resolve('../src/components/layout/PageScrollReset.tsx');
  const compiled = new Module(filename, module);
  let effect;
  const calls = [];
  const listeners = new Map();
  const frames = new Map();
  let frameId = 0;
  const window = {
    matchMedia: () => ({ matches: small }),
    history: { scrollRestoration: 'auto' },
    location: { hash },
    scrollTo: value => calls.push(['window', value]),
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: name => listeners.delete(name),
  };
  const document = { querySelectorAll: () => [{ scrollTo: value => calls.push(['main', value]) }] };
  compiled.require = name => name === 'react'
    ? { useLayoutEffect: callback => { effect = callback; } }
    : { usePathname: () => '/pos' };
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  compiled.exports.default();
  const original = { window: global.window, document: global.document, requestAnimationFrame: global.requestAnimationFrame, cancelAnimationFrame: global.cancelAnimationFrame };
  Object.assign(global, { window, document,
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  const cleanup = effect();
  return { window, calls, listeners, frames, dispose() { cleanup?.(); Object.assign(global, original); } };
}

test('small screens reset document and main on entry, load, and restored browser pages', () => {
  const page = mount();
  try {
    assert.equal(page.window.history.scrollRestoration, 'manual');
    assert.deepEqual(page.calls.map(call => call[0]), ['window', 'main']);
    page.listeners.get('pageshow')();
    page.listeners.get('load')();
    assert.equal(page.calls.length, 6);
    assert.ok(page.calls.every(([, value]) => value.top === 0 && value.behavior === 'instant'));
  } finally { page.dispose(); }
  assert.equal(page.window.history.scrollRestoration, 'auto');
  assert.equal(page.listeners.size, 0);
  assert.equal(page.frames.size, 0);
});

test('desktop scroll restoration remains unchanged', () => {
  const page = mount({ small: false });
  try {
    assert.equal(page.calls.length, 0);
    assert.equal(page.listeners.size, 0);
    assert.equal(page.window.history.scrollRestoration, 'auto');
  } finally { page.dispose(); }
});

test('explicit section links retain their anchor position', () => {
  const page = mount({ hash: '#waste-insights' });
  try {
    page.listeners.get('pageshow')();
    assert.equal(page.calls.length, 0);
  } finally { page.dispose(); }
});
