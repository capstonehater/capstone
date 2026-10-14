/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the TS scheduler with a virtual clock. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness(request, onSnapshot = () => {}) {
  let now = 0;
  let sequence = 0;
  let visible = true;
  const timers = new Map();
  const snapshots = [];
  const context = {
    exports: {}, AbortController,
    Date: { now: () => now },
    setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const source = fs.readFileSync(require.resolve('../src/lib/notification-poller.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const poller = context.exports.createNotificationPoller({ request, onSnapshot: value => { snapshots.push(value); onSnapshot(value); }, isVisible: () => visible });
  async function advance(ms) {
    const target = now + ms;
    while (true) {
      const due = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      now = due[1].at;
      timers.delete(due[0]);
      due[1].callback();
      for (let i = 0; i < 8; i++) await Promise.resolve();
    }
    now = target;
  }
  return { poller, snapshots, timers, advance, hide: () => { visible = false; }, show: () => { visible = true; } };
}

test('event bursts and snapshot callbacks cannot recursively trigger more requests', async () => {
  let calls = 0;
  const h = harness(async () => ++calls, () => { void h.poller.refresh(); });
  await h.poller.refresh();
  await Promise.all(Array.from({ length: 100 }, () => h.poller.refresh()));
  assert.equal(calls, 1);
  await h.advance(14999);
  assert.equal(calls, 1);
  await h.advance(1);
  assert.equal(calls, 2);
  assert.equal(h.timers.size, 1);
  h.poller.stop();
});

test('slow requests do not overlap, and a timeout aborts them before delayed retry', async () => {
  let calls = 0;
  let signal;
  const h = harness(value => {
    calls++; signal = value;
    return new Promise((_, reject) => value.addEventListener('abort', () => reject(new Error('aborted'))));
  });
  const first = h.poller.refresh();
  await Promise.all(Array.from({ length: 100 }, () => h.poller.refresh()));
  assert.equal(calls, 1);
  await h.advance(10000);
  await first;
  assert.equal(signal.aborted, true);
  await h.advance(29999);
  assert.equal(calls, 1);
  await h.advance(1);
  assert.equal(calls, 2);
  h.poller.stop();
});

test('failures back off and a successful retry restores normal polling', async () => {
  let calls = 0;
  const h = harness(async () => { calls++; if (calls < 3) throw new Error('offline'); return 'ok'; });
  await h.poller.refresh();
  await h.advance(30000);
  assert.equal(calls, 2);
  await h.poller.refresh();
  assert.equal(calls, 2);
  await h.advance(60000);
  assert.deepEqual(h.snapshots, ['ok']);
  await h.advance(15000);
  assert.equal(calls, 4);
  h.poller.stop();
});

test('hidden tabs pause requests and cleanup removes timers and ignores late responses', async () => {
  let calls = 0;
  let finish;
  let signal;
  const h = harness(value => { calls++; signal = value; return new Promise(resolve => { finish = resolve; }); });
  h.hide();
  await h.poller.refresh();
  await h.advance(60000);
  assert.equal(calls, 0);
  h.show();
  const pending = h.poller.refresh();
  assert.equal(calls, 1);
  h.poller.stop();
  assert.equal(signal.aborted, true);
  finish('late');
  await pending;
  await h.advance(600000);
  assert.deepEqual(h.snapshots, []);
  assert.equal(h.timers.size, 0);
  assert.equal(calls, 1);
});
