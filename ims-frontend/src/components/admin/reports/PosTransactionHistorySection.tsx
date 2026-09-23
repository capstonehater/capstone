"use client";

import PosReportEmpty from "./PosReportEmpty";

import { useEffect, useState } from "react";
import WidgetCard from "@/components/dashboard/WidgetCard";
import {
  exportPosTransactionHistoryCsv,
  exportPosTransactionHistoryPdf,
} from "@/lib/report-exports";
import {
  fetchPosOrderDetail,
  fetchPosTransactionHistory,
  type PosTransactionHistoryReport,
} from "@/lib/reports";
import type { OrderStatus, PaymentMethod } from "@/lib/pos";
import { formatDateTime, formatPeso } from "@/lib/pos-utils";
import PosTransactionDetailModal from "./PosTransactionDetailModal";
import {
  POS_PAYMENT_METHOD_OPTIONS,
  POS_STATUS_OPTIONS,
  statusTone,
} from "./pos-report-shared";

type Props = {
  active: boolean;
  from: string;
  to: string;
  fromIso: string;
  toIso: string;
  refreshToken: number;
};

const PAGE_SIZE = 10;

function describeOrderItems(
  order: PosTransactionHistoryReport["orders"][number],
) {
  return order.items
    .map(
      (item) =>
        `${item.quantity}x ${item.productNameSnapshot} (${item.variantNameSnapshot})`,
    )
    .join(", ");
}

export default function PosTransactionHistorySection({
  active,
  from,
  to,
  fromIso,
  toIso,
  refreshToken,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PosTransactionHistoryReport | null>(null);
  const [search, setSearch] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [page, setPage] = useState(1);
  const [exportingFormat, setExportingFormat] = useState<"csv" | "pdf" | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] =
    useState<PosTransactionHistoryReport["orders"][number] | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const nextHistory = await fetchPosTransactionHistory({
        from: fromIso,
        to: toIso,
        page,
        pageSize: PAGE_SIZE,
        search: search.trim() || undefined,
        staffSearch: staffSearch.trim() || undefined,
        paymentMethod: paymentMethod || undefined,
        status: status || undefined,
      });
      setReport(nextHistory);
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to load transaction history",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!active) {
      return;
    }

    void loadHistory();
  }, [
    active,
    fromIso,
    toIso,
    page,
    search,
    staffSearch,
    paymentMethod,
    status,
    refreshToken,
  ]);

  useEffect(() => {
    setPage(1);
  }, [fromIso, toIso]);

  if (!active) {
    return null;
  }

  const historyOrders = report?.orders ?? [];
  const totalPages = report?.pagination.totalPages ?? 0;
  const hasPreviousPage = page > 1;
  const hasNextPage = totalPages > 0 && page < totalPages;

  const handleViewOrder = async (orderId: string) => {
    setSelectedOrder(null);
    setDetailLoading(true);
    try {
      const nextOrder = await fetchPosOrderDetail(orderId);
      setSelectedOrder(nextOrder);
    } finally {
      setDetailLoading(false);
    }
  };

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
          search: search.trim() || undefined,
          staffSearch: staffSearch.trim() || undefined,
          paymentMethod: paymentMethod || undefined,
          status: status || undefined,
          page,
          pageSize: report.pagination.pageSize,
        },
        report,
      };

      if (format === "csv") {
        const filename = exportPosTransactionHistoryCsv(snapshot);
        setExportNotice(`CSV export downloaded as ${filename}.`);
      } else {
        const filename = exportPosTransactionHistoryPdf(snapshot);
        setExportNotice(
          `Printable transaction history opened as ${filename}. Use your browser's Save as PDF option to finish the export.`,
        );
      }
    } catch (nextError) {
      setExportError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to export the current transaction history view",
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
            <h3 className="text-xl font-semibold text-neutral-900">Transaction History</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Search transactions by order reference, payment method, status, or staff. Open an order to view its receipt and full amount breakdown.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1 block">Order Number / UUID</span>
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search ORD-xxxxxxx or raw order ID"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              />
            </label>
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1 block">Cashier / Staff</span>
              <input
                value={staffSearch}
                onChange={(event) => {
                  setStaffSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search by name or email"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              />
            </label>
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1 block">Payment Method</span>
              <select
                value={paymentMethod}
                onChange={(event) => {
                  setPaymentMethod(event.target.value as PaymentMethod | "");
                  setPage(1);
                }}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              >
                <option value="">All methods</option>
                {POS_PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1 block">Status</span>
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
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
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
        </div>
      </section>

      <WidgetCard title="Transactions">
        <div className="overflow-x-auto">
          <div className="min-w-[58rem] overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1.1fr_1fr_1fr_1.6fr_0.8fr_0.9fr_0.8fr_70px] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Order</span>
              <span>Date & Time</span>
              <span>Staff</span>
              <span>Items & Qty</span>
              <span>Total</span>
              <span>Payment</span>
              <span>Status</span>
              <span className="text-right">Action</span>
            </div>

            <div className="max-h-[32rem] overflow-y-auto">
              {loading ? (
                <div className="px-4 py-6 text-sm text-slate-500">
                  Loading transaction history...
                </div>
              ) : historyOrders.length === 0 ? (
                <PosReportEmpty message="No transactions match the current POS history filters." />
              ) : (
                historyOrders.map((order) => (
                <div
                  key={order.id}
                  className="grid grid-cols-[1.1fr_1fr_1fr_1.6fr_0.8fr_0.9fr_0.8fr_70px] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {order.displayOrderNumber}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">{order.id}</div>
                    </div>
                    <div>{formatDateTime(order.completedAt)}</div>
                    <div>
                      {order.createdBy.firstName} {order.createdBy.lastName}
                    </div>
                    <div className="text-xs text-slate-600">{describeOrderItems(order)}</div>
                    <div className="font-semibold text-slate-900">
                      {formatPeso(order.totalAmount)}
                    </div>
                    <div className="text-xs text-slate-600">
                      {order.payments.map((payment) => payment.method).join(" + ")}
                    </div>
                    <div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(order.status)}`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => void handleViewOrder(order.id)}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            {report
              ? `Showing page ${report.pagination.page} of ${report.pagination.totalPages || 1} | ${report.pagination.total} matching transaction${report.pagination.total === 1 ? "" : "s"}`
              : "Pagination will appear once transactions load."}
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

      <PosTransactionDetailModal
        order={selectedOrder}
        loading={detailLoading}
        onClose={() => {
          setSelectedOrder(null);
        }}
      />
    </div>
  );
}
