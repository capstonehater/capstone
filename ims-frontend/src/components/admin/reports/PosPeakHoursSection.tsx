"use client";
import { PermissionAction } from "@/components/auth/PermissionGuard";
import ActionAlert from "@/components/feedback/ActionAlert";

import ReportColumns from "./ReportColumns";
import AdminSelect from "@/components/admin/AdminSelect";

import PosReportEmpty from "./PosReportEmpty";

import { useEffect, useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import SummaryCard from "./PosReportMetric";
import WidgetCard from "@/components/dashboard/WidgetCard";
import {
  exportPosPeakHoursExcel,
  exportPosPeakHoursPdf,
} from "@/lib/report-exports";
import {
  fetchPosPeakHours,
  type PosPeakDayType,
  type PosPeakHoursReport,
} from "@/lib/reports";
import { formatPeso } from "@/lib/pos-utils";
import ReportLineChart from "./ReportLineChart";
import styles from "./PosReports.module.css";

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
  const [exportingFormat, setExportingFormat] = useState<"excel" | "pdf" | null>(null);
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

  const handleExport = async (format: "excel" | "pdf") => {
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

      if (format === "excel") {
        const filename = await exportPosPeakHoursExcel(snapshot);
        setExportNotice(`Excel export downloaded as ${filename}.`);
      } else {
        const filename = await exportPosPeakHoursPdf(snapshot);
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

  const hourlyRows = (report?.hourly ?? []).filter((row) => row.hour >= 13 && row.hour <= 20);
  const busiestHours = hourlyRows.filter((row) => row.transactionCount > 0)
    .sort((a, b) => b.transactionCount - a.transactionCount || Number(b.netSales) - Number(a.netSales) || a.hour - b.hour).slice(0, 3);
  const slowestHours = [...hourlyRows]
    .sort((a, b) => Number(a.netSales) - Number(b.netSales) || a.transactionCount - b.transactionCount || a.hour - b.hour).slice(0, 3);

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {exportError ? <ActionAlert placement="header" tone="error" title="Export failed" message={exportError} onDismiss={() => setExportError(null)} /> : null}

      {exportNotice ? <ActionAlert placement="header" tone="success" title="Export ready" message={exportNotice} onDismiss={() => setExportNotice(null)} /> : null}

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className={styles.peakHeader}>
          <div className={styles.peakIntro}>
            <h3 className="text-xl font-semibold text-neutral-900">Peak Hours</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Hourly POS sales and transaction density using completed-order timestamps grouped by
              Asia/Manila local hour. Weekday and weekend splits are derived from timestamps alone.
            </p>
            <p className="mt-2 text-sm text-neutral-600">
              Café operating hours: {report?.operatingHours?.label ?? "1:00 PM–9:00 PM"} (Asia/Manila).
            </p>
          </div>
          <div className={styles.peakControls}>
            <AdminSelect
              label="Day Type"
              value={dayType}
              onChange={(value) => setDayType(value as PosPeakDayType)}
              options={DAY_TYPE_OPTIONS}
            />
            <div className={styles.peakViewControls} role="group" aria-label="Peak hours view">
              {(["table", "line"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={view === option}
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
            <PermissionAction permissions={["reports.view", "reports.export.excel"]}><button
              type="button"
              disabled={loading || exportingFormat !== null}
              onClick={() => void handleExport("excel")}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileSpreadsheet size={18} aria-hidden="true" />
              <span>{exportingFormat === "excel" ? "Exporting..." : "Export Excel"}</span>
            </button></PermissionAction>
            <PermissionAction permissions={["reports.view", "reports.export.pdf"]}><button
              type="button"
              disabled={loading || exportingFormat !== null}
              onClick={() => void handleExport("pdf")}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileText size={18} aria-hidden="true" />
              <span>{exportingFormat === "pdf" ? "Preparing..." : "Export PDF"}</span>
            </button></PermissionAction>
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
          value={loading ? "..." : busiestHours[0]?.label ?? "N/A"}
        />
        <SummaryCard
          title="Slowest Hour"
          value={loading ? "..." : slowestHours[0]?.label ?? "N/A"}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-6">
          <WidgetCard title="Busiest Hours">
            <div className="space-y-3">
              {(loading ? [] : busiestHours).map((row) => (
                <div
                  key={`busiest-${row.hour}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-semibold text-slate-900">{row.label}</div>
                    <div className="text-sm font-semibold text-slate-700">
                      {row.transactionCount} {row.transactionCount === 1 ? "transaction" : "transactions"}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Net sales {formatPeso(row.netSales)}
                  </div>
                </div>
              ))}
              {!loading && (busiestHours).length === 0 ? (
                <p className="text-sm text-slate-500">No hourly transactions matched the filter.</p>
              ) : null}
            </div>
          </WidgetCard>

          <WidgetCard title="Slowest Hours">
            <div className="space-y-3">
              {(loading ? [] : slowestHours).map((row) => (
                <div
                  key={`slowest-${row.hour}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-semibold text-slate-900">{row.label}</div>
                    <div className="text-sm font-semibold text-slate-700">
                      {row.transactionCount} {row.transactionCount === 1 ? "transaction" : "transactions"}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Net sales {formatPeso(row.netSales)}
                  </div>
                </div>
              ))}
              {!loading && (slowestHours).length === 0 ? (
                <p className="text-sm text-slate-500">No hourly transactions matched the filter.</p>
              ) : null}
            </div>
          </WidgetCard>
        </div>

        <WidgetCard title={view === "table" ? "Hourly Sales Table" : "Hourly Net Sales Line Graph"}>
          {view === "line" ? (
            <ReportLineChart
              points={hourlyRows.map((row) => ({
                key: String(row.hour),
                label: row.label,
                value: Number(row.netSales),
                detail: `${row.transactionCount} ${row.transactionCount === 1 ? "transaction" : "transactions"}`,
              }))}
              valueFormatter={(value) => formatPeso(value.toFixed(2))}
              emptyLabel="No hourly data matched the selected range."
            />
          ) : (
            <div className="overflow-x-auto">
              <ReportColumns columns={["Hour","Transactions","Gross Sales","Net Sales","Average Ticket"]} gridTemplate="0.9fr_0.8fr_1fr_1fr_1fr"><div className="min-w-[58rem] overflow-hidden rounded-2xl border border-slate-200">
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
                  ) : hourlyRows.length === 0 ? (
                    <PosReportEmpty message="No hourly data matched the selected range." />
                  ) : (
                    hourlyRows.map((row) => (
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
              </div></ReportColumns>
            </div>
          )}
        </WidgetCard>
      </section>
    </div>
  );
}
