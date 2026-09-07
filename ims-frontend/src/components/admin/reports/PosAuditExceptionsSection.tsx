"use client";

import { useEffect, useState } from "react";
import SummaryCard from "@/components/dashboard/SummaryCard";
import WidgetCard from "@/components/dashboard/WidgetCard";
import {
  exportPosAuditExceptionsCsv,
  exportPosAuditExceptionsPdf,
} from "@/lib/report-exports";
import {
  fetchPosAuditExceptions,
  type PosAuditExceptionKind,
  type PosAuditExceptionsReport,
} from "@/lib/reports";
import type { OrderStatus } from "@/lib/pos";
import { formatDateTime, formatPeso } from "@/lib/pos-utils";
import { POS_STATUS_OPTIONS, statusTone } from "./pos-report-shared";

type Props = {
  active: boolean;
  from: string;
  to: string;
  fromIso: string;
  toIso: string;
  refreshToken: number;
};

const PAGE_SIZE = 10;

const EXCEPTION_TYPE_OPTIONS: Array<{
  value: "ALL" | PosAuditExceptionKind;
  label: string;
}> = [
  { value: "ALL", label: "All exception types" },
  { value: "REFUND", label: "Refunds" },
  { value: "VOID", label: "Voids" },
  { value: "DISCOUNT", label: "Order Discounts" },
];

function exceptionTone(kind: PosAuditExceptionKind) {
  switch (kind) {
    case "REFUND":
      return "bg-amber-100 text-amber-700";
    case "VOID":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-sky-100 text-sky-700";
  }
}

function getExceptionLabel(kind: PosAuditExceptionKind) {
  switch (kind) {
    case "REFUND":
      return "Refund";
    case "VOID":
      return "Void";
    default:
      return "Discount";
  }
}

function getReasonLabel(row: PosAuditExceptionsReport["rows"][number]) {
  if (row.kind === "DISCOUNT") {
    return row.discountDetails?.discountCode ?? "ORDER_LEVEL_DISCOUNT";
  }

  return row.reasonCode ?? "N/A";
}

function getRequestedByLabel(row: PosAuditExceptionsReport["rows"][number]) {
  if (row.approvalContext.requestedBy) {
    return `${row.approvalContext.requestedBy.firstName} ${row.approvalContext.requestedBy.lastName}`;
  }

  if (row.relatedUser) {
    return `${row.relatedUser.firstName} ${row.relatedUser.lastName}`;
  }

  return row.approvalContext.requestedByUserId ?? "N/A";
}

export default function PosAuditExceptionsSection({
  active,
  from,
  to,
  fromIso,
  toIso,
  refreshToken,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PosAuditExceptionsReport | null>(null);
  const [staffSearch, setStaffSearch] = useState("");
  const [reasonSearch, setReasonSearch] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [exceptionType, setExceptionType] = useState<"ALL" | PosAuditExceptionKind>("ALL");
  const [page, setPage] = useState(1);
  const [exportingFormat, setExportingFormat] = useState<"csv" | "pdf" | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const loadReport = async () => {
    setLoading(true);
    try {
      const nextReport = await fetchPosAuditExceptions({
        from: fromIso,
        to: toIso,
        page,
        pageSize: PAGE_SIZE,
        staffSearch: staffSearch.trim() || undefined,
        reasonSearch: reasonSearch.trim() || undefined,
        status: status || undefined,
        exceptionType,
      });
      setReport(nextReport);
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to load audit and exceptions report",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!active) {
      return;
    }

    void loadReport();
  }, [
    active,
    fromIso,
    toIso,
    page,
    staffSearch,
    reasonSearch,
    status,
    exceptionType,
    refreshToken,
  ]);

  useEffect(() => {
    setPage(1);
  }, [fromIso, toIso]);

  if (!active) {
    return null;
  }

  const rows = report?.rows ?? [];
  const hasPreviousPage = page > 1;
  const totalPages = report?.pagination.totalPages ?? 0;
  const hasNextPage = totalPages > 0 && page < totalPages;

  const handleExport = async (format: "csv" | "pdf") => {
    if (!report) {
      return;
    }

    setExportingFormat(format);
    setExportNotice(null);
    setExportError(null);

    try {
      const snapshot = {
        filters: {
          from,
          to,
          staffSearch: staffSearch.trim() || undefined,
          reasonSearch: reasonSearch.trim() || undefined,
          status: status || undefined,
          exceptionType,
          page,
          pageSize: report.pagination.pageSize,
        },
        report,
      };

      if (format === "csv") {
        const filename = exportPosAuditExceptionsCsv(snapshot);
        setExportNotice(`CSV export downloaded as ${filename}.`);
      } else {
        const filename = exportPosAuditExceptionsPdf(snapshot);
        setExportNotice(
          `Printable audit and exceptions report opened as ${filename}. Use your browser's Save as PDF option to finish the export.`,
        );
      }
    } catch (nextError) {
      setExportError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to export audit and exceptions report",
      );
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {exportError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {exportError}
        </div>
      ) : null}

      {exportNotice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {exportNotice}
        </div>
      ) : null}

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-neutral-900">Audit &amp; Exceptions</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Review the currently stored exception signals only: refunds, voids, reversal
              reasons, approval context, and order-level discounts. This section is intentionally
              narrow and does not represent a full edit, delete, or manual-override audit log.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1 block">Staff / User</span>
              <input
                value={staffSearch}
                onChange={(event) => {
                  setStaffSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Responsible, requester, approver"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              />
            </label>
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1 block">Reason / Discount</span>
              <input
                value={reasonSearch}
                onChange={(event) => {
                  setReasonSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Reason code, note, discount code"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              />
            </label>
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1 block">Order Status</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as OrderStatus | "");
                  setPage(1);
                }}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              >
                <option value="">All statuses</option>
                {POS_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1 block">Exception Type</span>
              <select
                value={exceptionType}
                onChange={(event) => {
                  setExceptionType(event.target.value as "ALL" | PosAuditExceptionKind);
                  setPage(1);
                }}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              >
                {EXCEPTION_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={loading || exportingFormat !== null}
              onClick={() => void handleExport("csv")}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportingFormat === "csv" ? "Exporting..." : "Export CSV"}
            </button>
            <button
              type="button"
              disabled={loading || exportingFormat !== null}
              onClick={() => void handleExport("pdf")}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportingFormat === "pdf" ? "Preparing..." : "Export PDF"}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Scope note: this section only reflects stored reversal and order-discount exception data.
          It does not track edited orders, deleted items, manual price overrides, cancelled orders,
          or old/new field diffs.
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          title="Total Exceptions"
          value={loading ? "..." : report?.summary.totalExceptions ?? 0}
        />
        <SummaryCard
          title="Refund Count"
          value={loading ? "..." : report?.summary.refundCount ?? 0}
        />
        <SummaryCard
          title="Refunded Amount"
          value={loading ? "..." : formatPeso(report?.summary.refundedAmount ?? "0")}
        />
        <SummaryCard
          title="Void Count"
          value={loading ? "..." : report?.summary.voidCount ?? 0}
        />
        <SummaryCard
          title="Discount Count"
          value={loading ? "..." : report?.summary.discountCount ?? 0}
        />
        <SummaryCard
          title="Discounted Amount"
          value={loading ? "..." : formatPeso(report?.summary.discountedAmount ?? "0")}
        />
      </section>

      <WidgetCard title="Stored Exception Events">
        <div className="overflow-x-auto">
          <div className="min-w-[106rem] overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1fr_0.8fr_1fr_0.8fr_1fr_0.8fr_1fr_1fr_1fr_0.9fr_1fr] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Occurred At</span>
              <span>Type</span>
              <span>Order</span>
              <span>Status</span>
              <span>Reason / Discount</span>
              <span>Amount</span>
              <span>Responsible User</span>
              <span>Requested By</span>
              <span>Approved By</span>
              <span>Reference</span>
              <span>Note</span>
            </div>

            <div className="max-h-[32rem] overflow-y-auto">
              {loading ? (
                <div className="px-4 py-6 text-sm text-slate-500">
                  Loading audit and exception events...
                </div>
              ) : rows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-500">
                  No stored reversal or discount exceptions matched the current filters.
                </div>
              ) : (
                rows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[1fr_0.8fr_1fr_0.8fr_1fr_0.8fr_1fr_1fr_1fr_0.9fr_1fr] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                  >
                    <div>{formatDateTime(row.occurredAt)}</div>
                    <div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${exceptionTone(row.kind)}`}
                      >
                        {getExceptionLabel(row.kind)}
                      </span>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{row.orderId}</div>
                    </div>
                    <div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(row.orderStatus)}`}
                      >
                        {row.orderStatus}
                      </span>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">
                        {getReasonLabel(row)}
                      </div>
                      {row.kind === "DISCOUNT" && row.discountDetails ? (
                        <div className="mt-1 text-xs text-slate-500">
                          Rate: {row.discountDetails.discountRate} | Discount:{" "}
                          {formatPeso(row.discountDetails.discountAmount)}
                        </div>
                      ) : null}
                    </div>
                    <div className="font-semibold text-slate-900">
                      {formatPeso(row.amount)}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">
                        {row.responsibleUser.firstName} {row.responsibleUser.lastName}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.responsibleUser.email}
                      </div>
                    </div>
                    <div className="text-xs text-slate-600">{getRequestedByLabel(row)}</div>
                    <div className="text-xs text-slate-600">
                      {row.approvalContext.approvedByEmail ?? "N/A"}
                    </div>
                    <div className="text-xs text-slate-600">
                      {row.paymentReference ?? "N/A"}
                    </div>
                    <div className="text-xs text-slate-600">{row.note ?? "N/A"}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            {report
              ? `Showing page ${report.pagination.page} of ${report.pagination.totalPages || 1} | ${report.pagination.total} matching exception${report.pagination.total === 1 ? "" : "s"}`
              : "Pagination will appear once exception rows load."}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!hasPreviousPage || loading}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!hasNextPage || loading}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>
      </WidgetCard>
    </div>
  );
}
