"use client";

import { useEffect, useState } from "react";
import SummaryCard from "@/components/dashboard/SummaryCard";
import WidgetCard from "@/components/dashboard/WidgetCard";
import {
  exportPosStaffPerformanceCsv,
  exportPosStaffPerformancePdf,
} from "@/lib/report-exports";
import {
  fetchPosStaffPerformance,
  type PosStaffPerformanceReport,
} from "@/lib/reports";
import { formatPeso } from "@/lib/pos-utils";

type Props = {
  active: boolean;
  from: string;
  to: string;
  fromIso: string;
  toIso: string;
  refreshToken: number;
};

export default function PosStaffPerformanceSection({
  active,
  from,
  to,
  fromIso,
  toIso,
  refreshToken,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PosStaffPerformanceReport | null>(null);
  const [exportingFormat, setExportingFormat] = useState<"csv" | "pdf" | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;

    const loadReport = async () => {
      setLoading(true);
      try {
        const nextReport = await fetchPosStaffPerformance({
          from: fromIso,
          to: toIso,
        });

        if (!cancelled) {
          setReport(nextReport);
          setError(null);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Failed to load staff performance",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadReport();

    return () => {
      cancelled = true;
    };
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
        const filename = exportPosStaffPerformanceCsv(snapshot);
        setExportNotice(`CSV export downloaded as ${filename}.`);
      } else {
        const filename = exportPosStaffPerformancePdf(snapshot);
        setExportNotice(
          `Printable staff performance report opened as ${filename}. Use your browser's Save as PDF option to finish the export.`,
        );
      }
    } catch (nextError) {
      setExportError(
        nextError instanceof Error ? nextError.message : "Failed to export staff performance",
      );
    } finally {
      setExportingFormat(null);
    }
  };

  const topByNetSales = report?.comparison.topByNetSales;
  const topByTransactions = report?.comparison.topByTransactions;
  const topByRefundsHandled = report?.comparison.topByRefundsHandled;

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
            <h3 className="text-xl font-semibold text-neutral-900">Staff Performance</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Compare completed-order sales by cashier alongside refund and void handling captured
              from reversal actors. Sales attribution and reversal handling remain separate metrics.
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
          title="Staff Count"
          value={loading ? "..." : report?.summary.staffCount ?? 0}
        />
        <SummaryCard
          title="Net Sales"
          value={loading ? "..." : formatPeso(report?.summary.totalNetSales ?? "0")}
        />
        <SummaryCard
          title="Transactions"
          value={loading ? "..." : report?.summary.totalTransactions ?? 0}
        />
        <SummaryCard
          title="Discounts"
          value={loading ? "..." : formatPeso(report?.summary.totalDiscounts ?? "0")}
        />
        <SummaryCard
          title="Refunds Handled"
          value={loading ? "..." : report?.summary.totalRefundsHandled ?? 0}
        />
        <SummaryCard
          title="Voids Handled"
          value={loading ? "..." : report?.summary.totalVoidsHandled ?? 0}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <WidgetCard title="Top by Net Sales">
          {loading ? (
            <p className="text-sm text-slate-500">Loading comparison...</p>
          ) : topByNetSales ? (
            <div className="space-y-2">
              <div className="text-lg font-semibold text-slate-900">
                {topByNetSales.staff.firstName} {topByNetSales.staff.lastName}
              </div>
              <div className="text-sm text-slate-500">{topByNetSales.staff.email}</div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Net Sales
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {formatPeso(topByNetSales.netSales)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No staff sales matched the current period.</p>
          )}
        </WidgetCard>

        <WidgetCard title="Top by Transactions">
          {loading ? (
            <p className="text-sm text-slate-500">Loading comparison...</p>
          ) : topByTransactions ? (
            <div className="space-y-2">
              <div className="text-lg font-semibold text-slate-900">
                {topByTransactions.staff.firstName} {topByTransactions.staff.lastName}
              </div>
              <div className="text-sm text-slate-500">{topByTransactions.staff.email}</div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Transactions
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {topByTransactions.transactionCount}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No staff transactions matched the current period.</p>
          )}
        </WidgetCard>

        <WidgetCard title="Top by Refunds Handled">
          {loading ? (
            <p className="text-sm text-slate-500">Loading comparison...</p>
          ) : topByRefundsHandled ? (
            <div className="space-y-2">
              <div className="text-lg font-semibold text-slate-900">
                {topByRefundsHandled.staff.firstName} {topByRefundsHandled.staff.lastName}
              </div>
              <div className="text-sm text-slate-500">{topByRefundsHandled.staff.email}</div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Refunds Handled
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {topByRefundsHandled.refundCount}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No refund actors matched the current period.
            </p>
          )}
        </WidgetCard>
      </section>

      <WidgetCard title="Staff Comparison Table">
        <div className="overflow-x-auto">
          <div className="min-w-[90rem] overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr_0.8fr_1fr_0.8fr_1fr_0.8fr_1fr] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Staff</span>
              <span>Gross Sales</span>
              <span>Net Sales</span>
              <span>Transactions</span>
              <span>Average Order</span>
              <span>Discounts</span>
              <span>Refunds</span>
              <span>Refunded Amount</span>
              <span>Voids</span>
              <span>Voided Amount</span>
            </div>
            <div className="max-h-[34rem] overflow-y-auto">
              {loading ? (
                <div className="px-4 py-6 text-sm text-slate-500">
                  Loading staff comparison...
                </div>
              ) : (report?.staff ?? []).length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-500">
                  No staff activity matched the current date range.
                </div>
              ) : (
                report?.staff.map((row) => (
                  <div
                    key={row.staff.id}
                    className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr_0.8fr_1fr_0.8fr_1fr_0.8fr_1fr] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {row.staff.firstName} {row.staff.lastName}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{row.staff.email}</div>
                    </div>
                    <div>{formatPeso(row.grossSales)}</div>
                    <div className="font-semibold text-slate-900">
                      {formatPeso(row.netSales)}
                    </div>
                    <div>{row.transactionCount}</div>
                    <div>{formatPeso(row.averageOrderValue)}</div>
                    <div>{formatPeso(row.discounts)}</div>
                    <div>{row.refundCount}</div>
                    <div>{formatPeso(row.refundedAmount)}</div>
                    <div>{row.voidCount}</div>
                    <div>{formatPeso(row.voidedAmount)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </WidgetCard>
    </div>
  );
}
