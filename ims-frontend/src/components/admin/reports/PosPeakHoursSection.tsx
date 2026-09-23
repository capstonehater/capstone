"use client";

import PosReportEmpty from "./PosReportEmpty";

import { useEffect, useState } from "react";
import SummaryCard from "./PosReportMetric";
import WidgetCard from "@/components/dashboard/WidgetCard";
import {
  exportPosPeakHoursCsv,
  exportPosPeakHoursPdf,
} from "@/lib/report-exports";
import {
  fetchPosPeakHours,
  type PosPeakDayType,
  type PosPeakHoursReport,
} from "@/lib/reports";
import { formatPeso } from "@/lib/pos-utils";
import ReportLineChart from "./ReportLineChart";

type Props = {
  active: boolean;
  from: string;
  to: string;
  fromIso: string;
  toIso: string;
  refreshToken: number;
};

const DAY_TYPE_OPTIONS: Array<{
  value: PosPeakDayType;
  label: string;
}> = [
  { value: "all", label: "All Days" },
  { value: "weekday", label: "Weekdays" },
  { value: "weekend", label: "Weekends" },
];

export default function PosPeakHoursSection({
  active,
  from,
  to,
  fromIso,
  toIso,
  refreshToken,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PosPeakHoursReport | null>(null);
  const [dayType, setDayType] = useState<PosPeakDayType>("all");
  const [view, setView] = useState<"table" | "line">("table");
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
        const nextReport = await fetchPosPeakHours({
          from: fromIso,
          to: toIso,
          dayType,
        });

        if (!cancelled) {
          setReport(nextReport);
          setError(null);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error ? nextError.message : "Failed to load peak hours",
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
  }, [active, fromIso, toIso, dayType, refreshToken]);

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
          dayType,
        },
        report,
      };

      if (format === "csv") {
        const filename = exportPosPeakHoursCsv(snapshot);
        setExportNotice(`CSV export downloaded as ${filename}.`);
      } else {
        const filename = exportPosPeakHoursPdf(snapshot);
        setExportNotice(
          `Printable peak-hours report opened as ${filename}. Use your browser's Save as PDF option to finish the export.`,
        );
      }
    } catch (nextError) {
      setExportError(
        nextError instanceof Error ? nextError.message : "Failed to export peak hours",
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
            <h3 className="text-xl font-semibold text-neutral-900">Peak Hours</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Hourly POS sales and transaction density using completed-order timestamps grouped by
              Asia/Manila local hour. Weekday and weekend splits are derived from timestamps alone.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_repeat(2,minmax(0,0.8fr))]">
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1 block">Day Type</span>
              <select
                value={dayType}
                onChange={(event) => setDayType(event.target.value as PosPeakDayType)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              >
                {DAY_TYPE_OPTIONS.map((option) => (
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

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Transactions"
          value={loading ? "..." : report?.summary.totalTransactions ?? 0}
        />
        <SummaryCard
          title="Total Net Sales"
          value={loading ? "..." : formatPeso(report?.summary.totalNetSales ?? "0")}
        />
        <SummaryCard
          title="Busiest Hour"
          value={loading ? "..." : report?.summary.busiestHour?.label ?? "N/A"}
        />
        <SummaryCard
          title="Slowest Hour"
          value={loading ? "..." : report?.summary.slowestHour?.label ?? "N/A"}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-6">
          <WidgetCard title="Busiest Hours">
            <div className="space-y-3">
              {(loading ? [] : report?.busiestHours ?? []).map((row) => (
                <div
                  key={`busiest-${row.hour}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-semibold text-slate-900">{row.label}</div>
                    <div className="text-sm font-semibold text-slate-700">
                      {row.transactionCount} tx
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Net sales {formatPeso(row.netSales)}
                  </div>
                </div>
              ))}
              {!loading && (report?.busiestHours ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No hourly transactions matched the filter.</p>
              ) : null}
            </div>
          </WidgetCard>

          <WidgetCard title="Slowest Hours">
            <div className="space-y-3">
              {(loading ? [] : report?.slowestHours ?? []).map((row) => (
                <div
                  key={`slowest-${row.hour}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-semibold text-slate-900">{row.label}</div>
                    <div className="text-sm font-semibold text-slate-700">
                      {row.transactionCount} tx
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Net sales {formatPeso(row.netSales)}
                  </div>
                </div>
              ))}
              {!loading && (report?.slowestHours ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No hourly transactions matched the filter.</p>
              ) : null}
            </div>
          </WidgetCard>
        </div>

        <WidgetCard title={view === "table" ? "Hourly Sales Table" : "Hourly Net Sales Line Graph"}>
          {view === "line" ? (
            <ReportLineChart
              points={(report?.hourly ?? []).filter((row) => row.hour >= 13 && row.hour <= 22).map((row) => ({
                key: String(row.hour),
                label: row.label,
                value: Number(row.netSales),
                detail: `${row.transactionCount} tx`,
              }))}
              valueFormatter={(value) => formatPeso(value.toFixed(2))}
              emptyLabel="No hourly data matched the selected range."
            />
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[58rem] overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-[0.9fr_0.8fr_1fr_1fr_1fr] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>Hour</span>
                  <span>Transactions</span>
                  <span>Gross Sales</span>
                  <span>Net Sales</span>
                  <span>Average Ticket</span>
                </div>
                <div className="max-h-[36rem] overflow-y-auto">
                  {loading ? (
                    <div className="px-4 py-6 text-sm text-slate-500">
                      Loading hourly aggregation...
                    </div>
                  ) : (report?.hourly ?? []).length === 0 ? (
                    <PosReportEmpty message="No hourly data matched the selected range." />
                  ) : (
                    report?.hourly.map((row) => (
                      <div
                        key={row.hour}
                        className="grid grid-cols-[0.9fr_0.8fr_1fr_1fr_1fr] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                      >
                        <div className="font-semibold text-slate-900">{row.label}</div>
                        <div>{row.transactionCount}</div>
                        <div>{formatPeso(row.grossSales)}</div>
                        <div>{formatPeso(row.netSales)}</div>
                        <div>{formatPeso(row.averageTicketSize)}</div>
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
