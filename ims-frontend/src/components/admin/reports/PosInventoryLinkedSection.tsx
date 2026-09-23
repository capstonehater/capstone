"use client";

import { useEffect, useMemo, useState } from "react";
import SummaryCard from "@/components/dashboard/SummaryCard";
import WidgetCard from "@/components/dashboard/WidgetCard";
import {
  exportPosInventoryLinkedCsv,
  exportPosInventoryLinkedPdf,
  type PosInventoryLinkedExportSnapshot,
} from "@/lib/report-exports";
import {
  fetchPosInventoryLinked,
  type PosInventoryLinkedReport,
} from "@/lib/reports";
import { formatDateTime, formatPeso } from "@/lib/pos-utils";

type Props = {
  active: boolean;
  inventoryLayout?: boolean;
  from: string;
  to: string;
  fromIso: string;
  toIso: string;
  refreshToken: number;
  showStandaloneExportControls?: boolean;
  onSnapshotChange?: (snapshot: PosInventoryLinkedExportSnapshot | null) => void;
};

function formatQuantity(value: string, unitCode: string) {
  return `${value} ${unitCode}`;
}

function alertTone(severity: string | null) {
  switch (severity) {
    case "CRITICAL":
      return "bg-rose-100 text-rose-700";
    case "HIGH":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function PosInventoryLinkedSection({
  active,
  inventoryLayout = false,
  from,
  to,
  fromIso,
  toIso,
  refreshToken,
  showStandaloneExportControls = true,
  onSnapshotChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PosInventoryLinkedReport | null>(null);
  const [materialSearch, setMaterialSearch] = useState("");
  const [variantSearch, setVariantSearch] = useState("");
  const [drilldownVariantId, setDrilldownVariantId] = useState("");
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
        const nextReport = await fetchPosInventoryLinked({
          from: fromIso,
          to: toIso,
          materialSearch: materialSearch.trim() || undefined,
          variantSearch: variantSearch.trim() || undefined,
          drilldownVariantId: drilldownVariantId || undefined,
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
              : "Failed to load inventory-linked reporting",
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
  }, [
    active,
    fromIso,
    toIso,
    materialSearch,
    variantSearch,
    drilldownVariantId,
    refreshToken,
  ]);

  const selectedVariantName = useMemo(() => {
    const selected =
      report?.variants.find((variant) => variant.productVariant.id === drilldownVariantId) ??
      null;

    if (!selected) {
      return report?.selectedVariantBreakdown
        ? `${report.selectedVariantBreakdown.productVariant.product.name} - ${report.selectedVariantBreakdown.productVariant.name}`
        : undefined;
    }

    return `${selected.productVariant.product.name} - ${selected.productVariant.name}`;
  }, [drilldownVariantId, report]);

  useEffect(() => {
    if (!onSnapshotChange) {
      return;
    }

    if (!active || loading || error || !report) {
      onSnapshotChange(null);
      return;
    }

    onSnapshotChange({
      filters: {
        from,
        to,
        materialSearch: materialSearch.trim() || undefined,
        variantSearch: variantSearch.trim() || undefined,
        drilldownVariantName: selectedVariantName,
      },
      report,
    });
  }, [
    active,
    error,
    from,
    loading,
    materialSearch,
    onSnapshotChange,
    report,
    selectedVariantName,
    to,
    variantSearch,
  ]);

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
          materialSearch: materialSearch.trim() || undefined,
          variantSearch: variantSearch.trim() || undefined,
          drilldownVariantName: selectedVariantName,
        },
        report,
      };

      if (format === "csv") {
        const filename = exportPosInventoryLinkedCsv(snapshot);
        setExportNotice(`CSV export downloaded as ${filename}.`);
      } else {
        const filename = exportPosInventoryLinkedPdf(snapshot);
        setExportNotice(
          `Printable inventory-linked report opened as ${filename}. Use your browser's Save as PDF option to finish the export.`,
        );
      }
    } catch (nextError) {
      setExportError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to export inventory-linked reporting",
      );
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className="space-y-6" data-report={inventoryLayout ? "linked" : undefined}>
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {showStandaloneExportControls && exportError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {exportError}
        </div>
      ) : null}

      {showStandaloneExportControls && exportNotice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {exportNotice}
        </div>
      ) : null}

      <section data-report="consumption-intro" className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-neutral-900">
              Inventory-Linked Sales Consumption
            </h3>
            <p className="mt-2 text-sm text-neutral-600">
              Ledger-driven ingredient consumption and stock movement for completed sales, with
              current low-stock and reorder pressure pulled from existing inventory summaries and
              active alerts.
            </p>
          </div>

          <div
            className={`grid gap-3 sm:grid-cols-2 ${
              showStandaloneExportControls ? "xl:grid-cols-4" : "xl:grid-cols-2"
            }`}
          >
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1 block">Product / Variant</span>
              <input
                value={variantSearch}
                onChange={(event) => setVariantSearch(event.target.value)}
                placeholder="Search product, variant, or SKU"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              />
            </label>
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1 block">Material</span>
              <input
                value={materialSearch}
                onChange={(event) => setMaterialSearch(event.target.value)}
                placeholder="Search ingredient or SKU"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              />
            </label>
            {showStandaloneExportControls ? (
              <button
                type="button"
                disabled={loading || exportingFormat !== null}
                onClick={() => void handleExport("csv")}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exportingFormat === "csv" ? "Exporting..." : "Export CSV"}
              </button>
            ) : null}
            {showStandaloneExportControls ? (
              <button
                type="button"
                disabled={loading || exportingFormat !== null}
                onClick={() => void handleExport("pdf")}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exportingFormat === "pdf" ? "Preparing..." : "Export PDF"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          This section uses checkout-linked inventory ledger lines as the source of truth. It does
          not reconstruct usage in the frontend.
        </div>
      </section>

      <section data-report="consumption-metrics" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          title="Sales-Linked Transactions"
          value={loading ? "..." : report?.summary.salesLinkedTransactionCount ?? 0}
        />
        <SummaryCard
          title="Material Qty Used"
          value={
            loading ? "..." : report?.summary.totalMaterialConsumptionQuantity ?? "0"
          }
        />
        <SummaryCard
          title="Consumption Cost"
          value={loading ? "..." : formatPeso(report?.summary.totalConsumptionCost ?? "0")}
        />
        <SummaryCard
          title="Materials Consumed"
          value={loading ? "..." : report?.summary.distinctMaterialsConsumed ?? 0}
        />
        <SummaryCard
          title="Variants Sold"
          value={loading ? "..." : report?.summary.distinctVariantsSold ?? 0}
        />
        <SummaryCard
          title="Low-Stock Consumed"
          value={loading ? "..." : report?.summary.lowStockConsumedMaterialCount ?? 0}
        />
      </section>

      <section data-report="linked-details" className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <WidgetCard title="High-Usage Ingredients" className="report-high-usage">
          <div className="overflow-x-auto">
            <div className="min-w-[850px] overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1.15fr_0.7fr_0.9fr_0.9fr_0.7fr_0.7fr_0.9fr_0.8fr_0.7fr] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Material</span>
                <span>SKU</span>
                <span>Consumed Qty</span>
                <span>Consumption Cost</span>
                <span>Orders</span>
                <span>Variants</span>
                <span>Usable Qty</span>
                <span>Reorder Point</span>
                <span>Status</span>
              </div>
              <div className="max-h-[30rem] overflow-y-auto">
                {loading ? (
                  <div className="px-4 py-6 text-sm text-slate-500">
                    Loading material consumption...
                  </div>
                ) : (report?.materials ?? []).length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-500">
                    No sales-linked material usage matched the current filters.
                  </div>
                ) : (
                  report?.materials.map((row) => (
                    <div
                      key={row.rawMaterial.id}
                      className="grid grid-cols-[1.15fr_0.7fr_0.9fr_0.9fr_0.7fr_0.7fr_0.9fr_0.8fr_0.7fr] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{row.rawMaterial.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {row.rawMaterial.unit.name} ({row.rawMaterial.unit.code})
                        </div>
                      </div>
                      <div>{row.rawMaterial.sku}</div>
                      <div>
                        {formatQuantity(row.consumedQuantity, row.rawMaterial.unit.code)}
                      </div>
                      <div className="font-semibold text-slate-900">
                        {formatPeso(row.consumptionCost)}
                      </div>
                      <div>{row.orderCount}</div>
                      <div>{row.variantCount}</div>
                      <div>
                        {formatQuantity(row.currentUsableQuantity, row.rawMaterial.unit.code)}
                      </div>
                      <div>
                        {formatQuantity(row.rawMaterial.reorderPoint, row.rawMaterial.unit.code)}
                      </div>
                      <div>
                        {row.activeLowStockAlert ? (
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${alertTone(
                              row.activeLowStockAlert.severity,
                            )}`}
                          >
                            Alert
                          </span>
                        ) : row.isLowStock ? (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                            Low
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                            OK
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </WidgetCard>

        <div data-report="linked-support" className="space-y-6">
          <WidgetCard title="Low-Stock / Reorder Pressure" className="report-low-stock">
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-slate-500">Loading low-stock materials...</p>
              ) : (report?.lowStockMaterials ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">
                  No currently consumed materials are low-stock in the selected range.
                </p>
              ) : (
                report?.lowStockMaterials.slice(0, 8).map((row) => (
                  <div
                    key={`low-${row.rawMaterial.id}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-slate-900">{row.rawMaterial.name}</div>
                        <div className="text-xs text-slate-500">{row.rawMaterial.sku}</div>
                      </div>
                      {row.activeLowStockAlert ? (
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${alertTone(
                            row.activeLowStockAlert.severity,
                          )}`}
                        >
                          {row.activeLowStockAlert.severity}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <div>
                        Used {formatQuantity(row.consumedQuantity, row.rawMaterial.unit.code)}
                      </div>
                      <div>
                        Usable {formatQuantity(row.currentUsableQuantity, row.rawMaterial.unit.code)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </WidgetCard>

          <WidgetCard title="Recent Sales-Linked Stock Movements" className="report-movements">
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-slate-500">Loading movements...</p>
              ) : (report?.recentSalesLinkedMovements ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">
                  No checkout-linked stock movement matched the current filters.
                </p>
              ) : (
                report?.recentSalesLinkedMovements.map((row) => (
                  <div
                    key={row.transactionId}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-semibold text-slate-900">{row.orderId ?? row.transactionId}</div>
                      <div className="text-xs text-slate-500">{formatDateTime(row.occurredAt)}</div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <div>{row.movementLineCount} material lines</div>
                      <div>{row.rawMaterialCount} ingredients</div>
                      <div>{row.variantCount} variants</div>
                      <div>{formatPeso(row.consumptionCost)} cost moved</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </WidgetCard>
        </div>
      </section>

      <section data-report="variant-details" className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <WidgetCard title="Top Variants by Sales-Linked Material Usage" className="report-variants">
          <div className="overflow-x-auto">
            <div className="min-w-[850px] overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1.15fr_0.95fr_0.8fr_0.9fr_0.9fr_0.9fr_0.8fr_92px] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Product / Variant</span>
                <span>Category</span>
                <span>Qty Sold</span>
                <span>Revenue</span>
                <span>Gross Margin</span>
                <span>Material Cost</span>
                <span>Orders</span>
                <span className="text-right">Action</span>
              </div>
              <div className="max-h-[30rem] overflow-y-auto">
                {loading ? (
                  <div className="px-4 py-6 text-sm text-slate-500">Loading variants...</div>
                ) : (report?.variants ?? []).length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-500">
                    No variants matched the current inventory-linked filters.
                  </div>
                ) : (
                  report?.variants.map((row) => (
                    <div
                      key={row.productVariant.id}
                      className="grid grid-cols-[1.15fr_0.95fr_0.8fr_0.9fr_0.9fr_0.9fr_0.8fr_92px] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">
                          {row.productVariant.product.name}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {row.productVariant.name} • {row.productVariant.sku}
                        </div>
                      </div>
                      <div>{row.productVariant.product.category?.name ?? "Uncategorized"}</div>
                      <div>{row.quantitySold}</div>
                      <div>{formatPeso(row.revenue)}</div>
                      <div>{formatPeso(row.grossMargin)}</div>
                      <div>{formatPeso(row.materialConsumptionCost)}</div>
                      <div>{row.orderCount}</div>
                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setDrilldownVariantId((current) =>
                              current === row.productVariant.id ? "" : row.productVariant.id,
                            )
                          }
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          {drilldownVariantId === row.productVariant.id ? "Hide" : "Inspect"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </WidgetCard>

        <WidgetCard title="Variant to Material Drill-Down" className="report-drilldown">
          {report?.selectedVariantBreakdown ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-lg font-semibold text-slate-900">
                    {report.selectedVariantBreakdown.productVariant.product.name}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {report.selectedVariantBreakdown.productVariant.name} •{" "}
                    {report.selectedVariantBreakdown.productVariant.sku}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDrilldownVariantId("")}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Clear Drill-Down
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Quantity Sold
                  </p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {report.selectedVariantBreakdown.summary.quantitySold}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Revenue
                  </p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {formatPeso(report.selectedVariantBreakdown.summary.revenue)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Material Cost
                  </p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {formatPeso(report.selectedVariantBreakdown.summary.materialConsumptionCost)}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[48rem] overflow-hidden rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-[1.2fr_0.8fr_1fr_1fr_0.9fr_0.8fr] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <span>Material</span>
                    <span>SKU</span>
                    <span>Consumed Qty</span>
                    <span>Consumption Cost</span>
                    <span>Usable Qty</span>
                    <span>Status</span>
                  </div>
                  <div className="max-h-[24rem] overflow-y-auto">
                    {report.selectedVariantBreakdown.materials.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-slate-500">
                        No material breakdown matched the current drill-down.
                      </div>
                    ) : (
                      report.selectedVariantBreakdown.materials.map((row) => (
                        <div
                          key={row.rawMaterial.id}
                          className="grid grid-cols-[1.2fr_0.8fr_1fr_1fr_0.9fr_0.8fr] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                        >
                          <div className="font-semibold text-slate-900">{row.rawMaterial.name}</div>
                          <div>{row.rawMaterial.sku}</div>
                          <div>
                            {formatQuantity(row.consumedQuantity, row.rawMaterial.unit.code)}
                          </div>
                          <div>{formatPeso(row.consumptionCost)}</div>
                          <div>
                            {formatQuantity(row.currentUsableQuantity, row.rawMaterial.unit.code)}
                          </div>
                          <div>
                            {row.isLowStock ? (
                              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                                Low
                              </span>
                            ) : (
                              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                OK
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
              Choose a variant from the table to inspect which materials were consumed for that
              sales-linked ledger footprint.
            </div>
          )}
        </WidgetCard>
      </section>
    </div>
  );
}
