/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the inline map with mocked tiles. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const React = require('react');
const { parseHTML } = require('linkedom');

test('each map stays collapsed until clicked, pins registered coordinates, and retracts inline', async () => {
  const { window, document } = parseHTML('<html><body><div id="root"></div></body></html>');
  const keys = ['window', 'document', 'navigator', 'ResizeObserver', 'IS_REACT_ACT_ENVIRONMENT'];
  const saved = keys.map(key => [key, Object.getOwnPropertyDescriptor(global, key)]);
  let created = 0, removed = 0, pinned, center, root;
  const instance = { setView(point) { center = point; return this; }, invalidateSize() {}, remove() { removed++; } };
  const filename = require.resolve('../src/components/admin/inventory/StoreMapPreview.tsx');
  const compiled = new Module(filename, module);
  compiled.paths = module.paths;
  const originalRequire = compiled.require.bind(compiled);
  compiled.require = name => {
    if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
    if (name === 'leaflet') return {
      map() { created++; return instance; },
      tileLayer() { return { addTo() {} }; },
      divIcon: options => options,
      marker(point) { pinned = point; return { addTo() { return this; }, bindTooltip() { return this; } }; },
    };
    return originalRequire(name);
  };
  try {
    for (const [key, value] of Object.entries({ window, document,
      navigator: { userAgent: 'test' }, IS_REACT_ACT_ENVIRONMENT: true,
      ResizeObserver: class { observe() {} disconnect() {} },
    })) Object.defineProperty(global, key, { configurable: true, writable: true, value });
    compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, filename);
    const Preview = compiled.exports.default;
    const { createRoot } = require('react-dom/client');
    root = createRoot(document.getElementById('root'));
    await React.act(async () => root.render(React.createElement(Preview, { name: 'Registered Shop', latitude: '14.327', longitude: '120.94' })));
    const button = document.querySelector('button');
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    assert.equal(created, 0, 'no map loaded before clicking');
    await React.act(async () => button.dispatchEvent(new window.Event('click', { bubbles: true })));
    assert.equal(button.getAttribute('aria-expanded'), 'true');
    assert.equal(created, 1);
    assert.deepEqual(pinned, [14.327, 120.94]);
    assert.deepEqual(center, pinned);
    assert.equal(document.querySelector('[data-expanded]').getAttribute('aria-hidden'), 'false');
    assert.equal(document.querySelectorAll('dialog').length, 0);
    await React.act(async () => button.dispatchEvent(new window.Event('click', { bubbles: true })));
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    assert.equal(document.querySelector('[data-expanded]').getAttribute('aria-hidden'), 'true');
    await React.act(async () => button.dispatchEvent(new window.Event('click', { bubbles: true })));
    assert.equal(created, 1, 'reopening reuses the map');
    await React.act(async () => root.render(React.createElement(Preview, { name: 'Missing coordinates', latitude: '', longitude: null })));
    assert.equal(document.querySelector('button').disabled, true);
    await React.act(async () => root.unmount()); root = null;
    assert.equal(removed, 1);
  } finally {
    if (root) await React.act(async () => root.unmount());
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(global, key, descriptor); else delete global[key];
    }
  }
});
