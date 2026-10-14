/* eslint-disable @typescript-eslint/no-require-imports -- Exercise TS helpers with mocked report requests. */
require('./helpers/register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const api = require('../src/lib/api.ts');
const { collectReportPages, fetchAllPosTransactionHistory, fetchAllPosAuditExceptions } = require('../src/lib/report-export-pagination.ts');

test('month exports fetch every page from page one and preserve dates and filters', async () => {
  const original = api.apiJsonFetch;
  const calls = [];
  api.apiJsonFetch = async url => {
    const query = new URL(url, 'https://example.test');
    calls.push(query);
    const page = Number(query.searchParams.get('page'));
    const rows = Array.from({ length: page === 3 ? 5 : 100 }, (_, i) => ({ id: String((page - 1) * 100 + i) }));
    return { report: { orders: rows, rows, summary: { totalExceptions: 205 }, pagination: { page, pageSize: 100, total: 205, totalPages: 3 } } };
  };
  try {
    const filters = { from: '2026-09-30T16:00:00.000Z', to: '2026-10-31T15:59:59.999Z', page: 9, pageSize: 10, search: 'Maria', paymentMethod: 'CASH', status: 'COMPLETED' };
    const history = await fetchAllPosTransactionHistory(filters);
    assert.equal(history.orders.length, 205);
    assert.equal(history.orders.at(-1).id, '204');
    assert.deepEqual(calls.map(url => url.searchParams.get('page')), ['1', '2', '3']);
    for (const url of calls) {
      for (const key of ['from', 'to', 'search', 'paymentMethod', 'status']) assert.equal(url.searchParams.get(key), filters[key]);
      assert.equal(url.searchParams.get('pageSize'), '100');
    }
    calls.length = 0;
    const auditFilters = { from: filters.from, to: filters.to, staffSearch: 'Maria', reasonSearch: 'Refund', status: 'REFUNDED', exceptionType: 'REFUND' };
    const audit = await fetchAllPosAuditExceptions(auditFilters);
    assert.equal(audit.rows.length, 205);
    assert.equal(audit.summary.totalExceptions, 205);
    for (const url of calls) for (const key of Object.keys(auditFilters)) assert.equal(url.searchParams.get(key), auditFilters[key]);
  } finally { api.apiJsonFetch = original; }
});

test('empty ranges succeed and failed pages reject instead of returning partial results', async () => {
  const empty = await collectReportPages(async page => ({ rows: [], pagination: { page, pageSize: 100, total: 0, totalPages: 0 } }), report => report.rows);
  assert.deepEqual(empty.rows, []);
  await assert.rejects(collectReportPages(async page => {
    if (page === 2) throw new Error('Connection lost');
    return { rows: [{ id: 'first' }], pagination: { page, pageSize: 1, total: 2, totalPages: 2 } };
  }, report => report.rows), /Connection lost/);
});

test('incomplete, duplicate and changing results reject the export', async () => {
  for (const mode of ['incomplete', 'duplicate', 'changed']) {
    await assert.rejects(collectReportPages(async page => ({
      rows: page === 1 ? [{ id: 'first' }] : mode === 'incomplete' ? [] : [{ id: mode === 'duplicate' ? 'first' : 'last' }],
      pagination: { page, pageSize: 1, total: mode === 'changed' && page === 2 ? 3 : 2, totalPages: 2 },
    }), report => report.rows), /try again/);
  }
});
