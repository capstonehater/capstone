"use client";

import { AlertTriangle, Bell, Boxes, ChartNoAxesCombined, Clock3, PackageSearch, Truck } from "lucide-react";
import type { AlertRecord } from "@/lib/alerts";
import type { InventoryHealthReport, StockRunSpendReport, WasteSummaryReport } from "@/lib/reports";

type InventoryBusinessInsightsProps = {
  inventoryHealth: InventoryHealthReport | null;
  stockRunSpend: StockRunSpendReport | null;
  wasteSummary: WasteSummaryReport | null;
  alerts: AlertRecord[];
  loading: boolean;
  formatMoney: (value: string) => string;
  formatQuantity: (value: string) => string;
  formatDate: (value: string | null | undefined) => string;
};

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#232d46]">
        <span className="text-[#232d46]">{icon}</span>{title}
      </h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">{children}</p>;
}

export default function InventoryBusinessInsights({
  inventoryHealth,
  stockRunSpend,
  wasteSummary,
  alerts,
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
        <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Panel title="High-Value Inventory" icon={<Boxes size={16} />}>
            {inventoryHealth?.highValueMaterials.length ? (
              <div className="divide-y divide-slate-100">
                {inventoryHealth.highValueMaterials.slice(0, 4).map((item) => (
                  <div key={item.rawMaterialId} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{item.name}</p><p className="text-xs text-slate-500">{formatQuantity(item.summary.usableQuantity)} usable</p></div>
                    <span className="shrink-0 text-sm font-semibold text-[#232d46]">{formatMoney(item.inventoryValue)}</span>
                  </div>
                ))}
              </div>
            ) : <Empty>{inventoryHealth ? "No high-value inventory records." : "Inventory health data unavailable."}</Empty>}
          </Panel>

          <Panel title="Waste Insights" icon={<ChartNoAxesCombined size={16} />}>
            {wasteSummary?.byReason.length ? (
              <div className="divide-y divide-slate-100">
                {wasteSummary.byReason.slice(0, 4).map((reason) => (
                  <div key={reason.reasonCode} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <div><p className="text-sm font-medium text-slate-800">{reason.reasonCode.replaceAll("_", " ")}</p><p className="text-xs text-slate-500">{reason.eventCount} entries · {formatQuantity(reason.quantity)}</p></div>
                    <span className="text-sm font-semibold text-amber-700">{formatMoney(reason.cost)}</span>
                  </div>
                ))}
              </div>
            ) : <Empty>{wasteSummary ? "No waste recorded for this period." : "Waste report unavailable."}</Empty>}
          </Panel>

          <Panel title="Supplier Spend" icon={<Truck size={16} />}>
            {stockRunSpend?.bySupplier.length ? (
              <div className="divide-y divide-slate-100">
                {stockRunSpend.bySupplier.slice(0, 4).map((supplier) => (
                  <div key={supplier.supplierId ?? supplier.supplierName} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{supplier.supplierName}</p><p className="text-xs text-slate-500">{supplier.lineCount} stock-run lines</p></div>
                    <span className="shrink-0 text-sm font-semibold text-[#232d46]">{formatMoney(supplier.totalSpend)}</span>
                  </div>
                ))}
              </div>
            ) : <Empty>{stockRunSpend ? "No posted supplier spend for this period." : "Stock-run spend report unavailable."}</Empty>}
          </Panel>

          <Panel title="Near Expiry" icon={<Clock3 size={16} />}>
            {inventoryHealth?.nearExpiryBatches.length ? (
              <div className="divide-y divide-slate-100">
                {inventoryHealth.nearExpiryBatches.slice(0, 4).map((batch) => (
                  <div key={batch.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{batch.rawMaterial.name}</p><p className="text-xs text-slate-500">{formatQuantity(batch.remainingQuantity)} remaining</p></div>
                    <span className="shrink-0 text-right text-xs font-semibold text-amber-700">{formatDate(batch.expirationDate)}</span>
                  </div>
                ))}
              </div>
            ) : <Empty>{inventoryHealth ? "No batches nearing expiry." : "Inventory health data unavailable."}</Empty>}
          </Panel>

          <Panel title="Low Stock" icon={<PackageSearch size={16} />}>
            {inventoryHealth?.lowStockMaterials.length ? (
              <div className="divide-y divide-slate-100">
                {inventoryHealth.lowStockMaterials.slice(0, 4).map((item) => (
                  <div key={item.rawMaterialId} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{item.name}</p><p className="text-xs text-slate-500">Reorder at {formatQuantity(item.reorderPoint)}</p></div>
                    <span className="shrink-0 text-sm font-semibold text-amber-700">{formatQuantity(item.summary.usableQuantity)} usable</span>
                  </div>
                ))}
              </div>
            ) : <Empty>{inventoryHealth ? "No low-stock materials." : "Inventory health data unavailable."}</Empty>}
          </Panel>

          <Panel title="Active Alerts" icon={<Bell size={16} />}>
            {alerts.length ? (
              <div className="max-h-48 divide-y divide-slate-100 overflow-y-auto pr-1">
                {alerts.slice(0, 6).map((alert) => (
                  <div key={alert.id} className="py-2 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium text-slate-800">{alert.title}</p><AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" /></div>
                    <p className="mt-0.5 text-xs text-slate-500">{alert.message}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{alert.type.replaceAll("_", " ")} · {alert.severity}</p>
                  </div>
                ))}
              </div>
            ) : <Empty>No active alerts right now.</Empty>}
          </Panel>
        </div>
      )}
    </section>
  );
}
