"use client";

import { Inbox } from "lucide-react";
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
    <div data-report="availability">
      <WidgetCard title="Availability & Stock Risk" className="report-risk">
        <div className="space-y-4">
          <p className="report-definition" title={report?.definitions.stockoutRate}>Stockout rate is the percentage of tracked material time spent out of stock during the selected period.</p>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="report-risk-metrics">
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

          <div className="report-risk-metrics">
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

      <section data-report="availability-tables">
        <WidgetCard title="Materials With Recorded Stockout Time" className="report-stockout">
          <div className="overflow-x-auto">
            <div className="min-w-[520px] overflow-hidden rounded-2xl border border-slate-200">
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

        <WidgetCard title="Top Selling Item Availability" className="report-top-selling">
          <div className="report-table-scroll">
            <table className="report-table">
              <thead><tr>{["Product / Variant", "Category", "Qty Sold", "Revenue", "Availability", "Sellable Time", "Downtime", "Coverage"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
              <tbody>{loading ? <tr><td colSpan={8}>Loading availability...</td></tr> : !report?.topSellingVariants.length ? <tr><td colSpan={8}><div className="report-empty"><Inbox aria-hidden="true" />No completed sales matched the selected range.<small>Try adjusting the date range or filters.</small></div></td></tr> : report.topSellingVariants.map((row) => <tr key={row.productVariant.id}>
                <td><strong>{row.productVariant.product.name}</strong><small>{row.productVariant.name} &bull; {row.productVariant.sku}</small></td>
                <td>{row.productVariant.product.category?.name ?? "Uncategorized"}</td><td>{row.quantitySold}</td><td>{formatPeso(row.revenue)}</td><td>{formatPercent(row.availabilityPercentage)}</td><td>{formatHours(row.sellableDurationHours)}</td><td>{formatHours(row.downtimeDurationHours)}</td><td><span className="report-badge">{row.trackedFromRangeStart ? "Tracked" : "No baseline"}</span></td>
              </tr>)}</tbody>
            </table>
          </div>
        </WidgetCard>

      </section>
    </div>
  );
}
