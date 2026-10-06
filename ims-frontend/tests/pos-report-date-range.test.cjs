/* eslint-disable @typescript-eslint/no-require-imports -- Load TypeScript report logic and component in Node. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
};
const { getPosReportDateBounds, validatePosReportDateChange } = require('../src/lib/pos-report-date-range.ts');
const fixedNow = new Date('2026-10-05T18:00:00Z'); // October 6 in Manila.

test('Today and Yesterday allow only their Manila date; Custom Date has no preset bounds', t => {
  t.mock.timers.enable({ apis: ['Date'], now: fixedNow });
  assert.deepEqual(getPosReportDateBounds('today'), { min: '2026-10-06', max: '2026-10-06' });
  assert.deepEqual(getPosReportDateBounds('yesterday'), { min: '2026-10-05', max: '2026-10-05' });
  assert.deepEqual(getPosReportDateBounds('custom'), {});
  for (const preset of ['today', 'yesterday']) {
    const bounds = getPosReportDateBounds(preset);
    const range = { from: bounds.min, to: bounds.max };
    assert.equal(validatePosReportDateChange(preset, 'from', bounds.min, range), null);
    assert.match(validatePosReportDateChange(preset, 'to', '2026-10-04', range), /active preset/);
  }
});

test('This Week allows Monday through Sunday and handles year boundaries', t => {
  t.mock.timers.enable({ apis: ['Date'], now: fixedNow });
  assert.deepEqual(getPosReportDateBounds('this-week'), { min: '2026-10-05', max: '2026-10-11' });
  const range = { from: '2026-10-05', to: '2026-10-06' };
  assert.equal(validatePosReportDateChange('this-week', 'to', '2026-10-11', range), null);
  assert.match(validatePosReportDateChange('this-week', 'from', '2026-10-04', range), /active preset/);
  assert.match(validatePosReportDateChange('this-week', 'to', '2026-10-12', range), /active preset/);
  t.mock.timers.setTime(new Date('2026-12-31T18:00:00Z').getTime());
  assert.deepEqual(getPosReportDateBounds('this-week'), { min: '2026-12-28', max: '2027-01-03' });
  t.mock.timers.setTime(new Date('2027-01-03T04:00:00Z').getTime());
  assert.deepEqual(getPosReportDateBounds('this-week'), { min: '2026-12-28', max: '2027-01-03' });
});

test('Custom Date rejects crossed endpoints and empty dates but accepts equal dates and arbitrary valid ranges', () => {
  const range = { from: '2026-10-01', to: '2026-10-06' };
  assert.match(validatePosReportDateChange('custom', 'from', '2026-10-07', range), /From date cannot be later/);
  assert.match(validatePosReportDateChange('custom', 'to', '2026-09-30', range), /From date cannot be later/);
  assert.match(validatePosReportDateChange('custom', 'from', '', range), /valid date/);
  assert.equal(validatePosReportDateChange('custom', 'from', '2026-10-06', range), null);
  assert.equal(validatePosReportDateChange('custom', 'from', '2025-01-01', range), null);
  assert.equal(validatePosReportDateChange('custom', 'to', '2027-01-01', range), null);
});

test('POS controls keep presets selected, expose Custom Date, and alert without applying invalid dates', t => {
  t.mock.timers.enable({ apis: ['Date'], now: fixedNow });
  const originalLoad = Module._load;
  const originalHooks = { useState: React.useState, useMemo: React.useMemo, useRef: React.useRef };
  const originalWindow = global.window;
  const alerts = [];
  global.window = { alert: message => alerts.push(message) };
  const Stub = () => null;
  Module._load = function (name, parent, main) {
    if (name.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (name.startsWith('@/components/') || /^\.\/Pos.+Section$/.test(name)) return { __esModule: true, default: Stub };
    if (name.startsWith('@/')) name = path.resolve(__dirname, '../src', name.slice(2));
    return originalLoad.call(this, name, parent, main);
  };
  let cursor = 0;
  const state = [];
  React.useState = initial => {
    const index = cursor++;
    if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
    return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
  };
  React.useMemo = fn => fn();
  React.useRef = value => ({ current: value });
  try {
    const Workspace = require('../src/components/admin/reports/PosReportsWorkspace.tsx').default;
    const render = () => { cursor = 0; return Workspace(); };
    const nodes = root => {
      if (!root || typeof root !== 'object') return [];
      return [root, ...React.Children.toArray(root.props?.children).flatMap(nodes)];
    };
    const date = label => nodes(render()).find(node => node.props?.label === label);
    const button = label => nodes(render()).find(node => node.type === 'button' && node.props.children === label);
    assert.equal(date('From date').props.min, '2026-10-06');
    assert.equal(date('From date').props.max, '2026-10-06');
    assert.equal(date('From date').props.required, true);
    button('Yesterday').props.onClick();
    assert.equal(date('To date').props.min, '2026-10-05');
    assert.equal(date('To date').props.max, '2026-10-05');
    button('This Week').props.onClick();
    date('To date').props.onChange('2026-10-11');
    assert.equal(button('This Week').props['aria-pressed'], true);
    assert.equal(date('To date').props.value, '2026-10-11');
    button('Custom Date').props.onClick();
    assert.equal(date('From date').props.min, undefined);
    assert.equal(date('To date').props.max, undefined);
    date('From date').props.onChange('2026-10-12');
    assert.equal(alerts.length, 0);
    assert.equal(date('From date').props.value, '2026-10-05');
    const alert = nodes(render()).find(node => node.props?.message?.includes('Invalid date range'));
    assert.ok(alert);
    assert.equal(alert.props.tone, 'error');
    assert.equal(alert.props.title, 'Invalid date range');
    alert.props.onDismiss();
    assert.ok(!nodes(render()).some(node => node.props?.message));
    assert.equal(date('From date').props.value, '2026-10-05');
    date('From date').props.onChange('2026-09-01');
    assert.equal(date('From date').props.value, '2026-09-01');
    assert.ok(!nodes(render()).some(node => node.props?.message));
    assert.equal(button('Custom Date').props['aria-pressed'], true);
  } finally {
    Module._load = originalLoad;
    Object.assign(React, originalHooks);
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
  }
});
