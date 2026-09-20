"use client";

import { Boxes, ChartNoAxesCombined, Clock3, PackageSearch, Truck } from "lucide-react";
import type { InventoryHealthReport, StockRunSpendReport, WasteSummaryReport } from "@/lib/reports";

type InventoryBusinessInsightsProps = {
  inventoryHealth: InventoryHealthReport | null;
  stockRunSpend: StockRunSpendReport | null;
  wasteSummary: WasteSummaryReport | null;
  loading: boolean;
  formatMoney: (value: string) => string;
  formatQuantity: (value: string) => string;
  formatDate: (value: string | null | undefined) => string;
};

function Panel({ title, icon, children, className = "", id }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`h-full rounded-xl border border-slate-200 bg-white p-6 ${className}`}>
      <h3 className="mb-5 flex items-center gap-2 text-xl font-semibold text-[#232d46]">
        <span className="text-[#232d46]">{icon}</span>{title}
      </h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">{children}</p>;
}

const tableClass = "w-full table-fixed text-base";
const headCellClass = "border-b border-slate-200 bg-slate-50 px-4 py-4 text-left text-sm font-semibold uppercase tracking-wide text-slate-500";
const cellClass = "border-b border-slate-100 px-4 py-5 align-top text-slate-700 last:border-b-0";

export default function InventoryBusinessInsights({
  inventoryHealth,
  stockRunSpend,
  wasteSummary,
  loading,
  formatMoney,
  formatQuantity,
  formatDate,
}: InventoryBusinessInsightsProps) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-[#232d46]">Inventory Overview</h2>
        <p className="text-sm text-slate-600">Stock risks, value, waste, and purchasing activity at a glance.</p>
      </div>
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">Loading inventory insights…</div>
      ) : (
        <div className="grid w-full items-stretch gap-6 md:grid-cols-2 xl:grid-cols-6">
          <Panel id="low-stock" title="Low Stock" icon={<PackageSearch size={16} />} className="xl:col-span-2">
            {inventoryHealth?.lowStockMaterials.length ? (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="max-h-72 overflow-auto">
                  <table className={tableClass}>
                    <thead className="sticky top-0 z-10"><tr><th className={headCellClass}>Material</th><th className={`${headCellClass} text-right`}>Usable</th><th className={`${headCellClass} text-right`}>Reorder Point</th></tr></thead>
                    <tbody>{inventoryHealth.lowStockMaterials.map((item) => (
                    <tr key={item.rawMaterialId}><td className={cellClass}><span className="block truncate font-medium">{item.name}</span></td><td className={`${cellClass} text-right font-semibold text-amber-700`}>{formatQuantity(item.summary.usableQuantity)}</td><td className={`${cellClass} text-right`}>{formatQuantity(item.reorderPoint)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            ) : <Empty>{inventoryHealth ? "No low-stock materials." : "Inventory health data unavailable."}</Empty>}
          </Panel>

          <Panel id="near-expiry" title="Near Expiry" icon={<Clock3 size={16} />} className="xl:col-span-2">
            {inventoryHealth?.nearExpiryBatches.length ? (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="max-h-72 overflow-auto">
                  <table className={tableClass}>
                    <thead className="sticky top-0 z-10"><tr><th className={headCellClass}>Material</th><th className={`${headCellClass} text-right`}>Remaining</th><th className={`${headCellClass} text-right`}>Expiry Date</th></tr></thead>
                    <tbody>{inventoryHealth.nearExpiryBatches.map((batch) => (
                    <tr key={batch.id}><td className={cellClass}><span className="block truncate font-medium">{batch.rawMaterial.name}</span></td><td className={`${cellClass} text-right`}>{formatQuantity(batch.remainingQuantity)}</td><td className={`${cellClass} text-right font-semibold text-amber-700`}>{formatDate(batch.expirationDate)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            ) : <Empty>{inventoryHealth ? "No batches nearing expiry." : "Inventory health data unavailable."}</Empty>}
          </Panel>

          <Panel id="waste-insights" title="Waste Insights" icon={<ChartNoAxesCombined size={16} />} className="xl:col-span-2">
            {wasteSummary?.byReason.length ? (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="max-h-72 overflow-auto">
                  <table className={tableClass}>
                    <thead className="sticky top-0 z-10"><tr><th className={headCellClass}>Reason</th><th className={`${headCellClass} text-right`}>Events / Qty</th><th className={`${headCellClass} text-right`}>Cost</th></tr></thead>
                    <tbody>{wasteSummary.byReason.map((reason) => (
                    <tr key={reason.reasonCode}><td className={cellClass}><span className="block truncate font-medium">{reason.reasonCode.replaceAll("_", " ")}</span></td><td className={`${cellClass} text-right`}>{reason.eventCount} / {formatQuantity(reason.quantity)}</td><td className={`${cellClass} text-right font-semibold text-amber-700`}>{formatMoney(reason.cost)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            ) : <Empty>{wasteSummary ? "No waste recorded for this period." : "Waste report unavailable."}</Empty>}
          </Panel>

          <Panel id="high-value" title="High-Value Inventory" icon={<Boxes size={16} />} className="xl:col-span-3">
            {inventoryHealth?.highValueMaterials.length ? (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="max-h-72 overflow-auto">
                  <table className={tableClass}>
                    <thead className="sticky top-0 z-10"><tr><th className={headCellClass}>Material</th><th className={`${headCellClass} text-right`}>Usable</th><th className={`${headCellClass} text-right`}>Value</th></tr></thead>
                    <tbody>{inventoryHealth.highValueMaterials.map((item) => (
                    <tr key={item.rawMaterialId}><td className={cellClass}><span className="block truncate font-medium">{item.name}</span></td><td className={`${cellClass} text-right`}>{formatQuantity(item.summary.usableQuantity)}</td><td className={`${cellClass} text-right font-semibold text-[#232d46]`}>{formatMoney(item.inventoryValue)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            ) : <Empty>{inventoryHealth ? "No high-value inventory records." : "Inventory health data unavailable."}</Empty>}
          </Panel>

          <Panel id="supplier-spend" title="Supplier Spend" icon={<Truck size={16} />} className="xl:col-span-3">
            {stockRunSpend?.bySupplier.length ? (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="max-h-72 overflow-auto">
                  <table className={tableClass}>
                    <thead className="sticky top-0 z-10"><tr><th className={headCellClass}>Supplier</th><th className={`${headCellClass} text-right`}>Lines</th><th className={`${headCellClass} text-right`}>Spend</th></tr></thead>
                    <tbody>{stockRunSpend.bySupplier.map((supplier) => (
                    <tr key={supplier.supplierId ?? supplier.supplierName}><td className={cellClass}><span className="block truncate font-medium">{supplier.supplierName}</span></td><td className={`${cellClass} text-right`}>{supplier.lineCount}</td><td className={`${cellClass} text-right font-semibold text-[#232d46]`}>{formatMoney(supplier.totalSpend)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            ) : <Empty>{stockRunSpend ? "No posted supplier spend for this period." : "Stock-run spend report unavailable."}</Empty>}
          </Panel>
        </div>
      )}
    </section>
  );
}
