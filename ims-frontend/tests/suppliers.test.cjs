/* eslint-disable @typescript-eslint/no-require-imports -- Node loader for Suppliers adapter tests. */
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
const load = Module._load;
Module._load = function (name, parent, main) {
  if (name === '@/components/admin/AdminDashboardLayout') return { __esModule: true, default: ({ children, showHeader }) => React.createElement('main', { 'data-shell': true, 'data-header': showHeader }, children) };
  if (name === '@/components/admin/AdminSectionHeader') return { __esModule: true, default: ({ title }) => React.createElement('h1', null, title) };
  if (name === '@/components/admin/suppliers/SupplierWorkspace') return { __esModule: true, default: () => React.createElement('div', { 'data-workspace': true }) };
  if (name === '@/lib/inventory') return {};
  if (name === '@/store/inventoryStore') return { useInventoryStore: selector => selector({ supplierId: '', setSupplierId() {} }) };
  if (name.startsWith('@/')) name = path.resolve(__dirname, '../src', name.slice(2));
  return load.call(this, name, parent, main);
};
const Feature = require('../src/features/suppliers/SuppliersFeature.tsx').default;
for (const route of ['(protected)/suppliers']) {
  test(`${route} delegates to the centralized feature with one existing shell`, () => {
    const file = path.resolve(__dirname, `../src/app/${route}/page.tsx`);
    const Page = require(file).default;
    assert.equal(Page().type, Feature);
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /from\s+["'].*\/app\//);
    const html = renderToStaticMarkup(React.createElement(Page));
    assert.equal((html.match(/<main/g) || []).length, 1);
    assert.ok(html.includes('data-header="false"'));
    assert.ok(html.includes('Supplier Management'));
    assert.ok(html.includes('Loading suppliers...'));
  });
}
