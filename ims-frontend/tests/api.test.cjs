/* eslint-disable @typescript-eslint/no-require-imports -- Load the TypeScript API client in Node. */
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};
const { apiFetch, apiJsonFetch } = require('../src/lib/api.ts');
const originalFetch = global.fetch;
const originalWindow = global.window;
let requests;
beforeEach(() => {
  global.window = {};
  requests = [];
  global.fetch = (url, options) => new Promise((resolve, reject) => {
    requests.push({ url, options, resolve, reject });
  });
});
afterEach(() => {
  global.fetch = originalFetch;
  if (originalWindow === undefined) delete global.window;
  else global.window = originalWindow;
});
const finish = request => request.resolve(new Response('{"count":3}', {
  headers: { 'Content-Type': 'application/json' },
}));

test('concurrent browser reads share a fetch with independently readable bodies; subsequent reads are fresh', async () => {
  const first = apiJsonFetch('/alerts/unread-count');
  const second = apiJsonFetch('/alerts/unread-count');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.headers.has('Content-Type'), false);
  assert.equal(requests[0].options.credentials, 'include');
  finish(requests[0]);
  assert.deepEqual(await Promise.all([first, second]), [{ count: 3 }, { count: 3 }]);
  const fresh = apiJsonFetch('/alerts/unread-count');
  assert.equal(requests.length, 2);
  finish(requests[1]);
  await fresh;
});

test('JSON mutations retain their header and invalidate pending reads for subsequent callers', async () => {
  const before = apiFetch('/suppliers');
  const mutation = apiFetch('/suppliers', { method: 'POST', body: '{}' });
  const after = apiFetch('/suppliers');
  assert.equal(requests.length, 3);
  assert.equal(requests[1].options.headers.get('Content-Type'), 'application/json');
  finish(requests[0]);
  await before;
  const concurrent = apiFetch('/suppliers');
  assert.equal(requests.length, 3);
  finish(requests[1]);
  finish(requests[2]);
  await Promise.all([mutation, after, concurrent]);
});

test('server reads and independently cancellable reads are never shared', async () => {
  delete global.window;
  const serverReads = [apiFetch('/auth/me'), apiFetch('/auth/me')];
  global.window = {};
  const controller = new AbortController();
  const browserReads = [apiFetch('/auth/me', { signal: controller.signal }), apiFetch('/auth/me')];
  assert.equal(requests.length, 4);
  requests.forEach(finish);
  await Promise.all([...serverReads, ...browserReads]);
});

test('headers and cache policies distinguish pending reads; explicit headers and multipart bodies are preserved', async () => {
  const calls = [
    apiFetch('/auth/me'),
    apiFetch('/auth/me', { cache: 'no-store' }),
    apiFetch('/auth/me', { headers: { 'Content-Type': 'text/plain' } }),
    apiFetch('/upload', { method: 'POST', body: new FormData() }),
  ];
  assert.equal(requests.length, 4);
  assert.equal(requests[2].options.headers.get('Content-Type'), 'text/plain');
  assert.equal(requests[3].options.headers.has('Content-Type'), false);
  requests.forEach(finish);
  await Promise.all(calls);
});

test('failed shared reads can be retried', async () => {
  const first = apiFetch('/retry');
  const second = apiFetch('/retry');
  const settled = Promise.allSettled([first, second]);
  requests[0].reject(new Error('offline'));
  assert.deepEqual((await settled).map(result => result.status), ['rejected', 'rejected']);
  const retry = apiFetch('/retry');
  assert.equal(requests.length, 2);
  finish(requests[1]);
  await retry;
});
