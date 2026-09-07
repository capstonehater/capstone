"use client";

import { useEffect, useMemo, useState } from "react";
import SummaryCard from "@/components/dashboard/SummaryCard";
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
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Inventory Reports</h2>
            <p className="mt-2 text-neutral-600">
              Inventory-focused reporting for food cost, waste, event-based availability risk,
              and sales-linked ingredient consumption using backend-authoritative data.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1 block">From</span>
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              />
            </label>
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1 block">To</span>
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              />
            </label>
            <button
              type="button"
              onClick={() => setRefreshToken((current) => current + 1)}
              className="rounded-2xl bg-[#f45a1f] px-4 py-3 text-sm font-semibold text-white hover:bg-[#d94f1a]"
            >
              Refresh Reports
            </button>
            <button
              type="button"
              disabled={!canExport || exportingFormat !== null}
              onClick={() => void handleExport("csv")}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportingFormat === "csv" ? "Exporting..." : "Export CSV"}
            </button>
            <button
              type="button"
              disabled={!canExport || exportingFormat !== null}
              onClick={() => void handleExport("pdf")}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportingFormat === "pdf" ? "Preparing..." : "Export PDF"}
            </button>
          </div>
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

      <WidgetCard title="KPI Summary">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            KPI calculations use Manila-bounded date ranges and are computed entirely in the
            backend from completed orders, inventory ledger cost movements, and daily inventory
            snapshots. Inventory Turnover Rate only appears when the selected range has complete
            daily snapshot coverage.
          </div>

          {kpiError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {kpiError}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SummaryCard
              title="Food Cost %"
              value={
                kpiLoading ? "..." : formatPercent(kpiReport?.summary.foodCostPercentage)
              }
            />
            <SummaryCard
              title="Waste %"
              value={kpiLoading ? "..." : formatPercent(kpiReport?.summary.wastePercentage)}
            />
            <SummaryCard
              title="Inventory Turnover"
              value={
                kpiLoading
                  ? "..."
                  : kpiReport?.summary.inventoryTurnoverRate
                    ? Number(kpiReport.summary.inventoryTurnoverRate).toFixed(2)
                    : "N/A"
              }
            />
          </div>
        </div>
      </WidgetCard>

      <InventoryAvailabilityRiskSection
        loading={availabilityLoading}
        error={availabilityError}
        report={availabilityReport}
      />

      <PosInventoryLinkedSection
        active
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
