/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the TS notification flow without a browser. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function setup() {
  const saved = new Map();
  const context = { exports: {}, localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/alert-notification-flow.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}
const alert = (id, severity = 'WARNING') => ({ id, severity, type: 'LOW_STOCK', title: `${id} is running low`, message: '', firstTriggeredAt: '2026-10-13T00:00:00Z' });
const snapshot = { alerts: [alert('Milk'), alert('Rice')], pendingCount: 9 };
const kinds = queue => Array.from(queue, item => item.kind);

test('opening shows the new count first; ignoring it shows products once, then pending count', () => {
  const { createAlertNotificationFlow } = setup();
  const flow = createAlertNotificationFlow('admin', 0);
  let queue = flow.ingest(snapshot, false, 0);
  assert.deepEqual(kinds(queue), ['summary', 'product', 'product']);
  assert.equal(queue[0].count, 2);
  queue = flow.advance(queue[0].key, 12000);
  assert.equal(queue[0].alert.id, 'Milk');
  queue = flow.advance(queue[0].key, 24000);
  assert.equal(queue[0].alert.id, 'Rice');
  queue = flow.advance(queue[0].key, 36000);
  assert.deepEqual(kinds(queue), ['pending']);
  assert.equal(queue[0].count, 9);
  queue = flow.advance(queue[0].key, 48000);
  assert.equal(queue.length, 0);
  for (let now = 60000; now < 936000; now += 15000) assert.equal(flow.ingest(snapshot, false, now).length, 0);
  const reminder = flow.ingest(snapshot, false, 936000);
  assert.deepEqual(kinds(reminder), ['pending']);
  assert.equal(reminder[0].count, 9);
});

test('viewing Alerts captures New badges for the visit, clears the sequence and clears badges next visit', () => {
  const { createAlertNotificationFlow, unseenAlerts, markAlertsSeen } = setup();
  const flow = createAlertNotificationFlow('admin', 0);
  flow.ingest(snapshot, false, 0);
  assert.equal(flow.clear(1000).length, 0);
  const visitBadges = unseenAlerts('admin', snapshot.alerts).map(item => item.id);
  markAlertsSeen('admin', snapshot.alerts);
  assert.deepEqual(Array.from(visitBadges), ['Milk', 'Rice']);
  assert.equal(unseenAlerts('admin', snapshot.alerts).length, 0);
  assert.equal(flow.ingest(snapshot, true, 2000).length, 0);
  assert.equal(flow.ingest(snapshot, false, 3000).length, 0);
  const reopened = createAlertNotificationFlow('admin', 4000);
  assert.equal(reopened.ingest(snapshot, false, 4000).length, 0);
});

test('seen tracking is per user and displaying or closing a notification does not mark it viewed', () => {
  const { createAlertNotificationFlow, unseenAlerts, markAlertsSeen } = setup();
  const flow = createAlertNotificationFlow('admin', 0);
  const queue = flow.ingest(snapshot, false, 0);
  flow.advance(queue[0].key, 12000);
  assert.equal(unseenAlerts('admin', snapshot.alerts).length, 2);
  markAlertsSeen('admin', snapshot.alerts);
  assert.equal(unseenAlerts('admin', snapshot.alerts).length, 0);
  assert.equal(unseenAlerts('manager', snapshot.alerts).length, 2);
});

test('new arrivals and severity escalation are delivered, unchanged snapshots never restart the sequence', () => {
  const { createAlertNotificationFlow, markAlertsSeen } = setup();
  markAlertsSeen('admin', snapshot.alerts);
  const flow = createAlertNotificationFlow('admin', 0);
  assert.equal(flow.ingest(snapshot, false, 0).length, 0);
  const changed = { alerts: [...snapshot.alerts, alert('Coffee', 'CRITICAL')], pendingCount: 10 };
  const first = flow.ingest(changed, false, 15000);
  assert.deepEqual(kinds(first), ['product']);
  assert.equal(first[0].alert.id, 'Coffee');
  const second = flow.ingest(changed, false, 30000);
  assert.equal(second.length, 1);
  assert.equal(second[0], first[0]);
  const escalated = { alerts: [alert('Milk', 'CRITICAL'), alert('Rice'), alert('Coffee', 'CRITICAL')], pendingCount: 10 };
  assert.equal(flow.ingest(escalated, false, 45000).length, 2);
});

test('Alerts page suppresses pop-ups and zero unresolved alerts never produce a reminder', () => {
  const { createAlertNotificationFlow } = setup();
  const flow = createAlertNotificationFlow('admin', 0);
  assert.equal(flow.ingest(snapshot, true, 0).length, 0);
  assert.equal(flow.ingest(snapshot, true, 900000).length, 0);
  assert.equal(flow.ingest({ alerts: [], pendingCount: 0 }, false, 1800000).length, 0);
});

test('POS routes suppress queued notices and reminders, then resume after 15 minutes away', () => {
  const { createAlertNotificationFlow, suppressAlertNotifications } = setup();
  for (const pathname of ['/pos', '/pos/transactions', '/staff/pos', '/staff/pos/checkout', '/alerts', '/admin/alerts']) {
    assert.equal(suppressAlertNotifications(pathname), true);
  }
  for (const pathname of ['/dashboard', '/reports/pos', '/staff/transactions', '/positive']) {
    assert.equal(suppressAlertNotifications(pathname), false);
  }
  const flow = createAlertNotificationFlow('admin', 0);
  assert.ok(flow.ingest(snapshot, false, 0).length);
  assert.equal(flow.ingest(snapshot, true, 1000).length, 0);
  assert.equal(flow.ingest(snapshot, true, 1800000).length, 0);
  assert.equal(flow.ingest(snapshot, false, 2699999).length, 0);
  const reminder = flow.ingest({ ...snapshot, pendingCount: 7 }, false, 2700000);
  assert.deepEqual(kinds(reminder), ['pending']);
  assert.equal(reminder[0].count, 7);
});

test('notification UI is only mounted for signed-in users with Alerts access', () => {
  let user = null;
  let allowed = false;
  const context = {
    exports: {},
    require(name) {
      if (name === 'react' || name === 'react/jsx-runtime') return require(name);
      if (name === '@/store/authStore') return { useAuthStore: select => select({ user, can: permission => allowed && permission === 'alerts.view' }) };
      return {};
    },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/components/layout/AlertNotifications.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context);
  assert.equal(context.exports.default(), null);
  user = { id: 'admin' };
  assert.equal(context.exports.default(), null);
  allowed = true;
  assert.equal(context.exports.default().props.userId, 'admin');
  user = { id: 'manager' };
  assert.equal(context.exports.default().props.userId, 'manager');
  allowed = false;
  assert.equal(context.exports.default(), null);
});
