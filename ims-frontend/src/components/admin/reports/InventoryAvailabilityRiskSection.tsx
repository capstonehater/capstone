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

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <WidgetCard title="Materials With Recorded Stockout Time">
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

        <WidgetCard title="Top-Selling Item Availability">
          <div className="overflow-x-auto">
            <div className="min-w-[66rem] overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1.2fr_0.75fr_0.8fr_0.9fr_0.9fr_0.9fr_0.8fr_0.9fr] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Product / Variant</span>
                <span>Category</span>
                <span>Qty Sold</span>
                <span>Revenue</span>
                <span>Availability</span>
                <span>Sellable Time</span>
                <span>Downtime</span>
                <span>Coverage</span>
              </div>
              <div className="max-h-[28rem] overflow-y-auto">
                {loading ? (
                  <div className="px-4 py-6 text-sm text-slate-500">
                    Loading top-selling availability...
                  </div>
                ) : (report?.topSellingVariants ?? []).length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-500">
                    No completed sales matched the selected range.
                  </div>
                ) : (
                  report?.topSellingVariants.map((row) => (
                    <div
                      key={row.productVariant.id}
                      className="grid grid-cols-[1.2fr_0.75fr_0.8fr_0.9fr_0.9fr_0.9fr_0.8fr_0.9fr] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
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
                      <div>{formatPercent(row.availabilityPercentage)}</div>
                      <div>{formatHours(row.sellableDurationHours)}</div>
                      <div>{formatHours(row.downtimeDurationHours)}</div>
                      <div>
                        {row.trackedFromRangeStart ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Tracked
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            No baseline
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
      </section>
    </div>
  );
}
