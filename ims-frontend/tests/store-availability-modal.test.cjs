/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the TSX modal with saved API results. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');

function render(results, { showResults = true, status = 'COMPLETED', location = null, createdAt = null, completedAt = null } = {}) {
  const filename = require.resolve('../src/components/admin/inventory/StoreAvailabilityModal.tsx');
  const compiled = new Module(filename, module);
  compiled.paths = module.paths;
  const originalRequire = compiled.require.bind(compiled);
  let stateIndex = 0;
  const states = [{ results, status, createdAt, completedAt }, false, 0, false, null, false, showResults, location, ''];
  const helperPath = require.resolve('../src/lib/store-distance.ts');
  const helper = new Module(helperPath, module);
  helper._compile(ts.transpileModule(fs.readFileSync(helperPath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, helperPath);
  compiled.require = name => {
    if (name === 'react') return {
      useState: () => [states[stateIndex++], () => {}],
      useEffect: () => {},
      useRef: () => ({ current: null }),
    };
    if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
    if (name === '@/components/ModalCloseButton') return () => null;
    if (name === '@/lib/api') return {};
    if (name === './StoreMapPreview') return { __esModule: true, default: () => null };
    if (name === '@/lib/store-distance') return helper.exports;
    return originalRequire(name);
  };
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return compiled.exports.default({ materialId: 'rice', materialName: 'Rice', onClose() {}, onJourney() {} });
}

function elements(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => elements(child, type));
  return [...(tree.type === type ? [tree] : []), ...elements(tree.props?.children, type)];
}

function row(id, name, rank) {
  return { id, payload: { store_name: name, price: null, ...(rank === undefined ? {} : { recommendation: { rank } }) } };
}

test('saved results with missing, null, blank or invalid names render without crashing', () => {
  const results = [row('missing'), row('null', null), row('blank', '  '), row('invalid', 42), row('named', 'Alpha')];
  const tree = render(results);
  assert.deepEqual(elements(tree, 'h4').map(node => node.props.children),
    ['Alpha', 'Unknown store', 'Unknown store', 'Unknown store', 'Unknown store']);
  assert.deepEqual(results.map(result => result.id), ['missing', 'null', 'blank', 'invalid', 'named']);
});

test('recommendation ranks take priority and equal ranks sort by store name', () => {
  const results = [row('zulu', 'Zulu', 2), row('unknown', undefined, 1), row('alpha', 'Alpha', 2), row('other', 'Other', null)];
  const tree = render(results);
  assert.deepEqual(elements(tree, 'article').map(node => node.key), ['unknown', 'alpha', 'zulu']);
  assert.deepEqual(elements(tree, 'h4').map(node => node.props.children), ['Unknown store', 'Alpha', 'Zulu']);
});

test('empty saved results still show the empty state', () => {
  const tree = render([]);
  assert.equal(elements(tree, 'article').length, 0);
  assert.ok(elements(tree, 'p').some(node => typeof node.props.children === 'string' && node.props.children.includes('No saved store listings yet')));
});

test('opening view shows Search inside the panel and offers saved results separately', () => {
  const tree = render([row('saved', 'Shop')], { showResults: false });
  assert.equal(elements(tree, 'article').length, 0);
  const panel = elements(tree, 'section').find(node => node.props.className === 'loadingPanel');
  assert.ok(panel);
  assert.ok(elements(panel, 'button').some(node => node.props.children.includes('Search')));
  assert.ok(elements(panel, 'button').some(node => node.props.children === 'View saved results'));
  assert.equal(elements(tree, 'footer').length, 0);
});

test('results place Search again in the footer', () => {
  const tree = render([row('saved', 'Shop')]);
  assert.ok(elements(elements(tree, 'footer')[0], 'button').some(node => node.props.children.includes('Search again')));
});

test('saved results show the original search date in the header', () => {
  const createdAt = '2026-10-12T15:30:00.000Z';
  const completedAt = '2026-10-12T15:33:05.000Z';
  const tree = render([row('saved', 'Shop')], { createdAt, completedAt });
  const timestamps = elements(elements(tree, 'header')[0], 'time');
  assert.equal(timestamps.length, 1);
  assert.equal(timestamps[0].props.dateTime, createdAt);
  assert.equal(timestamps[0].props.children, new Date(createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }));
});

test('search date falls back to completion and hides missing or invalid dates', () => {
  const completedAt = '2026-10-12T15:33:05.000Z';
  assert.equal(elements(render([], { completedAt }), 'time')[0].props.dateTime, completedAt);
  for (const options of [{}, { createdAt: 'invalid' }, { createdAt: completedAt, showResults: false }, { createdAt: completedAt, status: 'PENDING' }]) {
    assert.equal(elements(render([], options), 'time').length, 0);
  }
});

test('live coordinates override obsolete saved distances', () => {
  const result = row('shop', 'Shop');
  result.payload = { ...result.payload, latitude: 0, longitude: 1, distance: 999 };
  const tree = render([result], { location: { latitude: 0, longitude: 0, accuracy: 10, timestamp: Date.now() } });
  assert.ok(elements(tree, 'p').some(node => [].concat(node.props.children).join('').includes('111.19 km from your current location')));
});

test('unavailable live location never uses a saved distance', () => {
  const result = row('shop', 'Shop');
  result.payload.distance = 999;
  const tree = render([result]);
  assert.ok(elements(tree, 'p').some(node => /Distance unavailable\.|Calculating distance from your current location/.test([].concat(node.props.children).join(''))));
});

test('last known locations show reference distances while missing supplier coordinates stay unavailable', () => {
  const result = row('shop', 'Shop');
  result.payload = { ...result.payload, latitude: 0, longitude: 1, distance: 999 };
  const location = { latitude: 0, longitude: 0, accuracy: 10, timestamp: Date.now() - 60000 };
  const tree = render([result], { location });
  assert.ok(elements(tree, 'p').some(node => [].concat(node.props.children).join('').includes('111.19 km from your last known location')));
  assert.ok(elements(tree, 'p').some(node => [].concat(node.props.children).join('').includes('Last known location')));
  result.payload.latitude = null;
  assert.ok(elements(render([result], { location }), 'p').some(node => [].concat(node.props.children).join('').startsWith('Distance unavailable.')));
});

test('navigation opens immediately and uses available user coordinates without an accuracy wait', () => {
  const result = row('shop', 'Shop');
  result.payload = { ...result.payload, latitude: 14.3, longitude: 120.9 };
  const now = Date.now();
  const savedWindow = Object.getOwnPropertyDescriptor(global, 'window');
  const savedNavigator = Object.getOwnPropertyDescriptor(global, 'navigator');
  let opened;
  Object.defineProperty(global, 'window', { configurable: true, value: { open(url) { opened = new URL(url); } } });
  Object.defineProperty(global, 'navigator', { configurable: true, value: { userAgent: 'desktop' } });
  try {
    for (const location of [null,
      { latitude: 14.2, longitude: 120.8, accuracy: 1200, timestamp: now },
      { latitude: 14.2, longitude: 120.8, accuracy: 20, timestamp: now - 31000 },
      { latitude: 14.2, longitude: 120.8, accuracy: 20, timestamp: now },
    ]) {
      const tree = render([result], { location });
      const button = elements(tree, 'button').find(node => node.props['aria-label']?.startsWith('Navigation to'));
      assert.equal(button.props.disabled, false);
      button.props.onClick();
      assert.equal(opened.searchParams.get('destination'), '14.3,120.9');
      assert.equal(opened.searchParams.get('origin'), location && now - location.timestamp < 30000 ? '14.2,120.8' : null);
    }
    result.payload.latitude = null;
    const tree = render([result]);
    assert.equal(elements(tree, 'button').find(node => node.props['aria-label']?.startsWith('Navigation to')).props.disabled, true);
  } finally {
    if (savedWindow) Object.defineProperty(global, 'window', savedWindow); else delete global.window;
    if (savedNavigator) Object.defineProperty(global, 'navigator', savedNavigator); else delete global.navigator;
  }
});
