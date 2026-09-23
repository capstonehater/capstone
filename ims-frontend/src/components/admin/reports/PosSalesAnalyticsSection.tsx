"use client";

import PosReportEmpty from "./PosReportEmpty";

import { useEffect, useMemo, useState } from "react";
import SummaryCard from "./PosReportMetric";
import WidgetCard from "@/components/dashboard/WidgetCard";
import {
  exportPosSalesAnalyticsCsv,
  exportPosSalesAnalyticsPdf,
} from "@/lib/report-exports";
import {
  getPresetDateRange,
  getPresetLabel,
  toManilaRangeIso,
  type QuickDatePreset,
} from "@/lib/report-date-range";
import {
  fetchPosSalesAnalytics,
  type PosSalesAnalyticsGroupBy,
  type PosSalesAnalyticsReport,
} from "@/lib/reports";
import type { PaymentMethod } from "@/lib/pos";
import { formatPeso } from "@/lib/pos-utils";
import {
  POS_PAYMENT_METHOD_OPTIONS,
  formatGrowthRate,
  growthTone,
} from "./pos-report-shared";
import ReportLineChart from "./ReportLineChart";

type Props = {
  active: boolean;
  from: string;
  to: string;
  fromIso: string;
  toIso: string;
  refreshToken: number;
};

type SalesAnalyticsPreset = Extract<
  QuickDatePreset,
  "today" | "yesterday" | "this-week" | "monthly"
>;

const PRESET_OPTIONS: SalesAnalyticsPreset[] = [
  "today",
  "yesterday",
  "this-week",
  "monthly",
];

const GROUP_OPTIONS: Array<{
  value: PosSalesAnalyticsGroupBy;
  label: string;
}> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export default function PosSalesAnalyticsSection({
  active,
  refreshToken,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PosSalesAnalyticsReport | null>(null);
  const [preset, setPreset] = useState<SalesAnalyticsPreset>("today");
  const [groupBy, setGroupBy] = useState<PosSalesAnalyticsGroupBy>("daily");
  const [view, setView] = useState<"table" | "line">("table");
  const [staffSearch, setStaffSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [exportingFormat, setExportingFormat] = useState<"csv" | "pdf" | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const range = useMemo(() => getPresetDateRange(preset), [preset]);
  const rangeIso = useMemo(() => toManilaRangeIso(range), [range]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const nextReport = await fetchPosSalesAnalytics({
        from: rangeIso.from,
        to: rangeIso.to,
        groupBy,
        staffSearch: staffSearch.trim() || undefined,
        paymentMethod: paymentMethod || undefined,
      });
      setReport(nextReport);
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to load sales analytics",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!active) {
      return;
    }

    void loadAnalytics();
  }, [active, rangeIso.from, rangeIso.to, groupBy, staffSearch, paymentMethod, refreshToken]);

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
          from: range.from,
          to: range.to,
          preset,
          groupBy,
          staffSearch: staffSearch.trim() || undefined,
          paymentMethod: paymentMethod || undefined,
        },
        report,
      };

      if (format === "csv") {
        const filename = exportPosSalesAnalyticsCsv(snapshot);
        setExportNotice(`CSV export downloaded as ${filename}.`);
      } else {
        const filename = exportPosSalesAnalyticsPdf(snapshot);
        setExportNotice(
          `Printable sales analytics opened as ${filename}. Use your browser's Save as PDF option to finish the export.`,
        );
      }
    } catch (nextError) {
      setExportError(
        nextError instanceof Error ? nextError.message : "Failed to export sales analytics",
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
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-xl font-semibold text-neutral-900">Sales Analytics</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Explore grouped sales, discounts, refunds, and changes from the previous period.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Sales Analytics range:{" "}
            <span className="font-semibold text-slate-900">{getPresetLabel(preset)}</span> |{" "}
            {range.from} to {range.to} | Asia/Manila business-day boundaries.
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESET_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPreset(option)}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  preset === option
                    ? "bg-[#f45a1f] text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {getPresetLabel(option)}
              </button>
            ))}
          </div>

        </div>
      </section>
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1 block">Grouping</span>
              <select
                value={groupBy}
                onChange={(event) =>
                  setGroupBy(event.target.value as PosSalesAnalyticsGroupBy)
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              >
                {GROUP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              {(["table", "line"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setView(option)}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    view === option
                      ? "bg-[#f45a1f] text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {option === "table" ? "Table View" : "Line Graph"}
                </button>
              ))}
            </div>
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1 block">Cashier / Staff</span>
              <input
                value={staffSearch}
                onChange={(event) => setStaffSearch(event.target.value)}
                placeholder="Filter by name or email"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              />
            </label>
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1 block">Payment Method</span>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod | "")}
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
          title="Gross Sales"
          value={loading ? "..." : formatPeso(report?.summary.grossSales ?? "0")}
        />
        <SummaryCard
          title="Net Sales"
          value={loading ? "..." : formatPeso(report?.summary.netSales ?? "0")}
        />
        <SummaryCard
          title="Discounts"
          value={loading ? "..." : formatPeso(report?.summary.discounts ?? "0")}
        />
        <SummaryCard
          title="Refunds"
          value={loading ? "..." : formatPeso(report?.summary.refunds ?? "0")}
        />
        <SummaryCard
          title="Transactions"
          value={loading ? "..." : report?.summary.transactionCount ?? 0}
        />
        <SummaryCard
          title="Average Ticket"
          value={loading ? "..." : formatPeso(report?.summary.averageTicketSize ?? "0")}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <WidgetCard title="Comparison to Previous Period">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Net Sales Growth
            </p>
            <p
              className={`mt-2 text-3xl font-bold ${growthTone(
                report?.comparison.previousPeriod.growthRate ?? null,
              )}`}
            >
              {loading
                ? "..."
                : formatGrowthRate(report?.comparison.previousPeriod.growthRate ?? null)}
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Previous period net sales:{" "}
              {formatPeso(report?.comparison.previousPeriod.netSales ?? "0")}
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Previous Gross Sales
              </p>
              <p className="mt-2 text-xl font-bold text-slate-900">
                {loading
                  ? "..."
                  : formatPeso(report?.comparison.previousPeriod.grossSales ?? "0")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Previous Refunds
              </p>
              <p className="mt-2 text-xl font-bold text-slate-900">
                {loading
                  ? "..."
                  : formatPeso(report?.comparison.previousPeriod.refunds ?? "0")}
              </p>
            </div>
          </div>
        </WidgetCard>

        <WidgetCard title={view === "table" ? "Grouped Sales Table" : "Grouped Net Sales Line Graph"}>
          {view === "line" ? (
            <ReportLineChart
              points={(report?.groups ?? []).map((group) => ({
                key: group.bucketKey,
                label: group.label,
                value: Number(group.netSales),
                detail: `${group.transactionCount} tx`,
              }))}
              valueFormatter={(value) => formatPeso(value.toFixed(2))}
              emptyLabel="No grouped sales data matches the current filters."
            />
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[72rem] overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-[1.3fr_repeat(6,minmax(0,1fr))] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>Period</span>
                  <span>Gross Sales</span>
                  <span>Net Sales</span>
                  <span>Discounts</span>
                  <span>Refunds</span>
                  <span>Transactions</span>
                  <span>Average Ticket</span>
                </div>
                <div className="max-h-[32rem] overflow-y-auto">
                  {loading ? (
                    <div className="px-4 py-6 text-sm text-slate-500">
                      Loading sales analytics...
                    </div>
                  ) : (report?.groups ?? []).length === 0 ? (
                    <PosReportEmpty message="No grouped sales data matches the current filters." />
                  ) : (
                    report?.groups.map((group) => (
                      <div
                        key={group.bucketKey}
                        className="grid grid-cols-[1.3fr_repeat(6,minmax(0,1fr))] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                      >
                        <div className="font-semibold text-slate-900">{group.label}</div>
                        <div>{formatPeso(group.grossSales)}</div>
                        <div className="font-semibold text-slate-900">
                          {formatPeso(group.netSales)}
                        </div>
                        <div>{formatPeso(group.discounts)}</div>
                        <div>{formatPeso(group.refunds)}</div>
                        <div>{group.transactionCount}</div>
                        <div>{formatPeso(group.averageTicketSize)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </WidgetCard>
      </section>
    </div>
  );
}
