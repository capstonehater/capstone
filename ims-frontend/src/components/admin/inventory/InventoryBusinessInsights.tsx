"use client";

import { formatUnit } from "@/lib/units";
import styles from "./InventoryBusinessInsights.module.css";
import { ArrowRight, Boxes, ChartNoAxesCombined, Clock3, PackageSearch, Truck } from "lucide-react";
import type { InventoryHealthReport, StockRunSpendReport, WasteSummaryReport } from "@/lib/reports";

type ReportView = "low-stock" | "near-expiry" | "waste" | "value" | "supplier";

type InventoryBusinessInsightsProps = {
  onOpenReport?: (view: ReportView) => void;
  inventoryHealth: InventoryHealthReport | null;
  stockRunSpend: StockRunSpendReport | null;
  wasteSummary: WasteSummaryReport | null;
  loading: boolean;
  formatMoney: (value: string) => string;
  formatQuantity: (value: string) => string;
  formatDate: (value: string | null | undefined) => string;
};

function Panel({ title, icon, children, className = "", id, onOpen, footerLabel }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string; id?: string; onOpen?: () => void; footerLabel: string }) {
  return (
    <section id={id} className={`${styles.panel} ${className}`}>
      <h3 className="mb-5 flex items-center gap-2 text-xl font-semibold text-[#232d46]">
        <span className="text-[#232d46]">{icon}</span>{title}
      </h3>
      <div className={styles.panelBody}>{children}</div>
      {onOpen && <button type="button" onClick={onOpen} className={styles.reportFooter}><span>{footerLabel}</span><ArrowRight size={24} aria-hidden="true" /></button>}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className={`${styles.empty} rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500`}>{children}</p>;
}

const tableClass = styles.table;
const headCellClass = "";
const cellClass = "";

export default function InventoryBusinessInsights({
  onOpenReport,
  inventoryHealth,
  stockRunSpend,
  wasteSummary,
  loading,
  formatMoney,
  formatQuantity,
  formatDate,
}: InventoryBusinessInsightsProps) {
  return (
    <section className={styles.overview}>
      <div className={styles.intro}>
        <h2 className="text-lg font-bold text-[#232d46]">Inventory Overview</h2>
        <p className="text-sm text-slate-600">Stock risks, value, waste, and purchasing activity at a glance.</p>
      </div>
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">Loading inventory insights…</div>
      ) : (
        <div className={styles.grid}>
          <Panel onOpen={onOpenReport ? () => onOpenReport("low-stock") : undefined} id="low-stock" footerLabel="View all low-stock materials" title="Low Stock" icon={<PackageSearch size={16} />}>
            {inventoryHealth?.lowStockMaterials.length ? (
              <div>
                <div className={styles.scroll}>
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

          <Panel onOpen={onOpenReport ? () => onOpenReport("near-expiry") : undefined} id="near-expiry" footerLabel="View all near-expiry batches" title="Near Expiry" icon={<Clock3 size={16} />}>
            {inventoryHealth?.nearExpiryBatches.length ? (
              <div>
                <div className={styles.scroll}>
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

          <Panel onOpen={onOpenReport ? () => onOpenReport("waste") : undefined} id="waste-insights" footerLabel="View all waste records" title="Waste Insights" icon={<ChartNoAxesCombined size={16} />}>
            {wasteSummary?.byReason.length ? (
              <div>
                <div className={styles.scroll}>
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

          <Panel onOpen={onOpenReport ? () => onOpenReport("value") : undefined} id="high-value" footerLabel="View all inventory values" title="High-Value Inventory" icon={<Boxes size={16} />}>
            {inventoryHealth?.highValueMaterials.length ? (
              <div>
                <div className={styles.scroll}>
                  <table className={tableClass}>
                    <thead className="sticky top-0 z-10"><tr><th className={headCellClass}>Material</th><th className={`${headCellClass} text-right`}>Usable</th><th className={headCellClass}>Unit</th><th className={`${headCellClass} text-right`}>Value</th></tr></thead>
                    <tbody>{inventoryHealth.highValueMaterials.map((item) => (
                    <tr key={item.rawMaterialId}><td className={cellClass}><span className="block truncate font-medium">{item.name}</span></td><td className={`${cellClass} text-right`}>{formatQuantity(item.summary.usableQuantity)}</td><td className={cellClass}>{formatUnit(item.unit.code)}</td><td className={`${cellClass} text-right font-semibold text-[#232d46]`}>{formatMoney(item.inventoryValue)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            ) : <Empty>{inventoryHealth ? "No high-value inventory records." : "Inventory health data unavailable."}</Empty>}
          </Panel>

          <Panel onOpen={onOpenReport ? () => onOpenReport("supplier") : undefined} id="supplier-spend" footerLabel="View all supplier spending" title="Supplier Spend" icon={<Truck size={16} />}>
            {stockRunSpend?.bySupplier.length ? (
              <div>
                <div className={styles.scroll}>
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
