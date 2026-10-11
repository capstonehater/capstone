"use client";
import { formatStockQuantity } from "@/lib/inventory-quantity";

import { useId, useState } from "react";
import { formatUnit } from "@/lib/units";
import styles from "./InventoryBusinessInsights.module.css";
import { CircleAlert, ArrowRight, Boxes, ChartNoAxesCombined, Clock3, PackageSearch, Truck } from "lucide-react";
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

function InsightHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <span className={styles.insightHint}>
    <button type="button" aria-label="About weekly waste insights" aria-describedby={id} aria-expanded={open}
      onClick={() => setOpen((current) => !current)} onBlur={() => setOpen(false)}
      onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
      <CircleAlert size={17} aria-hidden="true" />
    </button>
    <span id={id} role="tooltip" className={styles.insightTooltip} data-open={open || undefined}>{text}</span>
  </span>;
}

function Panel({ title, icon, children, className = "", id, onOpen, footerLabel, hint }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string; id?: string; onOpen?: () => void; footerLabel: string; hint?: string }) {
  return (
    <section id={id} className={`${styles.panel} ${className}`}>
      <h3 className="mb-5 flex items-center gap-2 text-xl font-semibold text-[#232d46]">
        <span className="text-[#232d46]">{icon}</span>{title}{hint && <InsightHint text={hint} />}
      </h3>
      <div className={styles.panelBody}>{children}</div>
      {onOpen && <button type="button" onClick={onOpen} className={styles.reportFooter}><span>{footerLabel}</span><ArrowRight size={24} aria-hidden="true" /></button>}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className={`${styles.empty} rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500`}>{children}</p>;
}

function MobileInsightRecords({ label, rows }: {
  label: string;
  rows: { id: string; name: string; fields: { label: string; value: string | number }[] }[];
}) {
  return <ul className={styles.mobileWaste} aria-label={label}>
    {rows.map(row => <li key={row.id}>
      <div className={styles.wasteRecordHeading}><strong>{row.name}</strong></div>
      <dl className={styles.wasteRecordDetails}>
        {row.fields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}
      </dl>
    </li>)}
  </ul>;
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
  const wasteRows = (wasteSummary?.byReason ?? [])
    .flatMap((reason) => reason.materials.map((material) => ({ reason, material })))
    .slice(0, 5);

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
              <div className={styles.wasteBody}>
                <MobileInsightRecords label="Low-stock materials" rows={inventoryHealth.lowStockMaterials.map(item => ({
                  id: item.rawMaterialId, name: item.name, fields: [
                    { label: "Usable", value: formatStockQuantity(item.summary.usableQuantity) },
                    { label: "Reorder Point", value: `${formatQuantity(item.reorderPoint)} ${formatUnit(item.unit.code)}` },
                  ],
                }))} />
                <div className={`${styles.scroll} ${styles.overviewTable}`}>
                  <table className={tableClass}>
                    <thead className="sticky top-0 z-10"><tr><th className={headCellClass}>Material</th><th className={`${headCellClass} text-right`}>Usable</th><th className={`${headCellClass} text-right`}>Reorder Point</th></tr></thead>
                    <tbody>{inventoryHealth.lowStockMaterials.map((item) => (
                    <tr key={item.rawMaterialId}><td className={cellClass}><span className="block truncate font-medium">{item.name}</span></td><td className={`${cellClass} text-right font-semibold text-amber-700`}>{formatStockQuantity(item.summary.usableQuantity)}</td><td className={`${cellClass} text-right`}>{formatQuantity(item.reorderPoint)} {formatUnit(item.unit.code)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            ) : <Empty>{inventoryHealth ? "No low-stock materials." : "Inventory health data unavailable."}</Empty>}
          </Panel>

          <Panel onOpen={onOpenReport ? () => onOpenReport("near-expiry") : undefined} id="near-expiry" footerLabel="View all near-expiry batches" title="Near Expiry" icon={<Clock3 size={16} />}>
            {inventoryHealth?.nearExpiryBatches.length ? (
              <div className={styles.wasteBody}>
                <MobileInsightRecords label="Near-expiry batches" rows={inventoryHealth.nearExpiryBatches.map(batch => ({
                  id: batch.id, name: batch.rawMaterial.name, fields: [
                    { label: "Remaining", value: formatStockQuantity(batch.remainingQuantity) },
                    { label: "Expiry Date", value: formatDate(batch.expirationDate) },
                  ],
                }))} />
                <div className={`${styles.scroll} ${styles.overviewTable}`}>
                  <table className={tableClass}>
                    <thead className="sticky top-0 z-10"><tr><th className={headCellClass}>Material</th><th className={`${headCellClass} text-right`}>Remaining</th><th className={`${headCellClass} text-right`}>Expiry Date</th></tr></thead>
                    <tbody>{inventoryHealth.nearExpiryBatches.map((batch) => (
                    <tr key={batch.id}><td className={cellClass}><span className="block truncate font-medium">{batch.rawMaterial.name}</span></td><td className={`${cellClass} text-right`}>{formatStockQuantity(batch.remainingQuantity)}</td><td className={`${cellClass} text-right font-semibold text-amber-700`}>{formatDate(batch.expirationDate)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            ) : <Empty>{inventoryHealth ? "No batches nearing expiry." : "Inventory health data unavailable."}</Empty>}
          </Panel>

          <Panel onOpen={onOpenReport ? () => onOpenReport("waste") : undefined} id="waste-insights" footerLabel="View all waste records" title="Waste Insights" hint="Shows this week's waste and resets Monday at midnight (Manila time). Historical records remain available in full reports." icon={<ChartNoAxesCombined size={16} />}>
            {wasteSummary?.byReason.length ? (
              <div className={styles.wasteBody}>
                <ul className={styles.mobileWaste} aria-label="Waste records">
                  {wasteRows.map(({ reason, material }) => (
                    <li key={JSON.stringify([reason.reasonCode, material.rawMaterialId])}>
                      <div className={styles.wasteRecordHeading}>
                        <strong title={material.sku}>{material.name}</strong>
                        <span className={styles.wasteReason}>{reason.reasonCode.replaceAll("_", " ")}</span>
                      </div>
                      <dl className={styles.wasteRecordDetails}>
                        <div><dt>Events</dt><dd>{material.eventCount}</dd></div>
                        <div><dt>Quantity</dt><dd>{formatQuantity(material.quantity)}</dd></div>
                        <div><dt>Cost</dt><dd>{formatMoney(material.cost)}</dd></div>
                      </dl>
                    </li>
                  ))}
                </ul>
                <div className={`${styles.scroll} ${styles.wasteTable}`}>
                  <table className={tableClass}>
                    <thead className="sticky top-0 z-10"><tr><th className={headCellClass}>Reason</th><th className={headCellClass}>Material</th><th className={`${headCellClass} text-right`}>Events / Qty</th><th className={`${headCellClass} text-right`}>Cost</th></tr></thead>
                    <tbody>{wasteRows.map(({ reason, material }) => (
                    <tr key={JSON.stringify([reason.reasonCode, material.rawMaterialId])}><td className={cellClass}><span className="block truncate font-medium">{reason.reasonCode.replaceAll("_", " ")}</span></td><td className={cellClass}><span className="block break-words" title={material.sku}>{material.name}</span></td><td className={`${cellClass} text-right`}>{material.eventCount} / {formatQuantity(material.quantity)}</td><td className={`${cellClass} text-right font-semibold text-amber-700`}>{formatMoney(material.cost)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            ) : <Empty>{wasteSummary ? "No waste recorded this week." : "Waste report unavailable."}</Empty>}
          </Panel>

          <Panel onOpen={onOpenReport ? () => onOpenReport("value") : undefined} id="high-value" footerLabel="View all inventory values" title="High-Value Inventory" icon={<Boxes size={16} />}>
            {inventoryHealth?.highValueMaterials.length ? (
              <div className={styles.wasteBody}>
                <MobileInsightRecords label="High-value inventory" rows={inventoryHealth.highValueMaterials.map(item => ({
                  id: item.rawMaterialId, name: item.name, fields: [
                    { label: "Usable", value: formatStockQuantity(item.summary.usableQuantity) },
                    { label: "Unit", value: formatUnit(item.unit.code) },
                    { label: "Value", value: formatMoney(item.inventoryValue) },
                  ],
                }))} />
                <div className={`${styles.scroll} ${styles.overviewTable}`}>
                  <table className={tableClass}>
                    <thead className="sticky top-0 z-10"><tr><th className={headCellClass}>Material</th><th className={`${headCellClass} text-right`}>Usable</th><th className={headCellClass}>Unit</th><th className={`${headCellClass} text-right`}>Value</th></tr></thead>
                    <tbody>{inventoryHealth.highValueMaterials.map((item) => (
                    <tr key={item.rawMaterialId}><td className={cellClass}><span className="block truncate font-medium">{item.name}</span></td><td className={`${cellClass} text-right`}>{formatStockQuantity(item.summary.usableQuantity)}</td><td className={cellClass}>{formatUnit(item.unit.code)}</td><td className={`${cellClass} text-right font-semibold text-[#232d46]`}>{formatMoney(item.inventoryValue)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            ) : <Empty>{inventoryHealth ? "No high-value inventory records." : "Inventory health data unavailable."}</Empty>}
          </Panel>

          <Panel onOpen={onOpenReport ? () => onOpenReport("supplier") : undefined} id="supplier-spend" footerLabel="View all supplier spending" title="Supplier Spend" icon={<Truck size={16} />}>
            {stockRunSpend?.bySupplier.length ? (
              <div className={styles.wasteBody}>
                <MobileInsightRecords label="Supplier spending" rows={stockRunSpend.bySupplier.map(supplier => ({
                  id: supplier.supplierId ?? supplier.supplierName, name: supplier.supplierName, fields: [
                    { label: "Lines", value: supplier.lineCount },
                    { label: "Spend", value: formatMoney(supplier.totalSpend) },
                  ],
                }))} />
                <div className={`${styles.scroll} ${styles.overviewTable}`}>
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
