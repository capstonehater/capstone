"use client";

import { useEffect, useState } from "react";
import { RefreshCcw } from "lucide-react";
import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import { fetchInventorySummary, fetchRawMaterialBatches, type StockBatch } from "@/lib/inventory";

type ExpiryRow = StockBatch & { materialName: string; sku: string; unit: string };
const quantity = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 4 });
const dateFormat = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });

function businessDate() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (name: string) => parts.find((value) => value.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export default function NearExpiryPage() {
  const [batches, setBatches] = useState<ExpiryRow[]>([]);
  const [direction, setDirection] = useState("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const today = businessDate();
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() + 14);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const materials = await fetchInventorySummary({ includeArchived: true });
        const collected: ExpiryRow[] = [];
        // Bound concurrent requests while loading the complete batch list.
        for (let index = 0; index < materials.length; index += 6) {
          if (!active) return;
          const groups = await Promise.all(materials.slice(index, index + 6).map(async (material) => {
            const entries = await fetchRawMaterialBatches(material.rawMaterialId);
            return entries.map((batch) => ({ ...batch, materialName: material.name, sku: material.sku, unit: material.unit.code }));
          }));
          collected.push(...groups.flat());
        }
        if (active) setBatches(collected);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load near-expiry batches.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [revision]);

  const rows = batches.filter((batch) => Number(batch.remainingQuantity) > 0 && batch.expirationDate && batch.expirationDate.slice(0, 10) <= cutoffDate)
    .sort((a, b) => {
      const comparison = a.expirationDate!.slice(0, 10).localeCompare(b.expirationDate!.slice(0, 10));
      return (direction === "asc" ? comparison : -comparison) || a.materialName.localeCompare(b.materialName) || a.id.localeCompare(b.id);
    });

  return (
    <AdminDashboardLayout>
      <section className="space-y-5 text-[#232d46]">
        <header>
          <h1 className="text-2xl font-bold">Near Expiry Materials</h1>
          <p className="mt-1 text-sm text-slate-600">Batches with remaining stock expiring within 14 days, including expired stock. Each batch is listed separately.</p>
        </header>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">
            <p role="status" className="text-sm font-medium">{loading ? "Loading batches..." : error ? "Batches unavailable" : `${rows.length} matching batch${rows.length === 1 ? "" : "es"}`}</p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                Sort by expiry date
                <select value={direction} onChange={(event) => setDirection(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-[#232d46]">
                  <option value="asc">Ascending (earliest first)</option>
                  <option value="desc">Descending (latest first)</option>
                </select>
              </label>
              <button type="button" disabled={loading} onClick={() => { setError(null); setLoading(true); setRevision((value) => value + 1); }} className="inline-flex items-center gap-2 rounded-lg bg-[#232d46] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />Refresh
              </button>
            </div>
          </div>
          {error ? <p role="alert" className="p-5 text-sm text-red-700">{error} Use Refresh to try again.</p> : (
            <div className="max-h-[32rem] overflow-auto" aria-busy={loading}>
              <table className="w-full min-w-[760px] text-sm">
                <caption className="sr-only">All batches expiring within 14 days or already expired, sorted by expiry date</caption>
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {['Material / SKU', 'Batch', 'Supplier', 'Status', 'Remaining'].map((heading) => <th key={heading} scope="col" className="sticky top-0 z-10 bg-slate-50 px-5 py-4 text-left">{heading}</th>)}
                    <th scope="col" aria-sort={direction === "asc" ? "ascending" : "descending"} className="sticky top-0 z-10 bg-slate-50 px-5 py-4 text-right">Expiry Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading near-expiry batches...</td></tr> : rows.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">No remaining stock is expired or due to expire within 14 days.</td></tr> : rows.map((batch) => {
                    const expiry = batch.expirationDate!.slice(0, 10);
                    const expired = expiry < today;
                    return (
                      <tr key={batch.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <th scope="row" className="px-5 py-4 text-left font-medium">{batch.materialName}<span className="mt-1 block text-xs font-normal text-slate-500">{batch.sku}</span></th>
                        <td className="max-w-48 break-words px-5 py-4 text-xs">{batch.id}</td>
                        <td className="px-5 py-4">{batch.supplier?.name ?? "No supplier"}</td>
                        <td className="px-5 py-4"><span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${expired ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{expired ? "Expired" : expiry === today ? "Expires today" : "Near expiry"}</span></td>
                        <td className="whitespace-nowrap px-5 py-4 tabular-nums">{quantity.format(Number(batch.remainingQuantity))} {batch.unit}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-right font-semibold">{dateFormat.format(new Date(`${expiry}T00:00:00Z`))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </AdminDashboardLayout>
  );
}
