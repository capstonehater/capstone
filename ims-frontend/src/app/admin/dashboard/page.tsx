"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Clock3,
} from "lucide-react";
import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import { acknowledgeAlert, dismissAlert, fetchAlerts, type AlertRecord } from "@/lib/alerts";
import {
  fetchInventoryHealth,
  fetchSalesOverview,
  fetchStockRunSpend,
  fetchWasteSummary,
  type InventoryHealthReport,
  type SalesOverviewReport,
  type StockRunSpendReport,
  type WasteSummaryReport,
} from "@/lib/reports";
import { formatDateTime, formatPeso } from "@/lib/pos-utils";
import { fetchSuppliers } from "@/lib/inventory";
import styles from "./dashboard.module.css";

function formatDate(value: string | null | undefined) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function defaultReportRange(days = 30) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - days);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salesOverview, setSalesOverview] = useState<SalesOverviewReport | null>(null);
  const [inventoryHealth, setInventoryHealth] = useState<InventoryHealthReport | null>(null);
  const [stockRunSpend, setStockRunSpend] = useState<StockRunSpendReport | null>(null);
  const [wasteSummary, setWasteSummary] = useState<WasteSummaryReport | null>(null);
  const [supplierCount, setSupplierCount] = useState(0);
  const [salesPeriod, setSalesPeriod] = useState("Last 30 Days");
  const [activeModal, setActiveModal] = useState<"orders" | "expiry" | "waste" | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<AlertRecord[]>([]);

  async function updateAlert(alertId: string, action: "acknowledge" | "dismiss") {
    try {
      if (action === "acknowledge") await acknowledgeAlert(alertId);
      else await dismissAlert(alertId);
      const refreshedAlerts = await fetchAlerts({ state: "ACTIVE", limit: 5 });
      setActiveAlerts(refreshedAlerts);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to update alert");
    }
  }

  useEffect(() => {
    const range = defaultReportRange(salesPeriod === "Last 7 Days" ? 7 : salesPeriod === "Last 90 Days" ? 90 : 30);

    void (async () => {
      setLoading(true);
      try {
        const [nextSalesOverview, nextInventoryHealth, nextStockRunSpend, nextWasteSummary, suppliers] =
          await Promise.all([
            fetchSalesOverview({ ...range, limit: 5 }),
            fetchInventoryHealth({ limit: 5 }),
            fetchStockRunSpend({ ...range, limit: 5 }),
            fetchWasteSummary({ ...range, limit: 5 }),
            fetchSuppliers(),
          ]);
        const nextAlerts = await fetchAlerts({ state: "ACTIVE", limit: 5 });

        setSalesOverview(nextSalesOverview);
        setInventoryHealth(nextInventoryHealth);
        setStockRunSpend(nextStockRunSpend);
        setWasteSummary(nextWasteSummary);
        setSupplierCount(suppliers.length);
        setActiveAlerts(nextAlerts);
        setError(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [salesPeriod]);

  const wasteGradient = useMemo(() => {
    const rows = wasteSummary?.byReason ?? [];
    const total = rows.reduce((sum, row) => sum + Number(row.cost), 0);
    if (!total) return "conic-gradient(#d1d5db 0 100%)";
    let cursor = 0;
    const colors = ["#f45a1f", "#f6b73c", "#2774c9", "#9ca3af"];
    return `conic-gradient(${rows.map((row, index) => { const start = cursor; cursor += (Number(row.cost) / total) * 100; return `${colors[index % colors.length]} ${start}% ${cursor}%`; }).join(",")})`;
  }, [wasteSummary]);

  return (
    <AdminDashboardLayout>
      <div className={styles.dashboard}>
      {error ? (
        <div className={styles.error}>
          {error}
        </div>
      ) : null}

      <section className={styles.overview}>
        <div className={styles.overviewStats}>
          <div><span>Materials</span><strong>{loading ? "..." : inventoryHealth?.summary.totalMaterials ?? 0}</strong></div>
          <div><span>In stock</span><strong>{loading ? "..." : inventoryHealth?.summary.inStockCount ?? 0}</strong></div>
          <div><span>Low stock</span><strong>{loading ? "..." : inventoryHealth?.summary.lowStockCount ?? 0}</strong></div>
          <div><span>Out of stock</span><strong>{loading ? "..." : inventoryHealth?.summary.outOfStockCount ?? 0}</strong></div>
          <div><span>Inventory value</span><strong>{loading ? "..." : formatPeso(inventoryHealth?.summary.totalInventoryValue ?? "0")}</strong></div>
        </div>
      </section>

      <section className={styles.row}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}><h2 className={styles.panelTitle}>Top-Selling Variants</h2><select className={styles.periodSelect} value={salesPeriod} onChange={(event) => setSalesPeriod(event.target.value)} aria-label="Top-selling period"><option>Last 30 Days</option><option>Last 7 Days</option><option>Last 90 Days</option></select></div>
          <div className={styles.panelBody}><div className={styles.list}>
            {(salesOverview?.topVariants ?? []).map((variant) => (
              <div
                key={variant.productVariantId}
                className={styles.item}
              >
                <div className={styles.itemMain}>
                  <div>
                    <p className={styles.itemName}>
                      {variant.productName} • {variant.variantName}
                    </p>
                    <p className={styles.muted}>{variant.sku}</p>
                  </div>
                  <div>
                    <p className={styles.itemValue}>
                      {formatPeso(variant.revenue)}
                    </p>
                    <p className={styles.itemMeta}>
                      {variant.quantitySold} sold •{" "}
                      {(variant.marginRate * 100).toFixed(1)}% margin
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </div>
        </div>

        <div className={styles.panel}><div className={styles.panelHeader}><h2 className={styles.panelTitle}>Stock-Run Spend</h2></div><div className={styles.panelBody}><div className={styles.metricGrid}>
            <div className={styles.metric}>
              <p className={styles.metricLabel}>Posted Spend</p>
              <p className={styles.metricValue}>
                {formatPeso(stockRunSpend?.totals.totalSpend ?? "0")}
              </p>
            </div>

            <div className={styles.metric}>
              <p className={styles.metricLabel}>Average Run Cost</p>
              <p className={styles.metricValue}>
                {formatPeso(stockRunSpend?.totals.averageRunCost ?? "0")}
              </p>
            </div>

            <div className={styles.metric}>
              <p className={styles.metricLabel}>Posted Runs</p>
              <p className={styles.metricValue}>
                {stockRunSpend?.totals.runCount ?? 0}
              </p>
            </div>
            <div className={styles.metric}><p className={styles.metricLabel}>Total Suppliers</p><p className={styles.metricValue}>{loading ? "..." : supplierCount}</p></div>
          </div></div></div>
      </section>
      <section className={styles.rowThree}>

        <div className={styles.panel}><div className={styles.panelHeader}><h2 className={styles.panelTitle}>Near Expiry Watchlist</h2><button className={styles.viewAll} type="button" onClick={() => setActiveModal("expiry")}>View All</button></div><div className={styles.panelBody}><div className={styles.list}>
            {(inventoryHealth?.nearExpiryBatches ?? []).slice(0, 3).map((batch) => (
              <div
                key={batch.id}
                className={styles.item}
              >
                <div className={styles.itemMain}>
                  <p className={styles.itemName}>{batch.rawMaterial.name}</p>
                  <Clock3 size={18} className="text-[#f45a1f]" />
                </div>
                <p className={styles.muted}>
                  Expiry: {formatDate(batch.expirationDate)}
                </p>
                <p className={styles.muted}>
                  Remaining: {batch.remainingQuantity}
                </p>
              </div>
            ))}
          </div></div></div>

        <div className={styles.panel}><div className={styles.panelHeader}><h2 className={styles.panelTitle}>Waste Reason</h2><button className={styles.viewAll} type="button" onClick={() => setActiveModal("waste")}>View All</button></div><div className={styles.panelBody}><div className={styles.donutWrap}><div className={styles.donut} style={{ background: wasteGradient }} aria-label="Waste reason breakdown" /><div className={styles.legend}>
            {(wasteSummary?.byReason ?? []).map((reason, index, rows) => { const total = rows.reduce((sum, item) => sum + Number(item.cost), 0); const percentage = total ? (Number(reason.cost) / total) * 100 : 0; return <div key={reason.reasonCode} className={styles.legendRow}><span><i className={styles.legendDot} />{reason.reasonCode}</span><strong>{percentage.toFixed(0)}% · {formatPeso(reason.cost)}</strong></div>; })}
          </div></div><p className={styles.totalWaste}>Total Waste Cost <strong>{formatPeso(wasteSummary?.totals.cost ?? "0")}</strong></p></div></div>

        <div className={styles.panel}><div className={styles.panelHeader}><h2 className={styles.panelTitle}>Recent Orders</h2><button className={styles.viewAll} type="button" onClick={() => setActiveModal("orders")}>View All</button></div><div className={styles.panelBody}><div className={styles.orderTable}><div className={styles.orderHead}><span>Order ID</span><span>Staff</span><span>Date</span><span>Status</span><span>Amount</span></div>
            {(salesOverview?.recentOrders ?? []).slice(0, 5).map((order) => (
              <div
                key={order.id}
                className={styles.orderRow}
              >
                <span title={order.id}>{order.id.slice(0, 8)}</span><span>{order.createdBy.firstName}</span><span>{formatDate(order.completedAt)}</span><span className={styles.statusBadge}>Completed</span><strong>{formatPeso(order.totalAmount)}</strong>
              </div>
            ))}
          </div></div></div>
      </section>
      <section className={styles.alertPanel}>
        <div className={styles.alertHeader}>
          <h2><Bell size={15} /> Alerts</h2>
          <a className={styles.viewAll} href="/admin/alerts">View All</a>
        </div>
        <div className={styles.alertList}>
          {activeAlerts.length === 0 ? <div className={styles.empty}>No active alerts.</div> : activeAlerts.map((alert) => (
            <article key={alert.id} className={styles.alertRow}>
              <div className={styles.alertIcon}><AlertTriangle size={14} /></div>
              <div className={styles.alertContent}>
                <strong>{alert.title}</strong>
                <span>{alert.message}</span>
                <small>Material: {alert.rawMaterial?.name ?? "N/A"} · Batch: {alert.stockBatch?.id.slice(0, 8) ?? "N/A"} · Expiry: {formatDate(alert.expiryDate)}</small>
              </div>
              <div className={styles.alertTags}>
                <span className={styles.alertTagWarning}>{alert.type.replaceAll("_", " ")}</span>
                <span className={styles.alertTagActive}>{alert.state}</span>
                <span className={styles.alertTagSeverity}>{alert.severity}</span>
              </div>
              <div className={styles.alertActions}>
                <button type="button" onClick={() => void updateAlert(alert.id, "acknowledge")}>Mark as Read</button>
                <button type="button" onClick={() => void updateAlert(alert.id, "dismiss")}>Dismiss</button>
              </div>
              <time>{formatDateTime(alert.lastTriggeredAt)}</time>
            </article>
          ))}
        </div>
      </section>

      {activeModal ? <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setActiveModal(null)}><section className={styles.modal} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className={styles.modalHeader}><h2>{activeModal === "orders" ? "Recent Orders" : activeModal === "expiry" ? "Near Expiry Watchlist" : "Waste Breakdown"}</h2><button type="button" className={styles.modalClose} onClick={() => setActiveModal(null)} aria-label="Close">×</button></div><p className={styles.muted}>Live dashboard details</p>{activeModal === "orders" ? <div className={styles.modalList}>{(salesOverview?.recentOrders ?? []).map((order) => <div className={styles.modalRow} key={order.id}><strong>{order.id}</strong><span>{formatDateTime(order.completedAt)}</span><span>{formatPeso(order.totalAmount)}</span></div>)}</div> : activeModal === "expiry" ? <div className={styles.modalList}>{(inventoryHealth?.nearExpiryBatches ?? []).map((batch) => <div className={styles.modalRow} key={batch.id}><strong>{batch.rawMaterial.name}</strong><span>{formatDate(batch.expirationDate)}</span><span>{batch.remainingQuantity}</span></div>)}</div> : <div className={styles.modalList}>{(wasteSummary?.byReason ?? []).map((reason) => <div className={styles.modalRow} key={reason.reasonCode}><strong>{reason.reasonCode}</strong><span>{reason.eventCount} events</span><span>{formatPeso(reason.cost)}</span></div>)}</div>}<a className={styles.modalRoute} href={activeModal === "orders" ? "/admin/reports/pos" : activeModal === "expiry" ? "/admin/inventory" : "/admin/reports/inventory"}>Open full workspace →</a></section></div> : null}
      </div>
    </AdminDashboardLayout>
  );
}
