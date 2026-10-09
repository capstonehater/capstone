/* eslint-disable @typescript-eslint/no-require-imports -- TypeScript component test loader. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { parseHTML } = require('linkedom');

test('live pin, coordinates, copied directions and driving origin follow device updates', async () => {
  const { window, document } = parseHTML('<html><body><div id="root"></div></body></html>');
  const globals = ['window', 'document', 'navigator', 'ResizeObserver', 'IS_REACT_ACT_ENVIRONMENT'];
  const saved = globals.map((key) => [key, Object.getOwnPropertyDescriptor(global, key)]);
  const originalLoad = Module._load;
  const originalTsx = require.extensions['.tsx'];
  let receivePosition;
  let receiveError;
  let cleared = false;
  let pin;
  let root;
  let navigationFix;
  let locationRequests = 0;
  let pendingLocation;
  let delayLocation = false;
  let navigatedUrl;
  let copiedUrl;
  let openedTabs = 0;
  const layer = (point) => ({
    point, removed: false,
    addTo() { return this; }, bindTooltip() { return this; },
    remove() { this.removed = true; },
    setLatLng() { return this; }, on() {},
  });
  const fakeMap = {
    setView() { return this; }, remove() {}, on() {}, invalidateSize() {},
    getBounds() { return { contains: () => true }; }, fitBounds() {},
  };
  const leaflet = {
    map: () => fakeMap, marker: layer, circle: layer,
    circleMarker: (point) => (pin = layer(point)),
    divIcon: () => ({}), tileLayer: () => ({ addTo() {} }),
  };
  try {
    for (const [key, value] of Object.entries({
      window, document, IS_REACT_ACT_ENVIRONMENT: true,
      ResizeObserver: class { observe() {} disconnect() {} },
      navigator: { userAgent: 'node-test', clipboard: { async writeText(url) { copiedUrl = url; } }, geolocation: {
        watchPosition(success, error, options) {
          receivePosition = success; receiveError = error;
          assert.equal(options.enableHighAccuracy, true);
          assert.equal(options.maximumAge, 0);
          return 17;
        },
        getCurrentPosition(success, error, options) {
          locationRequests++;
          assert.equal(options.maximumAge, 30000);
          assert.equal(options.timeout, 5000);
          if (delayLocation) { pendingLocation = { success, error }; return; }
          if (navigationFix) success(navigationFix); else error({ code: 1 });
        },
        clearWatch(id) { assert.equal(id, 17); cleared = true; },
      } },
    })) Object.defineProperty(global, key, { configurable: true, writable: true, value });
    window.isSecureContext = true;
    const dialogPrototype = Object.getPrototypeOf(document.createElement('dialog'));
    dialogPrototype.showModal = function () { this.open = true; this.setAttribute('open', ''); };
    dialogPrototype.close = function () { this.open = false; this.removeAttribute('open'); };
    window.open = (url) => {
      openedTabs++;
      navigatedUrl = url;
      return {
      opener: {}, closed: false,
      location: { replace(url) { navigatedUrl = url; } },
      };
    };
    require.extensions['.tsx'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, filename);
    Module._load = function (name, parent, main) {
      if (name === 'leaflet') return leaflet;
      if (name.endsWith('.css')) return {};
      if (name === '@/components/ui/SearchInput') return { __esModule: true, default: (props) => React.createElement('input', props) };
      if (name === './InventoryField') return { inventoryInputClasses: '' };
      if (name.startsWith('@/')) name = path.resolve(__dirname, '../src', name.slice(2));
      return originalLoad.call(this, name, parent, main);
    };
    const Picker = require('../src/components/admin/inventory/SupplierLocationPicker.tsx').default;
    const { createRoot } = require('react-dom/client');
    root = createRoot(document.getElementById('root'));
    await React.act(async () => {
      root.render(React.createElement(Picker, { latitude: '', longitude: '', address: '', onChange() {} }));
    });
    assert.equal(typeof receivePosition, 'function');
    const fix = (latitude, longitude, accuracy) => ({ coords: { latitude, longitude, accuracy }, timestamp: Date.now() });
    await React.act(async () => receivePosition(fix(14.3, 120.9, 1200)));
    assert.match(document.body.textContent, /14\.300000/);
    assert.match(document.body.textContent, /120\.900000/);
    assert.match(document.body.textContent, /approximate location/);
    assert.deepEqual(pin.point, [14.3, 120.9]);
    const oldPin = pin;
    await React.act(async () => receivePosition(fix(14.31, 120.91, 20)));
    assert.match(document.body.textContent, /14\.310000/);
    assert.match(document.body.textContent, /120\.910000/);
    assert.doesNotMatch(document.body.textContent, /approximate location/);
    assert.deepEqual(pin.point, [14.31, 120.91]);
    assert.equal(oldPin.removed, true);
    await React.act(async () => {
      root.render(React.createElement(Picker, { latitude: '14.327048', longitude: '120.939944', address: 'Supplier', onChange() {} }));
    });
    const displayedUrl = new URL(document.getElementById('supplier-journey-link').value);
    assert.equal(displayedUrl.searchParams.get('origin'), '14.31,120.91');
    assert.equal(displayedUrl.searchParams.get('destination'), '14.327048,120.939944');
    const click = async (label) => React.act(async () => {
      const button = [...document.querySelectorAll('button')].find((node) => node.textContent === label);
      assert.ok(button, label);
      button.dispatchEvent(new window.Event('click', { bubbles: true }));
    });
    await click('Copy journey link');
    assert.equal(new URL(copiedUrl).searchParams.get('origin'), '14.31,120.91');
    navigationFix = fix(14.32, 120.92, 80);
    await click('Open Google Maps');
    assert.equal(locationRequests, 0, 'recent live coordinates should open directions without another GPS request');
    assert.equal(document.querySelector('dialog').hasAttribute('open'), false);
    const route = new URL(navigatedUrl);
    assert.equal(route.searchParams.get('origin'), '14.31,120.91');
    assert.equal(route.searchParams.get('destination'), '14.327048,120.939944');
    assert.equal(route.searchParams.get('travelmode'), 'driving');
    assert.equal(route.searchParams.get('dir_action'), 'navigate');
    assert.match(document.body.textContent, /14\.310000/);
    await React.act(async () => receiveError({ code: 1 }));
    assert.match(document.body.textContent, /Location permission is blocked/);
    assert.match(document.body.textContent, /Latitude: unavailable/);
    assert.equal(pin.removed, true);
    navigationFix = null;
    delayLocation = true;
    const previousRoute = navigatedUrl;
    const previousTabs = openedTabs;
    await click('Open Google Maps');
    assert.equal(locationRequests, 1);
    assert.equal(document.querySelector('dialog').hasAttribute('open'), true);
    assert.match(document.querySelector('dialog').textContent, /up to 5 seconds/);
    assert.equal(navigatedUrl, previousRoute);
    assert.equal(openedTabs, previousTabs, 'no tab should open while location permission is pending');
    await React.act(async () => pendingLocation.error({ code: 3 }));
    assert.equal(document.querySelector('dialog').hasAttribute('open'), false);
    assert.equal(openedTabs, previousTabs, 'denied or timed-out location must not open a tab');
    assert.equal(navigatedUrl, previousRoute);
    assert.match(document.body.textContent, /No fresh coordinates available/);
    await click('Open Google Maps');
    assert.equal(document.querySelector('dialog').hasAttribute('open'), true);
    assert.equal(openedTabs, previousTabs);
    await React.act(async () => pendingLocation.success(fix(14.32, 120.92, 20)));
    assert.equal(document.querySelector('dialog').hasAttribute('open'), false);
    assert.equal(new URL(navigatedUrl).searchParams.get('origin'), '14.32,120.92');
    assert.equal(openedTabs, previousTabs + 1);
    await React.act(async () => root.unmount());
    root = null;
    assert.equal(cleared, true);
  } finally {
    if (root) await React.act(async () => root.unmount());
    Module._load = originalLoad;
    if (originalTsx) require.extensions['.tsx'] = originalTsx;
    else delete require.extensions['.tsx'];
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(global, key, descriptor);
      else delete global[key];
    }
  }
});
