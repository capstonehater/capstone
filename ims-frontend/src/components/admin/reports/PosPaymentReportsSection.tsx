"use client";

import PosReportEmpty from "./PosReportEmpty";

import { useEffect, useState } from "react";
import SummaryCard from "./PosReportMetric";
import WidgetCard from "@/components/dashboard/WidgetCard";
import {
  exportPosPaymentReportsCsv,
  exportPosPaymentReportsPdf,
} from "@/lib/report-exports";
import {
  fetchPosPaymentReports,
  type PosPaymentReportsReport,
} from "@/lib/reports";
import { formatDateTime, formatPeso } from "@/lib/pos-utils";

type Props = {
  active: boolean;
  from: string;
  to: string;
  fromIso: string;
  toIso: string;
  refreshToken: number;
};

export default function PosPaymentReportsSection({
  active,
  from,
  to,
  fromIso,
  toIso,
  refreshToken,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PosPaymentReportsReport | null>(null);
  const [exportingFormat, setExportingFormat] = useState<"csv" | "pdf" | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const loadReports = async () => {
    setLoading(true);
    try {
      const nextReport = await fetchPosPaymentReports({
        from: fromIso,
        to: toIso,
        limit: 10,
      });
      setReport(nextReport);
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to load payment reports",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!active) {
      return;
    }

    void loadReports();
  }, [active, fromIso, toIso, refreshToken]);

  if (!active) {
    return null;
  }

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
        },
        report,
      };

      if (format === "csv") {
        const filename = exportPosPaymentReportsCsv(snapshot);
        setExportNotice(`CSV export downloaded as ${filename}.`);
      } else {
        const filename = exportPosPaymentReportsPdf(snapshot);
        setExportNotice(
          `Printable payment report opened as ${filename}. Use your browser's Save as PDF option to finish the export.`,
        );
      }
    } catch (nextError) {
      setExportError(
        nextError instanceof Error ? nextError.message : "Failed to export payment reports",
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-neutral-900">Payment Reports</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Payment breakdowns for completed POS transactions, including e-wallet totals and
              split-payment activity where supported by the current schema.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
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
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          title="Total Collected"
          value={loading ? "..." : formatPeso(report?.summary.totalCollected ?? "0")}
        />
        <SummaryCard
          title="Cash"
          value={loading ? "..." : formatPeso(report?.summary.cashTotal ?? "0")}
        />
        <SummaryCard
          title="Card"
          value={loading ? "..." : formatPeso(report?.summary.cardTotal ?? "0")}
        />
        <SummaryCard
          title="E-Wallet"
          value={loading ? "..." : formatPeso(report?.summary.ewalletTotal ?? "0")}
        />
        <SummaryCard
          title="Split Payments"
          value={loading ? "..." : report?.summary.splitPaymentTransactionCount ?? 0}
        />
        <SummaryCard
          title="Split Payment Total"
          value={loading ? "..." : formatPeso(report?.summary.splitPaymentCollected ?? "0")}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <WidgetCard title="Payment Method Breakdown">
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1fr_1fr_0.8fr_0.8fr_0.8fr] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Method</span>
              <span>Amount</span>
              <span>Orders</span>
              <span>Payments</span>
              <span>Share</span>
            </div>
            <div className="max-h-[26rem] overflow-y-auto">
              {loading ? (
                <div className="px-4 py-6 text-sm text-slate-500">
                  Loading payment breakdown...
                </div>
              ) : (report?.breakdown ?? []).length === 0 ? (
                <PosReportEmpty message="No payment records matched the selected date range." />
              ) : (
                report?.breakdown.map((row) => (
                  <div
                    key={row.method}
                    className="grid grid-cols-[1fr_1fr_0.8fr_0.8fr_0.8fr] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                  >
                    <div className="font-semibold text-slate-900">{row.method}</div>
                    <div>{formatPeso(row.amount)}</div>
                    <div>{row.orderCount}</div>
                    <div>{row.paymentCount}</div>
                    <div>
                      {row.shareOfCollected === null
                        ? "N/A"
                        : `${(row.shareOfCollected * 100).toFixed(1)}%`}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </WidgetCard>

        <WidgetCard title="Recent Split Payment Orders">
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1fr_1fr_1fr_1.1fr] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Order</span>
              <span>Date & Time</span>
              <span>Staff</span>
              <span>Payments</span>
            </div>
            <div className="max-h-[26rem] overflow-y-auto">
              {loading ? (
                <div className="px-4 py-6 text-sm text-slate-500">
                  Loading split payment activity...
                </div>
              ) : (report?.splitPaymentOrders ?? []).length === 0 ? (
                <PosReportEmpty message="No split-payment orders were found for the selected period." />
              ) : (
                report?.splitPaymentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="grid grid-cols-[1fr_1fr_1fr_1.1fr] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{order.id}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatPeso(order.totalAmount)}
                      </div>
                    </div>
                    <div>{formatDateTime(order.completedAt)}</div>
                    <div>
                      {order.createdBy.firstName} {order.createdBy.lastName}
                    </div>
                    <div className="text-xs text-slate-600">
                      {order.payments.map((payment) => `${payment.method} ${formatPeso(payment.amount)}`).join(" + ")}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </WidgetCard>
      </section>
    </div>
  );
}
