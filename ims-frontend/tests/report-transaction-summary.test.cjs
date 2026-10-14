/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the export calculation in Node. */
require('./helpers/register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { summarizeTransactionExport } = require('../src/lib/report-transaction-summary.ts');
const order = (id, staffId, name, amount, status = 'COMPLETED') => ({
  id, status, totalAmount: amount, discountAmount: '0.10', taxAmount: '0.20',
  createdBy: { id: staffId, email: `${staffId}@example.test`, firstName: name, lastName: 'Staff' },
});

test('KPI totals and leaders use all exported orders and distinguish sales amount from transaction count', () => {
  const orders = Array.from({ length: 100 }, (_, i) => order(String(i), 'a', 'Anna', '0.10'));
  orders.push(order('100', 'b', 'Ben', '20.00'), order('101', 'b', 'Ben', '1000', 'REFUNDED'));
  const summary = summarizeTransactionExport(orders);
  assert.equal(summary.totalTransactions, 102);
  assert.equal(summary.completedTransactions, 101);
  assert.equal(summary.refundedTransactions, 1);
  assert.equal(summary.completedSales, 30);
  assert.equal(summary.discounts, 10.1);
  assert.equal(summary.vat, 20.2);
  assert.ok(summary.topSalesAccounts.includes('Ben Staff'));
  assert.equal(summary.topSalesAmount, 20);
  assert.ok(summary.topTransactionAccounts.includes('Anna Staff'));
  assert.equal(summary.topTransactionCount, 100);
  assert.equal(summary.staff[0].rank, 1);
  assert.equal(summary.staff[1].rank, 2);
  assert.equal(summary.staff[0].share, 20 / 30 * 100);
});

test('separate accounts with the same name remain separate and ties share sales rank', () => {
  const summary = summarizeTransactionExport([
    order('1', 'a', 'Sam', '10'), order('2', 'b', 'Sam', '10'), order('3', 'c', 'Charlie', '5'),
  ]);
  assert.equal(summary.staffCount, 3);
  assert.deepEqual(summary.staff.map(row => row.rank), [1, 1, 3]);
  assert.ok(summary.topSalesAccounts.includes('a@example.test'));
  assert.ok(summary.topSalesAccounts.includes('b@example.test'));
  assert.equal(summary.topTransactionCount, 1);
});

test('empty and refund-only reports produce zero sales and no sales leader', () => {
  for (const orders of [[], [order('1', 'a', 'Anna', '100', 'REFUNDED')]]) {
    const summary = summarizeTransactionExport(orders);
    assert.equal(summary.completedSales, 0);
    assert.equal(summary.averageSale, 0);
    assert.equal(summary.topSalesAccounts, 'N/A');
    assert.equal(summary.topTransactionAccounts, 'N/A');
    assert.deepEqual(summary.staff, []);
  }
});
