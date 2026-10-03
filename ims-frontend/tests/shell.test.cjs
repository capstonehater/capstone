/* eslint-disable @typescript-eslint/no-require-imports -- Node loader for scoped React shell tests. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
let states = [];
let pathname = '/pos';
let collapsed = false;
const load = Module._load;
const css = new Proxy({}, { get: (_, key) => String(key) });
const icon = () => null;
Module._load = function (name, parent, main) {
  if (name === 'react') return { ...React, useState: initial => [states.length ? states.shift() : initial, () => {}] };
  if (name.endsWith('.module.css')) return { __esModule: true, default: css };
  if (name === 'next/navigation') return { usePathname: () => pathname };
  if (name === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
  if (name === '@/components/admin/AdminDashboardLayout') return { __esModule: true, default: ({ children, showHeader = true }) => React.createElement('main', { 'data-header': showHeader }, children) };
  if (name === '@/store/authStore') return { useAuthStore: () => ({}) };
  if (name === '@/store/sidebarStore') return { useSidebarStore: selector => selector({ collapsed, openSections: {}, toggleCollapsed() {}, toggleSection() {}, expandSection() {}, setScrollTop() {} }) };
  if (name === '@/components/admin/useAdminPageEntrance') return { useAdminPageEntrance: () => null };
  if (name.includes('SidebarAccount')) return { __esModule: true, default: () => React.createElement('div', { 'data-account': true }) };
  if (name === '@/components/layout/shell-navigation') return {
    getVisibleNavigation: () => [{ label: 'Workspace', items: [{ routeId: 'pos', href: '/pos', label: 'POS', icon }] }],
    matchesShellRoute: (a, b) => a === b,
    getAdminPageInfo: () => ({ label: 'Dashboard', subtitle: 'Inventory' }),
    staffPageInfo: { '/pos': { label: 'POS', subtitle: 'Sales' } },
  };
  if (name.startsWith('@/')) name = path.join(root, 'src', name.slice(2));
  return load.call(this, name, parent, main);
};
function compile(source, filename) {
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = module.paths;
  mod._compile(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, filename);
  return mod.exports;
}
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (mod, filename) => {
  mod.exports = compile(fs.readFileSync(filename, 'utf8'), filename);
};

// Render shell states without a browser; verify layout and focus contracts.
for (const file of ['admin/AdminDashboardLayout.tsx', 'admin/AdminSidebar.tsx', 'staff-pos/StaffDashboardLayout.tsx']) {
  const relative = `src/components/${file}`;
  const filename = path.join(root, relative);
  const after = require(filename).default;
  for (const open of [false, true]) for (const collapse of [false, true]) for (const focus of [false, true]) {
    test(`${file}: shell contracts open=${open} collapsed=${collapse} focus=${focus}`, () => {
      collapsed = collapse;
      const props = { isOpen: open, onClose() {}, collapsed: collapse, onToggleCollapse() {}, children: 'Content' };
      const render = component => {
        states = file.startsWith('staff') ? [open, collapse, focus] : file.endsWith('AdminSidebar.tsx') ? [] : [open];
        return renderToStaticMarkup(React.createElement(component, props));
      };
      for (const route of ['/pos', '/dashboard', '/pos/transactions', '/settings']) {
        pathname = route;
        const html = render(after);
        if (!file.endsWith('AdminSidebar.tsx')) {
          assert.equal((html.match(/<main/g) || []).length, 1);
          assert.equal((html.match(/class="shell /g) || []).length, 1);
          assert.ok(html.includes('Content</main>'));
        }
        if (file.startsWith('staff')) {
          assert.equal(html.includes('focusShell'), focus && route === '/pos');
          assert.equal(html.includes('<header'), route !== '/pos/transactions');
          assert.equal(html.includes('class="overlay"'), open);
          assert.equal(html.includes('staffSidebarCollapsed'), collapse);
          assert.ok(html.includes('mobileMenu'));
          assert.equal(html.includes('Exit Focus Mode'), focus && route === '/pos');
        }
        if (file.endsWith('AdminSidebar.tsx')) {
          assert.equal(html.includes('class="overlay"'), open);
          assert.equal(html.includes('adminSidebarCollapsed'), collapse);
          assert.ok(html.includes('id="admin-navigation"'));
        }
      }
    });
  }
}
test('shared controls delegate clicks and preserve overlay tab behavior', () => {
  const controls = require('../src/components/layout/ShellControls.tsx');
  let calls = 0;
  const click = () => calls++;
  assert.equal(controls.NavigationOverlay({ open: false, onClose: click }), null);
  const overlay = controls.NavigationOverlay({ open: true, onClose: click, tabIndex: -1 });
  assert.equal(overlay.props.tabIndex, -1);
  const buttons = [overlay, controls.NavigationCloseButton({ onClose: click }), controls.NavigationMenuButton({ onOpen: click }), controls.SidebarCollapseButton({ collapsed: false, onToggle: click, className: 'collapse' })];
  buttons.forEach(button => button.props.onClick());
  assert.equal(calls, 4);
});

test('canonical Reports routes retain one admin shell and their previous header presentation', () => {
  const ReportsLayout = require('../src/app/(protected)/reports/layout.tsx').default;
  for (const [route, header, sectionHeader] of [
    ['/reports', false, true],
    ['/reports/inventory', true, false],
    ['/reports/pos', false, false],
  ]) {
    pathname = route;
    const html = renderToStaticMarkup(React.createElement(ReportsLayout, null, React.createElement('p', null, 'Report content')));
    assert.equal((html.match(/<main/g) || []).length, 1);
    assert.ok(html.includes(`data-header="${header}"`));
    assert.equal(html.includes('Admin Reports'), sectionHeader);
    assert.ok(html.includes('Report content'));
  }
});
