import {
  fetchPosTransactionHistory,
  fetchPosAuditExceptions,
  type PosTransactionHistoryFilters,
  type PosAuditExceptionsFilters,
} from "./reports";

type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

// Fetch fresh results from page one, independent of the table's displayed page.
// Never download a partial report when a request fails or the result set changes.
export async function collectReportPages<T extends { pagination: Pagination }, R extends { id: string }>(
  fetchPage: (page: number, pageSize: number) => Promise<T>,
  getRows: (report: T) => R[],
) {
  const first = await fetchPage(1, 100);
  const rows: R[] = [];
  const ids = new Set<string>();
  const append = (report: T, page: number) => {
    if (report.pagination.page !== page || report.pagination.total !== first.pagination.total
      || report.pagination.pageSize !== first.pagination.pageSize
      || report.pagination.totalPages !== first.pagination.totalPages) {
      throw new Error("Report results changed during export. Please try again.");
    }
    for (const row of getRows(report)) {
      if (ids.has(row.id)) throw new Error("Report results changed during export. Please try again.");
      ids.add(row.id);
      rows.push(row);
    }
  };
  append(first, 1);
  for (let page = 2; page <= first.pagination.totalPages; page++) {
    append(await fetchPage(page, first.pagination.pageSize), page);
  }
  if (rows.length !== first.pagination.total) {
    throw new Error("The complete report could not be retrieved. Please try again.");
  }
  return { report: first, rows };
}

export async function fetchAllPosTransactionHistory(filters: PosTransactionHistoryFilters) {
  const { report, rows } = await collectReportPages(
    (page, pageSize) => fetchPosTransactionHistory({ ...filters, page, pageSize }),
    report => report.orders,
  );
  return { ...report, orders: rows };
}

export async function fetchAllPosAuditExceptions(filters: PosAuditExceptionsFilters) {
  const { report, rows } = await collectReportPages(
    (page, pageSize) => fetchPosAuditExceptions({ ...filters, page, pageSize }),
    report => report.rows,
  );
  return { ...report, rows };
}
