"use client";

import { useEffect, useState } from "react";
import ReportColumns from "./ReportColumns";
import WidgetCard from "@/components/dashboard/WidgetCard";
import { fetchWasteSummary, type WasteSummaryReport } from "@/lib/reports";
import { formatPeso } from "@/lib/pos-utils";

const quantityFormat = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 4 });

export default function WasteInsightsReport({ fromIso, toIso }: { fromIso: string; toIso: string }) {
  const [report, setReport] = useState<WasteSummaryReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchWasteSummary({ from: fromIso, to: toIso, includeAllGroups: true })
      .then(next => { if (active) setReport(next); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load waste insights."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fromIso, toIso]);

  const rows = (report?.byReason ?? []).flatMap(reason => reason.materials.map(material => ({ ...material, reasonCode: reason.reasonCode })))
    .sort((left, right) => Number(right.cost) - Number(left.cost) || left.name.localeCompare(right.name));

  return <WidgetCard title="Waste Insight Breakdown" className="report-low-stock report-waste">
    <div className="report-waste-content">
      <p className="text-sm text-slate-600">Waste materials grouped by product and reason for the selected date range.</p>
      <div className="report-waste-table overflow-auto rounded-lg border border-slate-200" aria-busy={loading}>
        <ReportColumns columns={["Material", "Reason", "Events", "Quantity", "Cost"]}><table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Waste materials, reasons, events, quantities, and costs for the selected date range</caption>
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500"><tr>
            <th scope="col" className="px-3 py-3 text-left">Material</th>
            <th scope="col" className="px-3 py-3 text-left">Reason</th>
            <th scope="col" className="px-3 py-3 text-right">Events</th>
            <th scope="col" className="px-3 py-3 text-right">Quantity</th>
            <th scope="col" className="px-3 py-3 text-right">Cost</th>
          </tr></thead>
          <tbody>{loading ? <tr><td colSpan={5} className="p-6 text-center text-slate-500">Loading waste records...</td></tr>
            : error ? <tr><td colSpan={5} className="p-6 text-rose-700" role="alert">{error}</td></tr>
            : rows.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-slate-500">No waste recorded in the selected date range.</td></tr>
            : rows.map(row => <tr key={JSON.stringify([row.reasonCode, row.rawMaterialId])} className="border-t border-slate-200">
              <th scope="row" className="px-3 py-3 text-left font-medium">{row.name}<span className="block text-xs font-normal text-slate-500">{row.sku}</span></th>
              <td className="px-3 py-3">{row.reasonCode.replaceAll("_", " ")}</td>
              <td className="px-3 py-3 text-right tabular-nums">{row.eventCount}</td>
              <td className="px-3 py-3 text-right tabular-nums">{quantityFormat.format(Number(row.quantity))}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums">{formatPeso(row.cost)}</td>
            </tr>)}</tbody>
        </table></ReportColumns>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <span className="text-sm font-medium">Total Waste Cost</span>
        <strong className="text-lg tabular-nums">{loading ? "Loading..." : error ? "Unavailable" : formatPeso(report?.totals.cost ?? "0")}</strong>
      </div>
    </div>
  </WidgetCard>;
}
