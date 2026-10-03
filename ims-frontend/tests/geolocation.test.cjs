/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS TypeScript test loader. */
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};
const { GET } = require('../src/app/api/geolocation/route.ts');
const originalFetch = global.fetch;
const keys = ['LOCATIONIQ_API_KEY', 'NEXT_PUBLIC_API_BASE_URL', 'SESSION_COOKIE_NAME'];
const originalEnv = Object.fromEntries(keys.map(key => [key, process.env[key]]));
let calls;
let auth;
beforeEach(() => {
  process.env.LOCATIONIQ_API_KEY = 'test-only';
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://backend.example/api';
  delete process.env.SESSION_COOKIE_NAME;
  calls = [];
  auth = () => Response.json({ user: { id: 'user-1' } });
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url) === 'https://backend.example/api/auth/me') return auth();
    assert.equal(new URL(url).hostname, 'us1.locationiq.com');
    return Response.json([{ place_id: '1', lat: '14.3', lon: '120.9', display_name: 'Test place' }]);
  };
});
afterEach(() => {
  global.fetch = originalFetch;
  for (const key of keys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});
const request = (cookie = 'ims_session=token', query = 'q=coffee', extra = {}) =>
  new Request(`https://frontend.example/api/geolocation?${query}`, {
    headers: { ...(cookie === null ? {} : { cookie }), ...extra },
  });
const providers = () => calls.filter(call => call.url.includes('locationiq.com'));
for (const cookie of [null, 'arbitrary=invalid', 'ims_session=', 'ims_session=%ZZ', 'ims_session=a; ims_session=b']) {
  test(`rejects absent/malformed/ambiguous credential: ${cookie}`, async () => {
    assert.equal((await GET(request(cookie))).status, 401);
    assert.equal(calls.length, 0);
  });
}
for (const status of [401, 403, 500, 503, 302]) {
  test(`backend ${status} denies before provider`, async () => {
    auth = () => new Response(null, { status });
    const response = await GET(request('ims_session=arbitrary-invalid-token'));
    assert.equal(response.status, [401, 403].includes(status) ? 401 : 503);
    assert.equal(calls.length, 1);
    assert.equal(providers().length, 0);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  });
}
for (const failure of ['network', 'timeout', 'redirect', 'malformed-json', 'missing-user']) {
  test(`validation ${failure} fails closed`, async () => {
    auth = () => {
      if (failure === 'malformed-json') return new Response('not json');
      if (failure === 'missing-user') return Response.json({});
      throw new Error(failure);
    };
    assert.equal((await GET(request())).status, 503);
    assert.equal(providers().length, 0);
  });
}
for (const base of ['', 'not a url', 'ftp://backend.example', 'https://user:pass@backend.example', 'https://backend.example?query=1']) {
  test(`invalid backend configuration fails closed: ${base}`, async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = base;
    assert.equal((await GET(request())).status, 503);
    assert.equal(calls.length, 0);
  });
}
test('valid session forwards only configured credential and preserves results', async () => {
  process.env.SESSION_COOKIE_NAME = 'custom_session';
  const response = await GET(request('other=secret; custom_session=token%3Dvalue; ims_session=wrong', 'q=coffee', {
    authorization: 'Bearer untrusted', 'x-permissions': '*', host: 'attacker.example',
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls[0].options.headers, { Cookie: 'custom_session=token%3Dvalue' });
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.redirect, 'error');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.equal(calls[1].options.headers, undefined);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await response.json(), { results: [{
    id: '1', latitude: '14.300000', longitude: '120.900000', address: 'Test place',
  }] });
});
test('revocation on next request denies without cached validation', async () => {
  assert.equal((await GET(request())).status, 200);
  auth = () => new Response(null, { status: 401 });
  assert.equal((await GET(request())).status, 401);
  assert.equal(calls.length, 3);
  assert.equal(providers().length, 1);
});
test('authenticated reverse lookup preserves coordinates', async () => {
  assert.equal((await GET(request(undefined, 'lat=14.3&lon=120.9'))).status, 200);
  const url = new URL(calls[1].url);
  assert.equal(url.pathname, '/v1/reverse');
  assert.equal(url.searchParams.get('lat'), '14.3');
  assert.equal(url.searchParams.get('lon'), '120.9');
});
for (const query of ['', 'lat=91&lon=120', 'lat=14&lon=181', 'lat=abc&lon=120', `q=${'x'.repeat(301)}`]) {
  test(`authenticated invalid input: ${query.slice(0, 30)}`, async () => {
    assert.equal((await GET(request(undefined, query))).status, 400);
    assert.equal(calls.length, 1);
    assert.equal(providers().length, 0);
  });
}
