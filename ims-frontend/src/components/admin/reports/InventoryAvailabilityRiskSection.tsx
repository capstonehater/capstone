"use client";
import { formatAvailabilityDuration, formatStockoutDuration } from "@/lib/report-duration";

import ReportColumns from "./ReportColumns";
import { formatUnit } from "@/lib/units";

import { Inbox } from "lucide-react";
import { useState } from "react";
import WidgetCard from "@/components/dashboard/WidgetCard";
import { formatPeso } from "@/lib/pos-utils";
import type { InventoryAvailabilityRiskReport } from "@/lib/reports";

type Props = {
  loading: boolean;
  error: string | null;
  report: InventoryAvailabilityRiskReport | null;
};

const metricDefinitions = {
  "Stockout Rate": "Stockout rate is the percentage of tracked material time spent out of stock during the selected period.",
  "Menu Item Availability": "Menu item availability is total sellable time divided by total tracked time across menu variants with a baseline at the start of the selected period. Sellable time is when an item could be sold; downtime is when it could not. One day equals 24 hours. Durations show completed whole hours; downtime over 24 hours shows days and hours. Percentages use the full recorded durations.",
  "Top-Selling Availability": "Top-selling availability is the average availability of the top-selling variants during the selected period. Variants without a baseline at the start of the period are excluded.",
  "Materials With Stockout": "The first number counts tracked materials that were out of stock during the selected period. The second is the total number of tracked materials.",
  "Tracked Variants": "Tracked variants have availability history at or before the start of the selected period. Untracked variants have no starting baseline and are excluded from availability percentages.",
  "Tracked Top Sellers": "The first number counts top-selling variants with an availability baseline at the start of the selected period. The second is the total number of top-selling variants. Only tracked top sellers contribute to top-selling availability.",
};
type Metric = keyof typeof metricDefinitions;

function MetricCard({ title, value, selected, onSelect }: {
  title: Metric;
  value: string;
  selected: Metric;
  onSelect: (metric: Metric) => void;
}) {
  return (
    <button type="button" className="report-metric-select rounded-2xl bg-white p-4 text-left shadow-sm"
      aria-pressed={selected === title} aria-describedby="availability-metric-definition"
      onClick={() => onSelect(title)}>
      <div className="mb-3 flex items-center justify-between"><p className="text-sm text-neutral-500">{title}</p></div>
      <h3 className="text-3xl font-bold text-neutral-900">{value}</h3>
    </button>
  );
}

function formatPercent(value: string | null | undefined) {
  if (!value) {
    return "N/A";
  }

  return `${Number(value).toFixed(2)}%`;
}

export default function InventoryAvailabilityRiskSection({
  loading,
  error,
  report,
}: Props) {
  const [selectedMetric, setSelectedMetric] = useState<Metric>("Stockout Rate");
  return (
    <div data-report="availability">
      <WidgetCard title="Availability & Stock Risk" className="report-risk">
        <div className="space-y-4">
          <p id="availability-metric-definition" className="report-definition" aria-live="polite">{metricDefinitions[selectedMetric]}</p>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="report-risk-metrics">
            <MetricCard selected={selectedMetric} onSelect={setSelectedMetric}
              title="Stockout Rate"
              value={loading ? "..." : formatPercent(report?.summary.stockoutRatePercentage)}
            />
            <MetricCard selected={selectedMetric} onSelect={setSelectedMetric}
              title="Menu Item Availability"
              value={
                loading ? "..." : formatPercent(report?.summary.menuItemAvailabilityRate)
              }
            />
            <MetricCard selected={selectedMetric} onSelect={setSelectedMetric}
              title="Top-Selling Availability"
              value={
                loading
                  ? "..."
                  : formatPercent(report?.summary.topSellingItemAvailabilityPercentage)
              }
            />
          </div>

          <div className="report-risk-metrics">
            <MetricCard selected={selectedMetric} onSelect={setSelectedMetric}
              title="Materials With Stockout"
              value={
                loading
                  ? "..."
                  : `${report?.summary.materialsWithStockoutCount ?? 0} / ${
                      report?.summary.trackedMaterialCount ?? 0
                    }`
              }
            />
            <MetricCard selected={selectedMetric} onSelect={setSelectedMetric}
              title="Tracked Variants"
              value={
                loading
                  ? "..."
                  : `${report?.summary.trackedVariantCount ?? 0} tracked, ${
                      report?.summary.untrackedVariantCount ?? 0
                    } untracked`
              }
            />
            <MetricCard selected={selectedMetric} onSelect={setSelectedMetric}
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
          <div className="report-stockout-scroll">
            <ReportColumns columns={["Material","SKU","Stockout Time","Stockout Rate","Events","Current State"]} gridTemplate="1.2fr_0.8fr_0.9fr_0.9fr_0.9fr_0.8fr"><div className="min-w-[520px]">
              <div className="report-stockout-heading grid grid-cols-[1.2fr_0.8fr_0.9fr_0.9fr_0.9fr_0.8fr] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Material</span>
                <span>SKU</span>
                <span>Stockout Time</span>
                <span>Stockout Rate</span>
                <span>Events</span>
                <span>Current State</span>
              </div>
              <div>
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
                          {formatUnit(row.rawMaterial.unit.name)} ({formatUnit(row.rawMaterial.unit.code)})
                        </div>
                      </div>
                      <div>{row.rawMaterial.sku}</div>
                      <div>{formatStockoutDuration(row.stockoutDurationHours)}</div>
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
            </div></ReportColumns>
          </div>
        </WidgetCard>

        <WidgetCard title="Top Selling Item Availability" className="report-top-selling">
          <div className="report-table-scroll">
            <ReportColumns columns={["Product / Variant","Category","Qty Sold","Revenue","Availability","Sellable Time","Downtime","Coverage"]}><table className="report-table">
              <thead><tr>{["Product / Variant", "Category", "Qty Sold", "Revenue", "Availability", "Sellable Time", "Downtime", "Coverage"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
              <tbody>{loading ? <tr><td colSpan={8}>Loading availability...</td></tr> : !report?.topSellingVariants.length ? <tr><td colSpan={8}><div className="report-empty"><Inbox aria-hidden="true" />No completed sales matched the selected range.<small>Try adjusting the date range or filters.</small></div></td></tr> : report.topSellingVariants.map((row) => <tr key={row.productVariant.id}>
                <td><strong>{row.productVariant.product.name}</strong><small>{row.productVariant.name} &bull; {row.productVariant.sku}</small></td>
                <td>{row.productVariant.product.category?.name ?? "Uncategorized"}</td><td>{row.quantitySold}</td><td>{formatPeso(row.revenue)}</td><td>{formatPercent(row.availabilityPercentage)}</td><td>{formatAvailabilityDuration(row.sellableDurationHours, "sellable")}</td><td>{formatAvailabilityDuration(row.downtimeDurationHours, "downtime")}</td><td><span className="report-badge">{row.trackedFromRangeStart ? "Tracked" : "No baseline"}</span></td>
              </tr>)}</tbody>
            </table></ReportColumns>
          </div>
        </WidgetCard>

      </section>
    </div>
  );
}
