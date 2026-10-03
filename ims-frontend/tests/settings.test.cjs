/* eslint-disable @typescript-eslint/no-require-imports -- Node loader for Settings adapter tests. */
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
const original = Module._load;
let role = 'STAFF';
Module._load = function (name, parent, main) {
  if (name.endsWith('DashboardLayout')) return { __esModule: true, default: ({ children, showHeader = true }) => React.createElement('main', { 'data-shell': name.includes('Staff') ? 'staff' : 'admin', 'data-header': showHeader }, children) };
  if (name === './SettingsWorkspace') return { __esModule: true, default: () => React.createElement('div', { 'data-workspace': true }) };
  if (name.endsWith('.module.css')) return { __esModule: true, default: { readable: 'readable' } };
  if (name === '@/store/authStore') return { useAuthStore: selector => selector({ user: { role } }) };
  if (name.startsWith('@/')) name = path.resolve(__dirname, '../src', name.slice(2));
  return original.call(this, name, parent, main);
};
for (const value of ['ADMINISTRATOR', 'STAFF', 'MANAGER']) {
  test(`${value} receives shared self-service settings in its existing shell`, () => {
    role = value;
    const SettingsRoute = require('../src/features/settings/SettingsRoute.tsx').default;
    const html = renderToStaticMarkup(React.createElement(SettingsRoute));
    assert.equal((html.match(/<main/g) || []).length, 1);
    assert.equal((html.match(/data-workspace/g) || []).length, 1);
    assert.ok(html.includes(`data-shell="${value === 'STAFF' ? 'staff' : 'admin'}"`));
    assert.ok(html.includes(`data-header="${value === 'MANAGER'}"`));
    assert.equal(html.includes('class="readable space-y-6"'), value !== 'MANAGER');
    assert.ok(html.includes(value === 'MANAGER' ? 'Manager Account' : '>Account<'));
    assert.ok(html.includes(value === 'MANAGER' ? 'ACCOUNT SETTINGS' : '>SETTINGS<'));
    assert.ok(html.includes(value === 'MANAGER' ? 'border-[#232d46]/15' : 'border-[#232d46]/10'));
  });
}
