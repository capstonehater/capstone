"use client";

import SummaryCard from "@/components/dashboard/SummaryCard";
import WidgetCard from "@/components/dashboard/WidgetCard";
import { formatPeso } from "@/lib/pos-utils";
import type { InventoryAvailabilityRiskReport } from "@/lib/reports";

type Props = {
  loading: boolean;
  error: string | null;
  report: InventoryAvailabilityRiskReport | null;
};

function formatPercent(value: string | null | undefined) {
  if (!value) {
    return "N/A";
  }

  return `${Number(value).toFixed(2)}%`;
}

function formatHours(value: string | null | undefined) {
  if (!value) {
    return "N/A";
  }

  return `${Number(value).toFixed(2)} h`;
}

export default function InventoryAvailabilityRiskSection({
  loading,
  error,
  report,
}: Props) {
  return (
    <div className="space-y-6">
      <WidgetCard title="Availability & Stock Risk">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p>{report?.definitions.stockoutRate ?? "Stockout Rate uses recorded stockout events only."}</p>
            <p className="mt-2">
              {report?.definitions.menuItemAvailabilityRate ??
                "Menu availability uses recorded sellability events only."}
            </p>
            <p className="mt-2">
              {report?.definitions.topSellingItemAvailability ??
                "Top-selling item availability is computed from top sellers plus recorded variant availability events."}
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SummaryCard
              title="Stockout Rate"
              value={loading ? "..." : formatPercent(report?.summary.stockoutRatePercentage)}
            />
            <SummaryCard
              title="Menu Item Availability"
              value={
                loading ? "..." : formatPercent(report?.summary.menuItemAvailabilityRate)
              }
            />
            <SummaryCard
              title="Top-Selling Availability"
              value={
                loading
                  ? "..."
                  : formatPercent(report?.summary.topSellingItemAvailabilityPercentage)
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SummaryCard
              title="Materials With Stockout"
              value={
                loading
                  ? "..."
                  : `${report?.summary.materialsWithStockoutCount ?? 0} / ${
                      report?.summary.trackedMaterialCount ?? 0
                    }`
              }
            />
            <SummaryCard
              title="Tracked Variants"
              value={
                loading
                  ? "..."
                  : `${report?.summary.trackedVariantCount ?? 0} tracked, ${
                      report?.summary.untrackedVariantCount ?? 0
                    } untracked`
              }
            />
            <SummaryCard
              title="Tracked Top Sellers"
              value={
                loading
                  ? "..."
                  : `${report?.summary.trackedTopSellingVariantCount ?? 0} / ${
                      report?.summary.totalTopSellingVariantCount ?? 0
                    }`
              }
            />
          </div>
        </div>
      </WidgetCard>

      <section className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
        <WidgetCard title="Materials With Recorded Stockout Time" className="min-w-0">
          <div className="overflow-x-auto">
            <div className="min-w-[58rem] overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1.2fr_0.8fr_0.9fr_0.9fr_0.9fr_0.8fr] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Material</span>
                <span>SKU</span>
                <span>Stockout Time</span>
                <span>Stockout Rate</span>
                <span>Events</span>
                <span>Current State</span>
              </div>
              <div className="max-h-[28rem] overflow-y-auto">
                {loading ? (
                  <div className="px-4 py-6 text-sm text-slate-500">
                    Loading stockout history...
                  </div>
                ) : (report?.stockoutMaterials ?? []).length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-500">
                    No overlapping stockout history was recorded in the selected range.
                  </div>
                ) : (
                  report?.stockoutMaterials.map((row) => (
                    <div
                      key={row.rawMaterial.id}
                      className="grid grid-cols-[1.2fr_0.8fr_0.9fr_0.9fr_0.9fr_0.8fr] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{row.rawMaterial.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {row.rawMaterial.unit.name} ({row.rawMaterial.unit.code})
                        </div>
                      </div>
                      <div>{row.rawMaterial.sku}</div>
                      <div>{formatHours(row.stockoutDurationHours)}</div>
                      <div>{formatPercent(row.stockoutRatePercentage)}</div>
                      <div>{row.overlappingStockoutEventCount}</div>
                      <div>
                        {row.currentlyOutOfStock ? (
                          <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                            Open
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Recovered
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

        <WidgetCard title="Top-Selling Item Availability" className="min-w-0">
          <div className="max-h-[28rem] min-w-0 overflow-y-auto rounded-2xl border border-slate-200">
            {loading ? (
              <p className="m-0 px-4 py-6 text-sm text-slate-500">Loading top-selling availability...</p>
            ) : (report?.topSellingVariants ?? []).length === 0 ? (
              <p className="m-0 px-4 py-6 text-sm text-slate-500">No completed sales matched the selected range.</p>
            ) : (
              report?.topSellingVariants.map((row) => (
                <article key={row.productVariant.id} className="min-w-0 border-b p-4 last:border-b-0">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                      <h3 className="m-0 text-sm font-semibold text-slate-900">{row.productVariant.product.name}</h3>
                      <p className="mb-0 mt-1 text-xs text-slate-500">{row.productVariant.name} &bull; {row.productVariant.sku}</p>
                      <p className="mb-0 mt-1 text-xs text-slate-500">{row.productVariant.product.category?.name ?? "Uncategorized"}</p>
                    </div>
                    <span className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${row.trackedFromRangeStart ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                      {row.trackedFromRangeStart ? "Tracked" : "No baseline"}
                    </span>
                  </div>
                  <dl className="mb-0 mt-4 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                    {[
                      ["Qty Sold", row.quantitySold],
                      ["Revenue", formatPeso(row.revenue)],
                      ["Availability", formatPercent(row.availabilityPercentage)],
                      ["Sellable Time", formatHours(row.sellableDurationHours)],
                      ["Downtime", formatHours(row.downtimeDurationHours)],
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-0 [overflow-wrap:anywhere]">
                        <dt className="text-xs font-medium text-slate-500">{label}</dt>
                        <dd className="mb-0 mt-1 text-sm font-semibold text-slate-900">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))
            )}
          </div>
        </WidgetCard>
      </section>
    </div>
  );
}
