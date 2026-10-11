/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the TSX modal with saved API results. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');

function render(results, { showResults = true, status = 'COMPLETED', location = null } = {}) {
  const filename = require.resolve('../src/components/admin/inventory/StoreAvailabilityModal.tsx');
  const compiled = new Module(filename, module);
  compiled.paths = module.paths;
  const originalRequire = compiled.require.bind(compiled);
  let stateIndex = 0;
  const states = [{ results, status }, false, 0, false, null, false, showResults, location, ''];
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
  assert.equal(elements(elements(tree, 'footer')[0], 'button').length, 1);
});

test('results place Search again in the footer', () => {
  const tree = render([row('saved', 'Shop')]);
  assert.ok(elements(elements(tree, 'footer')[0], 'button').some(node => node.props.children.includes('Search again')));
});

test('live coordinates override obsolete saved distances', () => {
  const result = row('shop', 'Shop');
  result.payload = { ...result.payload, latitude: 0, longitude: 1, distance: 999 };
  const tree = render([result], { location: { latitude: 0, longitude: 0, accuracy: 10, timestamp: Date.now() } });
  assert.ok(elements(tree, 'p').some(node => typeof node.props.children === 'string'
    && node.props.children.includes('111.19 km from your current location')));
});

test('unavailable live location never uses a saved distance', () => {
  const result = row('shop', 'Shop');
  result.payload.distance = 999;
  const tree = render([result]);
  assert.ok(elements(tree, 'p').some(node => typeof node.props.children === 'string'
    && node.props.children.startsWith('Distance unavailable.')));
});

test('stale locations and missing supplier coordinates leave distances unavailable', () => {
  const result = row('shop', 'Shop');
  result.payload = { ...result.payload, latitude: 0, longitude: 1, distance: 999 };
  for (const [location, latitude] of [
    [{ latitude: 0, longitude: 0, accuracy: 10, timestamp: Date.now() - 60000 }, 0],
    [{ latitude: 0, longitude: 0, accuracy: 10, timestamp: Date.now() }, null],
  ]) {
    result.payload.latitude = latitude;
    const tree = render([result], { location });
    assert.ok(elements(tree, 'p').some(node => typeof node.props.children === 'string'
      && node.props.children.startsWith('Distance unavailable.')));
  }
});
