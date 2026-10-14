import type { PosOrder } from "./pos";

// Use completed checkout amounts, including VAT. Refunded orders remain in the
// exported history and counts, but do not contribute to this sales ranking.
export function summarizeTransactionExport(orders: PosOrder[]) {
  const accounts = new Map<string, {
    account: string; email: string; transactions: number; salesCents: number;
  }>();
  let salesCents = 0;
  let discountCents = 0;
  let vatCents = 0;
  let completed = 0;
  for (const order of orders) {
    if (order.status !== "COMPLETED") continue;
    completed++;
    const amount = Math.round(Number(order.totalAmount) * 100);
    salesCents += amount;
    discountCents += Math.round(Number(order.discountAmount) * 100);
    vatCents += Math.round(Number(order.taxAmount) * 100);
    const account = `${order.createdBy.firstName} ${order.createdBy.lastName}`.trim();
    const key = order.createdBy.id || order.createdBy.email || account;
    const entry = accounts.get(key) ?? { account, email: order.createdBy.email ?? "", transactions: 0, salesCents: 0 };
    entry.transactions++;
    entry.salesCents += amount;
    accounts.set(key, entry);
  }
  const ranked = [...accounts.values()].sort((a, b) => b.salesCents - a.salesCents
    || b.transactions - a.transactions || a.account.localeCompare(b.account) || a.email.localeCompare(b.email));
  const highestSales = ranked[0]?.salesCents ?? 0;
  const highestCount = Math.max(0, ...ranked.map(row => row.transactions));
  const label = (row: typeof ranked[number]) => row.email ? `${row.account} (${row.email})` : row.account;
  const leaders = (rows: typeof ranked) => {
    const visible = rows.slice(0, 2).map(row => {
      const name = label(row);
      return name.length > 120 ? `${name.slice(0, 117)}...` : name;
    }).join("; ");
    return visible + (rows.length > 2 ? `; +${rows.length - 2} tied accounts (see ranking)` : "");
  };
  return {
    totalTransactions: orders.length,
    completedTransactions: completed,
    refundedTransactions: orders.filter(order => order.status === "REFUNDED").length,
    completedSales: salesCents / 100,
    discounts: discountCents / 100,
    vat: vatCents / 100,
    averageSale: completed ? salesCents / 100 / completed : 0,
    staffCount: ranked.length,
    topSalesAccounts: highestSales > 0 ? leaders(ranked.filter(row => row.salesCents === highestSales)) : "N/A",
    topSalesAmount: highestSales / 100,
    topTransactionAccounts: highestCount ? leaders(ranked.filter(row => row.transactions === highestCount)) : "N/A",
    topTransactionCount: highestCount,
    staff: ranked.map(row => ({
      ...row,
      rank: ranked.findIndex(other => other.salesCents === row.salesCents) + 1,
      sales: row.salesCents / 100,
      share: salesCents > 0 ? row.salesCents / salesCents * 100 : null,
    })),
  };
}

export const transactionExportSummaryNote = "Sales and staff rankings use completed transactions in this export, after discounts and including VAT. Refunded orders are counted separately and excluded from sales. Accounts are credited to the original checkout creator. Tied sales amounts share a rank. These checkout totals are separate from reversal-date net sales in Sales Analytics.";

export const transactionExportAccountingNote = "Completed checkout amounts are after discounts and include VAT. Refunded orders are counted separately and excluded from sales rankings.";
