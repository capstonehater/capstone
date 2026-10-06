"use client";

import { formatUnit } from "@/lib/units";

import { useEffect, useState } from "react";
import { RefreshCcw } from "lucide-react";
import AdminSelect from "@/components/admin/AdminSelect";
import styles from "@/components/admin/inventory/InventoryReportModal.module.css";
import { fetchInventorySummary, type InventorySummaryItem } from "@/lib/inventory";

const quantity = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 4 });
const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export default function LowStockPanel({ embedded = false }: { embedded?: boolean }) {
  const [materials, setMaterials] = useState<InventorySummaryItem[]>([]);
  const [direction, setDirection] = useState("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    fetchInventorySummary({ status: "LOW_STOCK", includeArchived: false })
      .then((rows) => { if (active) setMaterials(rows); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load low-stock materials.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  const rows = [...materials].sort((a, b) => {
    const difference = Number(a.summary.usableQuantity) - Number(b.summary.usableQuantity);
    return (direction === "asc" ? difference : -difference) || a.name.localeCompare(b.name);
  });

  return (
    <>
      <section className="space-y-5 text-[#232d46]">
        {!embedded && <header>
          {!embedded && <h1 className="text-2xl font-bold">Low Stock Materials</h1>}
          <p className="mt-1 text-sm text-slate-600">Active materials with usable stock above zero and at or below their reorder point.</p>
        </header>}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className={styles.toolbar}>
            <p role="status" className="text-sm font-medium">{loading ? "Loading materials..." : error ? "Materials unavailable" : `${rows.length} low-stock material${rows.length === 1 ? "" : "s"}`}</p>
            <div className={styles.controls}>
              <AdminSelect label="Sort by usable stock" value={direction} onChange={setDirection} options={[{ value: "asc", label: "Ascending (lowest first)" }, { value: "desc", label: "Descending (highest first)" }]} />
              <button type="button" disabled={loading} onClick={() => { setError(null); setLoading(true); setRevision((value) => value + 1); }} className={styles.refresh}>
                <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />Refresh
              </button>
            </div>
          </div>
          {error ? <p role="alert" className="p-5 text-sm text-red-700">{error} Use Refresh to try again.</p> : (
            <div className="max-h-[32rem] overflow-auto" aria-busy={loading}>
              <table className="w-full min-w-[720px] text-sm">
                <caption className="sr-only">All low-stock materials sorted by usable quantity</caption>
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="sticky top-0 z-10 bg-slate-50 px-5 py-4 text-left">Material / SKU</th>
                    <th scope="col" className="sticky top-0 z-10 bg-slate-50 px-5 py-4 text-left">Status</th>
                    <th scope="col" className="sticky top-0 z-10 bg-slate-50 px-5 py-4 text-left">Unit</th>
                    <th scope="col" className="sticky top-0 z-10 bg-slate-50 px-5 py-4 text-right">On Hand</th>
                    <th scope="col" aria-sort={direction === "asc" ? "ascending" : "descending"} className="sticky top-0 z-10 bg-slate-50 px-5 py-4 text-right">Usable Stock</th>
                    <th scope="col" className="sticky top-0 z-10 bg-slate-50 px-5 py-4 text-right">Reorder Point</th>
                    <th scope="col" className="sticky top-0 z-10 bg-slate-50 px-5 py-4 text-right">Inventory Value</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? <tr><td colSpan={7} className="p-8 text-center text-slate-500">Loading low-stock materials...</td></tr> : rows.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-500">No materials are currently low on stock.</td></tr> : rows.map((material) => (
                    <tr key={material.rawMaterialId} className="border-t border-slate-100 hover:bg-slate-50">
                      <th scope="row" className="px-5 py-4 text-left font-medium">{material.name}<span className="mt-1 block text-xs font-normal text-slate-500">{material.sku}</span></th>
                      <td className="px-5 py-4"><span className="whitespace-nowrap rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Low Stock</span></td>
                      <td className="px-5 py-4">{formatUnit(material.unit.code)}</td>
                      <td className="px-5 py-4 text-right tabular-nums">{quantity.format(Number(material.summary.onHandQuantity))}</td>
                      <td className="px-5 py-4 text-right font-semibold tabular-nums text-amber-700">{quantity.format(Number(material.summary.usableQuantity))}</td>
                      <td className="px-5 py-4 text-right tabular-nums">{quantity.format(Number(material.reorderPoint))}</td>
                      <td className="px-5 py-4 text-right tabular-nums">{currency.format(Number(material.inventoryValue))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
