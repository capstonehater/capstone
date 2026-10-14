/* eslint-disable @typescript-eslint/no-require-imports -- Load shared location utilities. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const filename = require.resolve('../src/lib/store-distance.ts');
function load() {
  const mod = new Module(filename, module);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return mod.exports;
}
test('supplier readings are reused from memory and session storage without another GPS wait', async () => {
  const previous = global.window;
  const data = new Map();
  global.window = { sessionStorage: {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  } };
  try {
    const source = load();
    const fix = { latitude: 14.3, longitude: 120.9, accuracy: 20, timestamp: Date.now() };
    source.cacheLocation(fix);
    assert.deepEqual(source.getCachedLocation(), fix);
    const consumer = load();
    assert.deepEqual(await consumer.readLiveLocation(), fix);
    assert.equal(consumer.preciseLocation(consumer.getCachedLocation()), true);
    consumer.clearCachedLocation();
    assert.equal(consumer.getCachedLocation(), null);
    assert.equal(data.size, 0);
    data.set('ims:user-location:v1', JSON.stringify({ ...fix, timestamp: Date.now() - 31000 }));
    const old = load().getCachedLocation();
    assert.equal(old.latitude, fix.latitude);
    assert.equal(source.freshLocation(old), false);
    data.set('ims:user-location:v1', '{invalid');
    assert.equal(load().getCachedLocation(), null);
  } finally { global.window = previous; }
});
test('cache remains usable when session storage is blocked and coarse fixes never enable navigation', () => {
  const previous = global.window;
  global.window = { get sessionStorage() { throw new Error('blocked'); } };
  try {
    const helper = load();
    const fix = { latitude: 14.3, longitude: 120.9, accuracy: 1200, timestamp: Date.now() };
    helper.cacheLocation(fix);
    assert.deepEqual(helper.getCachedLocation(), fix);
    assert.equal(helper.preciseLocation(helper.getCachedLocation()), false);
    helper.clearCachedLocation();
    assert.equal(helper.getCachedLocation(), null);
  } finally { global.window = previous; }
});

test('background tracking warms the cache and shares one watcher with cleanup', () => {
  const keys = ['window', 'document', 'navigator'];
  const saved = keys.map(key => [key, Object.getOwnPropertyDescriptor(global, key)]);
  let watched = 0, cleared = 0, quickRequests = 0, receive;
  const fix = { coords: { latitude: 14.3, longitude: 120.9, accuracy: 20 }, timestamp: Date.now() };
  try {
    Object.defineProperty(global, 'window', { configurable: true, value: {
      isSecureContext: true, setInterval: () => 1, clearInterval() {},
    } });
    Object.defineProperty(global, 'document', { configurable: true, value: {
      visibilityState: 'visible', addEventListener() {}, removeEventListener() {},
    } });
    Object.defineProperty(global, 'navigator', { configurable: true, value: { geolocation: {
      watchPosition(success) { watched++; receive = success; return 9; },
      getCurrentPosition(success, error, options) {
        quickRequests++; assert.equal(options.enableHighAccuracy, false); success(fix);
      },
      clearWatch(id) { assert.equal(id, 9); cleared++; },
    } } });
    const helper = load();
    const stopA = helper.trackLocationInBackground();
    const stopB = helper.trackLocationInBackground();
    assert.equal(watched, 1);
    assert.equal(quickRequests, 1);
    assert.equal(helper.getCachedLocation().accuracy, 20);
    receive({ ...fix, coords: { ...fix.coords, latitude: 14.4 } });
    assert.equal(helper.getCachedLocation().latitude, 14.4);
    stopA(); assert.equal(cleared, 0);
    stopB(); assert.equal(cleared, 1);
    stopB(); assert.equal(cleared, 1);
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(global, key, descriptor); else delete global[key];
    }
  }
});
