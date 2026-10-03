/* eslint-disable @typescript-eslint/no-require-imports -- Node loader for feature adapter tests. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
};
let role = 'STAFF';
const original = Module._load;
Module._load = function (name, parent, main) {
  if (name.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
  if (name === '@/components/admin/AdminDashboardLayout') return { __esModule: true, default: ({ children, showHeader }) => React.createElement('main', { 'data-header': showHeader }, children) };
  if (name === '@/store/authStore') return { useAuthStore: selector => selector({ user: { role } }) };
  if (name.startsWith('@/components/') || name.startsWith('@/app/admin/forecasting/')) return { __esModule: true, default: () => null, PermissionAction: ({ children }) => children };
  if (name.startsWith('@/lib/')) return {};
  if (name.startsWith('@/')) name = path.resolve(__dirname, '../src', name.slice(2));
  return original.call(this, name, parent, main);
};
for (const [name, title, heading, loading] of [
  ['alerts', 'Alerts', 'Operational Alerts', 'Loading alerts...'],
  ['forecasting', 'Forecasting', 'Raw Material Usage Forecast', 'Loading saved forecasts...'],
]) {
  test(`${name} adapter uses the central entry and one existing shell`, () => {
    const Feature = require(`../src/features/${name}/${title}Feature.tsx`).default;
    const Page = require(`../src/app/(protected)/${name}/page.tsx`).default;
    assert.equal(Page().type, Feature);
    const html = renderToStaticMarkup(React.createElement(Page));
    assert.equal((html.match(/<main/g) || []).length, 1);
    assert.ok(html.includes('data-header="false"'));
    assert.ok(html.includes(heading));
    assert.ok(html.includes(loading));
  });
}
test('forecast settings form retains legacy Administrator presentation', () => {
  const Feature = require('../src/features/forecasting/ForecastingFeature.tsx').default;
  for (role of ['STAFF', 'MANAGER', 'ADMINISTRATOR']) {
    const html = renderToStaticMarkup(React.createElement(Feature));
    assert.equal(html.includes('<form'), role === 'ADMINISTRATOR');
  }
});
