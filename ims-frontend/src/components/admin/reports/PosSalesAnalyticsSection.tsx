"use client";
import { PermissionAction } from "@/components/auth/PermissionGuard";
import ActionAlert from "@/components/feedback/ActionAlert";

import { salesChartPoints } from "@/lib/sales-chart-data";
import ReportColumns from "./ReportColumns";
import SearchInput from "@/components/ui/SearchInput";
import ReportSearchField from "./ReportSearchField";
import useReportSearch from "./useReportSearch";
import AdminSelect from "@/components/admin/AdminSelect";
import DateFilter from "@/components/staff-pos/DateFilter";
import { validatePosReportDateChange } from "@/lib/pos-report-date-range";

import PosReportEmpty from "./PosReportEmpty";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, FileText, RefreshCw, Info, TrendingUp, TrendingDown, Minus, Banknote, RotateCcw } from "lucide-react";
import styles from "./PosReports.module.css";
import comparisonStyles from "./SalesComparison.module.css";
import SummaryCard from "./PosReportMetric";
import WidgetCard from "@/components/dashboard/WidgetCard";
import {
  exportPosSalesAnalyticsExcel,
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
  "today" | "yesterday" | "this-week" | "custom"
>;

const PRESET_OPTIONS: SalesAnalyticsPreset[] = [
  "today",
  "yesterday",
  "this-week",
  "custom",
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
  const [customRange, setCustomRange] = useState(() => getPresetDateRange("today"));
  const [dateError, setDateError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<PosSalesAnalyticsGroupBy>("daily");
  const [view, setView] = useState<"table" | "line">("table");
  const [staffSearch, setStaffSearch] = useState("");
  const staffSearchQuery = useReportSearch(staffSearch);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [exportingFormat, setExportingFormat] = useState<"excel" | "pdf" | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const range = useMemo(() => preset === "custom" ? customRange : getPresetDateRange(preset), [preset, customRange]);
  const rangeIso = useMemo(() => toManilaRangeIso(range), [range]);

  const handlePresetChange = (nextPreset: SalesAnalyticsPreset) => {
    if (nextPreset === "custom" && preset !== "custom") setCustomRange(range);
    setDateError(null);
    setPreset(nextPreset);
  };

  const handleDateChange = (field: "from" | "to", value: string) => {
    const error = validatePosReportDateChange("custom", field, value, customRange);
    setDateError(error);
    if (!error) setCustomRange((current) => ({ ...current, [field]: value }));
  };

  const searchRequest = useRef(0);
  const loadAnalytics = async () => {
    const request = ++searchRequest.current;
    setLoading(true);
    try {
      const nextReport = await fetchPosSalesAnalytics({
        from: rangeIso.from,
        to: rangeIso.to,
        groupBy,
        staffSearch: staffSearchQuery || undefined,
        paymentMethod: paymentMethod || undefined,
      });
      if (request !== searchRequest.current) return;
      setReport(nextReport);
      setError(null);
    } catch (nextError) {
      if (request !== searchRequest.current) return;
      setError(
        nextError instanceof Error ? nextError.message : "Failed to load sales analytics",
      );
    } finally {
      if (request === searchRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!active) {
      return;
    }

    void loadAnalytics();
  }, [active, rangeIso.from, rangeIso.to, groupBy, staffSearchQuery, paymentMethod, refreshToken]);

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
          from: range.from,
          to: range.to,
          preset,
          groupBy,
          staffSearch: staffSearchQuery || undefined,
          paymentMethod: paymentMethod || undefined,
        },
        report,
      };

      if (format === "excel") {
        const filename = await exportPosSalesAnalyticsExcel(snapshot);
        setExportNotice(`Excel export downloaded as ${filename}.`);
      } else {
        const filename = await exportPosSalesAnalyticsPdf(snapshot);
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

      {exportError ? <ActionAlert placement="header" tone="error" title="Export failed" message={exportError} onDismiss={() => setExportError(null)} /> : null}

      {exportNotice ? <ActionAlert placement="header" tone="success" title="Export ready" message={exportNotice} onDismiss={() => setExportNotice(null)} /> : null}

      <section className={`${styles.analyticsPanel} rounded-2xl bg-white p-6 shadow-sm`}>
        <div className={styles.analyticsHeader}>
          <div className={styles.analyticsIntro}>
            <h3 className="text-xl font-semibold text-neutral-900">Sales Analytics</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Explore grouped sales, discounts, refunds, and changes from the previous period.
            </p>
          </div>
          <div className={styles.analyticsActions}>
            <div className={styles.presets} role="group" aria-label="Sales analytics period">
              {PRESET_OPTIONS.map(option => (
                <button key={option} type="button" aria-pressed={preset === option} onClick={() => handlePresetChange(option)}>
                  {option === "custom" ? "Custom Date" : getPresetLabel(option)}
                </button>
              ))}
            </div>
            <button type="button" className={styles.analyticsRefresh} disabled={loading} onClick={() => void loadAnalytics()}>
              <RefreshCw size={16} aria-hidden="true" />Refresh Analytics
            </button>
          </div>
        </div>
        {preset === "custom" ? (
          <div className={styles.analyticsDateControls} aria-label="Sales analytics custom date range">
            <DateFilter label="From date" value={customRange.from} max={customRange.to} required onChange={(value) => handleDateChange("from", value)} />
            <DateFilter label="To date" value={customRange.to} min={customRange.from} required onChange={(value) => handleDateChange("to", value)} />
          </div>
        ) : null}
        {dateError ? <ActionAlert tone="error" title="Invalid date range" message={dateError} onDismiss={() => setDateError(null)} /> : null}
        <p className={styles.range}><Info size={14} aria-hidden="true" />Active range: {getPresetLabel(preset)} <span>|</span> {range.from} to {range.to} <span>|</span> Manila time</p>
      </section>
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div>
          <div className={`${styles.peakControls} ${styles.salesControls}`}>
            <AdminSelect
              label="Grouping"
              value={groupBy}
              onChange={(value) =>
                  setGroupBy(value as PosSalesAnalyticsGroupBy)
                }
              options={GROUP_OPTIONS}
            />
            <div className={styles.peakViewControls} role="group" aria-label="Sales analytics view">
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
            <ReportSearchField label="Cashier / Staff">
              <SearchInput
                value={staffSearch}
                onChange={(event) => setStaffSearch(event.target.value)}
                placeholder="Ex. Robert (name of employee)"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              />
            </ReportSearchField>
            <AdminSelect
              label="Payment Method"
              value={paymentMethod}
              onChange={(value) => setPaymentMethod(value as PaymentMethod | "")}
              options={[{ value: "", label: "All methods" }, ...POS_PAYMENT_METHOD_OPTIONS]}
            />
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

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Gross Sales"
          value={loading && !report ? "..." : formatPeso(report?.summary.grossSales ?? "0")}
        />
        <SummaryCard
          title="Net Sales"
          value={loading && !report ? "..." : formatPeso(report?.summary.netSales ?? "0")}
        />
        <SummaryCard
          title="Discounts"
          value={loading && !report ? "..." : formatPeso(report?.summary.discounts ?? "0")}
        />
        <SummaryCard
          title="Sales Refunds (excl. VAT)"
          value={loading && !report ? "..." : formatPeso(report?.summary.refunds ?? "0")}
        />
        <SummaryCard title="VAT (net of reversals)" value={loading && !report ? "..." : formatPeso(report?.summary.taxes ?? "0")} />
        <SummaryCard title="COGS" value={loading && !report ? "..." : formatPeso(report?.summary.cogs ?? "0")} />
        <SummaryCard title="Gross Profit" value={loading && !report ? "..." : formatPeso(report?.summary.grossMargin ?? "0")} />
        <SummaryCard title="Net Collected (incl. VAT)" value={loading && !report ? "..." : formatPeso(report?.summary.collectedAmount ?? "0")} />
        <SummaryCard
          title="Transactions"
          value={loading && !report ? "..." : report?.summary.transactionCount ?? 0}
        />
        <SummaryCard
          title="Average Ticket"
          value={loading && !report ? "..." : formatPeso(report?.summary.averageTicketSize ?? "0")}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <WidgetCard title="Comparison to Previous Period" className={comparisonStyles.card}>
          <p className={comparisonStyles.intro}>Compare net sales with the previous period of the same length.</p>
          <div className={comparisonStyles.hero}>
            <p className={comparisonStyles.label}>Net sales growth</p>
            <div className={`${comparisonStyles.growth} ${growthTone(report?.comparison.previousPeriod.growthRate ?? null)}`}>
              <span className={comparisonStyles.indicator} aria-hidden="true">
                {(report?.comparison.previousPeriod.growthRate ?? 0) > 0 ? <TrendingUp size={20} /> : (report?.comparison.previousPeriod.growthRate ?? 0) < 0 ? <TrendingDown size={20} /> : <Minus size={20} />}
              </span>
              <strong>{loading && !report ? "..." : formatGrowthRate(report?.comparison.previousPeriod.growthRate ?? null)}</strong>
            </div>
            <p className={comparisonStyles.note}>
              {report?.comparison.previousPeriod.growthRate == null ? "Growth is unavailable without previous period net sales." : report.comparison.previousPeriod.growthRate > 0 ? "Net sales increased from the previous period." : report.comparison.previousPeriod.growthRate < 0 ? "Net sales decreased from the previous period." : "Net sales are unchanged from the previous period."}
            </p>
            <dl className={comparisonStyles.sales}>
              <div><dt>Current net sales</dt><dd>{loading && !report ? "..." : formatPeso(report?.summary.netSales ?? "0")}</dd></div>
              <div><dt>Previous net sales</dt><dd>{loading && !report ? "..." : formatPeso(report?.comparison.previousPeriod.netSales ?? "0")}</dd></div>
            </dl>
          </div>
          <dl className={comparisonStyles.details}>
            <div><dt><Banknote size={18} aria-hidden="true" />Previous gross sales</dt><dd>{loading && !report ? "..." : formatPeso(report?.comparison.previousPeriod.grossSales ?? "0")}</dd></div>
            <div><dt><RotateCcw size={18} aria-hidden="true" />Previous refunds</dt><dd>{loading && !report ? "..." : formatPeso(report?.comparison.previousPeriod.refunds ?? "0")}</dd></div>
          </dl>
        </WidgetCard>

        <WidgetCard title={view === "table" ? "Grouped Sales Table" : "Grouped Net Sales Line Graph"}>
          {view === "line" ? (
            <ReportLineChart
              points={salesChartPoints(report)}
              title="Grouped net sales"
              xAxisLabel="Period (Manila time)"
              yAxisLabel="Net sales (PHP)"
              valueFormatter={(value) => formatPeso(value.toFixed(2))}
              emptyLabel="No grouped sales data matches the current filters."
            />
          ) : (
            <div className="overflow-x-auto">
              <ReportColumns columns={["Period","Gross Sales","Net Sales","Discounts","Sales Refunds","VAT","COGS","Gross Profit","Net Collected","Transactions","Average Ticket"]} gridTemplate="1.3fr_repeat(10,minmax(0,1fr))"><div className="min-w-[110rem] overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-[1.3fr_repeat(10,minmax(0,1fr))] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>Period</span>
                  <span>Gross Sales</span>
                  <span>Net Sales</span>
                  <span>Discounts</span>
                  <span>Sales Refunds</span>
                  <span>VAT</span><span>COGS</span><span>Gross Profit</span><span>Net Collected</span>
                  <span>Transactions</span>
                  <span>Average Ticket</span>
                </div>
                <div className="min-h-[24rem] max-h-[32rem] overflow-y-auto" aria-busy={loading}>
                  {loading && !report ? (
                    <div className="px-4 py-6 text-sm text-slate-500">
                      Loading sales analytics...
                    </div>
                  ) : (report?.groups ?? []).length === 0 ? (
                    <PosReportEmpty message="No grouped sales data matches the current filters." />
                  ) : (
                    report?.groups.map((group) => (
                      <div
                        key={group.bucketKey}
                        className="grid grid-cols-[1.3fr_repeat(10,minmax(0,1fr))] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                      >
                        <div className="font-semibold text-slate-900">{group.label}</div>
                        <div>{formatPeso(group.grossSales)}</div>
                        <div className="font-semibold text-slate-900">
                          {formatPeso(group.netSales)}
                        </div>
                        <div>{formatPeso(group.discounts)}</div>
                        <div>{formatPeso(group.refunds)}</div>
                        <div>{formatPeso(group.taxes)}</div><div>{formatPeso(group.cogs)}</div><div>{formatPeso(group.grossMargin)}</div><div>{formatPeso(group.collectedAmount)}</div>
                        <div>{group.transactionCount}</div>
                        <div>{formatPeso(group.averageTicketSize)}</div>
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
