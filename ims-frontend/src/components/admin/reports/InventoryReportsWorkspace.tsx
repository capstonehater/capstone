"use client";

import { useEffect, useMemo, useState } from "react";
import { ChartPie, Trash2, ChartNoAxesColumnIncreasing, Layers, Tag, TriangleAlert, RefreshCw, FileDown } from "lucide-react";
import styles from "./InventoryReports.module.css";
import WidgetCard from "@/components/dashboard/WidgetCard";
import {
  exportInventoryReportsCsv,
  exportInventoryReportsPdf,
  type PosInventoryLinkedExportSnapshot,
} from "@/lib/report-exports";
import {
  getTodayDateInput,
  shiftManilaDateInput,
  toManilaRangeIso,
} from "@/lib/report-date-range";
import {
  fetchInventoryKpiSummary,
  fetchInventoryAvailabilityRisk,
  type InventoryAvailabilityRiskReport,
  type InventoryKpiSummaryReport,
} from "@/lib/reports";
import InventoryAvailabilityRiskSection from "./InventoryAvailabilityRiskSection";
import PosInventoryLinkedSection from "./PosInventoryLinkedSection";

function todayInput() {
  return getTodayDateInput();
}

function defaultFromInput() {
  return shiftManilaDateInput(todayInput(), -30);
}

export default function InventoryReportsWorkspace() {
  const [from, setFrom] = useState(defaultFromInput());
  const [to, setTo] = useState(todayInput());
  const [refreshToken, setRefreshToken] = useState(0);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [kpiReport, setKpiReport] = useState<InventoryKpiSummaryReport | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityReport, setAvailabilityReport] =
    useState<InventoryAvailabilityRiskReport | null>(null);
  const [inventoryLinkedSnapshot, setInventoryLinkedSnapshot] =
    useState<PosInventoryLinkedExportSnapshot | null>(null);
  const [exportingFormat, setExportingFormat] = useState<"csv" | "pdf" | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const inventoryLinkedRange = useMemo(() => toManilaRangeIso({ from, to }), [from, to]);

  useEffect(() => {
    let cancelled = false;

    const loadKpis = async () => {
      setKpiLoading(true);
      setAvailabilityLoading(true);
      try {
        const [nextKpiResult, nextAvailabilityResult] = await Promise.allSettled([
          fetchInventoryKpiSummary({
            from: inventoryLinkedRange.from,
            to: inventoryLinkedRange.to,
          }),
          fetchInventoryAvailabilityRisk({
            from: inventoryLinkedRange.from,
            to: inventoryLinkedRange.to,
          }),
        ]);

        if (cancelled) {
          return;
        }

        if (nextKpiResult.status === "fulfilled") {
          setKpiReport(nextKpiResult.value);
          setKpiError(null);
        } else {
          setKpiError(
            nextKpiResult.reason instanceof Error
              ? nextKpiResult.reason.message
              : "Failed to load inventory KPI summary",
          );
        }

        if (nextAvailabilityResult.status === "fulfilled") {
          setAvailabilityReport(nextAvailabilityResult.value);
          setAvailabilityError(null);
        } else {
          setAvailabilityError(
            nextAvailabilityResult.reason instanceof Error
              ? nextAvailabilityResult.reason.message
              : "Failed to load inventory availability analytics",
          );
        }
      } finally {
        if (!cancelled) {
          setKpiLoading(false);
          setAvailabilityLoading(false);
        }
      }
    };

    void loadKpis();

    return () => {
      cancelled = true;
    };
  }, [inventoryLinkedRange.from, inventoryLinkedRange.to, refreshToken]);

  const formatPercent = (value: string | null | undefined) => {
    if (!value) {
      return "N/A";
    }

    return `${Number(value).toFixed(2)}%`;
  };

  const canExport =
    !kpiLoading &&
    !availabilityLoading &&
    !kpiError &&
    !availabilityError &&
    kpiReport !== null &&
    availabilityReport !== null &&
    inventoryLinkedSnapshot !== null;

  const handleExport = async (format: "csv" | "pdf") => {
    if (!kpiReport || !availabilityReport || !inventoryLinkedSnapshot) {
      return;
    }

    setExportingFormat(format);
    setExportNotice(null);
    setExportError(null);

    try {
      const snapshot = {
        filters: { from, to },
        kpiSummary: kpiReport,
        availabilityRisk: availabilityReport,
        inventoryLinked: inventoryLinkedSnapshot,
      };

      if (format === "csv") {
        const filename = exportInventoryReportsCsv(snapshot);
        setExportNotice(`CSV export downloaded as ${filename}.`);
      } else {
        const filename = exportInventoryReportsPdf(snapshot);
        setExportNotice(
          `Printable inventory report opened as ${filename}. Use your browser's Save as PDF option to finish the export.`,
        );
      }
    } catch (nextError) {
      setExportError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to export inventory reports",
      );
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className={styles.workspace}>
      <section className={styles.toolbar} aria-label="Report date range and exports">
        <strong>Date Range</strong>
        <label>From <input aria-label="From date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To <input aria-label="To date" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
        <div className={styles.toolbarActions}>
          <button type="button" className={styles.refresh} onClick={() => setRefreshToken((current) => current + 1)}><RefreshCw size={15} />Refresh</button>
          <button type="button" disabled={!canExport || exportingFormat !== null} onClick={() => void handleExport("csv")}><FileDown size={15} />{exportingFormat === "csv" ? "Exporting..." : "Export CSV"}</button>
          <button type="button" disabled={!canExport || exportingFormat !== null} onClick={() => void handleExport("pdf")}><FileDown size={15} />{exportingFormat === "pdf" ? "Preparing..." : "Export PDF"}</button>
        </div>
      </section>

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

      <WidgetCard title="KPI Summary" className={styles.kpi}>
        {kpiError && <p role="alert" className="text-red-700">{kpiError}</p>}
        <div className={styles.kpiGrid}>
          {[
            { label: "Food Cost %", value: kpiLoading ? "..." : formatPercent(kpiReport?.summary.foodCostPercentage), Icon: ChartPie, color: "#065bff" },
            { label: "Waste %", value: kpiLoading ? "..." : formatPercent(kpiReport?.summary.wastePercentage), Icon: Trash2, color: "#248000" },
            { label: "Inventory Turnover", value: kpiLoading ? "..." : kpiReport?.summary.inventoryTurnoverRate ? Number(kpiReport.summary.inventoryTurnoverRate).toFixed(2) : "N/A", Icon: ChartNoAxesColumnIncreasing, color: "#791dff" },
            { label: "Materials Consumed", value: inventoryLinkedSnapshot?.report.summary.distinctMaterialsConsumed ?? "...", Icon: Layers, color: "#065bff" },
            { label: "Variants Sold", value: inventoryLinkedSnapshot?.report.summary.distinctVariantsSold ?? "...", Icon: Tag, color: "#248000" },
            { label: "Low-Stock Consumed", value: inventoryLinkedSnapshot?.report.summary.lowStockConsumedMaterialCount ?? "...", Icon: TriangleAlert, color: "#f53030" },
          ].map(({ label, value, Icon, color }) => <div key={label} className={styles.kpiItem}><Icon size={30} color={color} aria-hidden="true" /><div><span>{label}</span><strong>{value}</strong></div></div>)}
        </div>
      </WidgetCard>

      <InventoryAvailabilityRiskSection
        loading={availabilityLoading}
        error={availabilityError}
        report={availabilityReport}
      />

      <PosInventoryLinkedSection
        active
        inventoryLayout
        from={from}
        to={to}
        fromIso={inventoryLinkedRange.from}
        toIso={inventoryLinkedRange.to}
        refreshToken={refreshToken}
        showStandaloneExportControls={false}
        onSnapshotChange={setInventoryLinkedSnapshot}
      />
    </div>
  );
}
