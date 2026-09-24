"use client";

import { useEffect, useState } from "react";
import { RefreshCcw } from "lucide-react";
import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import AdminSelect from "@/components/admin/AdminSelect";
import { fetchInventorySummary } from "@/lib/inventory";
import { fetchStockRunSpend, fetchWasteSummary } from "@/lib/reports";

type Kind = "waste" | "value" | "supplier";
type Row = { id: string; name: string; detail?: string; quantity: number; amount: number; events?: number; unit?: string };
const quantityFormat = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 4 });
const moneyFormat = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const content = {
  waste: { title: "Waste Insights", description: "All recorded waste grouped by reason, with total quantities and costs.", name: "Reason", quantity: "Quantity", amount: "Cost" },
  value: { title: "High-Value Inventory", description: "All active materials with usable stock and inventory value.", name: "Material / SKU", quantity: "Usable Stock", amount: "Inventory Value" },
  supplier: { title: "Supplier Spend", description: "All posted stock-run spending grouped by supplier.", name: "Supplier", quantity: "Stock-run Lines", amount: "Spend" },
};

async function loadRows(kind: Kind): Promise<Row[]> {
  if (kind === "waste") {
    const report = await fetchWasteSummary({ includeAllGroups: true });
    return report.byReason.map((row) => ({ id: row.reasonCode, name: row.reasonCode.replaceAll("_", " "), quantity: Number(row.quantity), amount: Number(row.cost), events: row.eventCount }));
  }
  if (kind === "supplier") {
    const report = await fetchStockRunSpend({ includeAllGroups: true });
    return report.bySupplier.map((row) => ({ id: row.supplierId ?? "unassigned", name: row.supplierName, quantity: row.lineCount, amount: Number(row.totalSpend) }));
  }
  const materials = await fetchInventorySummary({ includeArchived: false });
  return materials.map((row) => ({ id: row.rawMaterialId, name: row.name, detail: row.sku, unit: row.unit.code, quantity: Number(row.summary.usableQuantity), amount: Number(row.inventoryValue) }));
}

export default function InventoryInsightPage({ kind }: { kind: Kind }) {
  const [items, setItems] = useState<Row[]>([]);
  const [sortBy, setSortBy] = useState("amount");
  const [direction, setDirection] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const config = content[kind];

  useEffect(() => {
    let active = true;
    loadRows(kind)
      .then((rows) => { if (active) setItems(rows); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load inventory report."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind, revision]);

  const rows = [...items].sort((a, b) => {
    const difference = sortBy === "quantity" ? a.quantity - b.quantity : a.amount - b.amount;
    return (direction === "asc" ? difference : -difference) || a.name.localeCompare(b.name);
  });
  const heading = "sticky top-0 z-10 bg-slate-50 px-5 py-4";

  return (
    <AdminDashboardLayout>
      <section className="space-y-5 text-[#232d46]">
        <header><h1 className="text-2xl font-bold">{config.title}</h1><p className="mt-1 text-sm text-slate-600">{config.description}</p></header>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">
            <p role="status" className="text-sm font-medium">{loading ? "Loading records..." : error ? "Records unavailable" : `${rows.length} record${rows.length === 1 ? "" : "s"}`}</p>
            <div className="flex flex-wrap items-end gap-3">
              {kind === "value" ? <AdminSelect label="Sort by" value={sortBy} onChange={setSortBy} options={[{ value: "amount", label: "Inventory Value" }, { value: "quantity", label: "Usable Stock" }]} /> : null}
              <AdminSelect label={kind === "value" ? "Order" : `Sort by ${config.amount.toLowerCase()}`} value={direction} onChange={setDirection} options={[{ value: "asc", label: "Ascending (lowest first)" }, { value: "desc", label: "Descending (highest first)" }]} />
              <button type="button" disabled={loading} onClick={() => { setError(null); setLoading(true); setRevision((value) => value + 1); }} className="inline-flex items-center gap-2 rounded-lg bg-[#232d46] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><RefreshCcw size={16} className={loading ? "animate-spin" : ""} />Refresh</button>
            </div>
          </div>
          {error ? <p role="alert" className="p-5 text-sm text-red-700">{error} Use Refresh to try again.</p> : (
            <div className="max-h-[32rem] overflow-auto" aria-busy={loading}>
              <table className="w-full min-w-[640px] text-sm">
                <caption className="sr-only">{config.title}, sorted by {sortBy === "quantity" ? config.quantity : config.amount}, {direction === "asc" ? "ascending" : "descending"}</caption>
                <thead className="text-xs uppercase tracking-wide text-slate-500"><tr>
                  <th scope="col" className={`${heading} text-left`}>{config.name}</th>
                  {kind === "waste" ? <th scope="col" className={`${heading} text-right`}>Events</th> : null}
                  <th scope="col" aria-sort={sortBy === "quantity" ? direction === "asc" ? "ascending" : "descending" : undefined} className={`${heading} text-right`}>{config.quantity}</th>
                  <th scope="col" aria-sort={sortBy === "amount" ? direction === "asc" ? "ascending" : "descending" : undefined} className={`${heading} text-right`}>{config.amount}</th>
                </tr></thead>
                <tbody>{loading ? <tr><td colSpan={kind === "waste" ? 4 : 3} className="p-8 text-center text-slate-500">Loading records...</td></tr> : rows.length === 0 ? <tr><td colSpan={kind === "waste" ? 4 : 3} className="p-8 text-center text-slate-500">No records available.</td></tr> : rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <th scope="row" className="px-5 py-4 text-left font-medium">{row.name}{row.detail ? <span className="mt-1 block text-xs font-normal text-slate-500">{row.detail}</span> : null}</th>
                    {kind === "waste" ? <td className="px-5 py-4 text-right tabular-nums">{quantityFormat.format(row.events ?? 0)}</td> : null}
                    <td className="px-5 py-4 text-right tabular-nums">{quantityFormat.format(row.quantity)}{row.unit ? ` ${row.unit}` : ""}</td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums">{moneyFormat.format(row.amount)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </AdminDashboardLayout>
  );
}
