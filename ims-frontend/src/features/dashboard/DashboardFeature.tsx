"use client";
import WorkspaceLoading from "@/components/admin/WorkspaceLoading";
import { useAuthStore } from "@/store/authStore";
import { loadIfAllowed } from "@/lib/permission-loading";
import { PermissionAction } from "@/components/auth/PermissionGuard";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Clock3,
} from "lucide-react";
import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import InventoryReportModal from "@/components/admin/inventory/InventoryReportModal";
import AdminSelect from "@/components/admin/AdminSelect";
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
import styles from "@/app/admin/dashboard/dashboard.module.css";

const WASTE_COLORS = ["#232d46", "#47749e", "#548780", "#8996aa"];

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

export default function DashboardFeature() {
  const canViewReports = useAuthStore(state => state.can("reports.view"));
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
  const range = useMemo(() => defaultReportRange(
    salesPeriod === "Last 7 Days" ? 7 : salesPeriod === "Last 90 Days" ? 90 : 30,
  ), [salesPeriod]);

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
    let active = true;

    void (async () => {
      setLoading(true);
      try {
        const results = await Promise.allSettled([
            loadIfAllowed("reports.view", () => fetchSalesOverview({ ...range, limit: 5 }), null),
            loadIfAllowed("reports.view", () => fetchInventoryHealth({ limit: 5 }), null),
            loadIfAllowed("reports.view", () => fetchStockRunSpend({ ...range, limit: 5 }), null),
            loadIfAllowed("reports.view", () => fetchWasteSummary({ ...range, limit: 5, includeAllGroups: true }), null),
            loadIfAllowed("suppliers.view", () => fetchSuppliers(), []),
            loadIfAllowed("alerts.view", () => fetchAlerts({ state: "ACTIVE", limit: 5 }), []),
          ]);

        if (!active) return;
        const [sales, health, spend, waste, suppliers, alerts] = results;
        setSalesOverview(sales.status === "fulfilled" ? sales.value : null);
        setInventoryHealth(health.status === "fulfilled" ? health.value : null);
        setStockRunSpend(spend.status === "fulfilled" ? spend.value : null);
        setWasteSummary(waste.status === "fulfilled" ? waste.value : null);
        setSupplierCount(suppliers.status === "fulfilled" ? suppliers.value.length : 0);
        setActiveAlerts(alerts.status === "fulfilled" ? alerts.value : []);
        const failure = results.find((result) => result.status === "rejected");
        if (failure?.status === "rejected") throw failure.reason;
        setError(null);
      } catch (nextError) {
        if (!active) return;
        setError(nextError instanceof Error ? nextError.message : "Failed to load dashboard");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [range]);

  const wasteGradient = useMemo(() => {
    const rows = wasteSummary?.byReason ?? [];
    const total = rows.reduce((sum, row) => sum + Number(row.cost), 0);
    if (!total) return "conic-gradient(#d1d5db 0 100%)";
    let cursor = 0;
    const colors = WASTE_COLORS;
    return `conic-gradient(${rows.map((row, index) => { const start = cursor; cursor += (Number(row.cost) / total) * 100; return `${colors[index % colors.length]} ${start}% ${cursor}%`; }).join(",")})`;
  }, [wasteSummary]);

  if (loading) return <WorkspaceLoading page="dashboard" />;

  return (
    <AdminDashboardLayout showHeader={false} whiteTop>
      <div className={styles.dashboard}>
      <AdminSectionHeader className="mb-6" title="Dashboard" description="Welcome back! Here's your inventory overview." />
      {!canViewReports && <p className="rounded-xl border border-slate-200 bg-white p-5">Report summaries are unavailable with your current permissions. Use the navigation to open your available features.</p>}
      {error ? (
        <div className={styles.error}>
          {error}
        </div>
      ) : null}

<PermissionAction permission="reports.view"><section className={styles.inventoryOverview} aria-label="Inventory overview" aria-busy={loading}>
        <dl className={styles.inventoryCards}>
          {[
            { label: "Total materials", value: inventoryHealth?.summary.totalMaterials, detail: "Materials in your catalog" },
            { label: "In stock", value: inventoryHealth?.summary.inStockCount, detail: "Stock available" },
            { label: "Low stock", value: inventoryHealth?.summary.lowStockCount, detail: "At or below reorder level" },
            { label: "Out of stock", value: inventoryHealth?.summary.outOfStockCount, detail: "No stock available" },
          ].map(({ label, value, detail }) => (
            <div key={label} className={styles.inventoryCard}>
              <dt className={styles.cardLabel}><span>{label}</span></dt>
              <dd className={styles.cardValue}>{loading ? <span className={styles.skeleton} aria-label="Loading" /> : value == null ? "\u2014" : value.toLocaleString("en-PH")}</dd>
              <dd className={styles.cardDetail}>{detail}</dd>
            </div>
          ))}
          <div className={`${styles.inventoryCard} ${styles.valueCard}`}>
            <dt className={styles.cardLabel}><span>Inventory value</span></dt>
            <dd className={styles.cardValue}>{loading ? <span className={styles.skeleton} aria-label="Loading" /> : inventoryHealth ? formatPeso(inventoryHealth.summary.totalInventoryValue) : "\u2014"}</dd>
            <dd className={styles.cardDetail}>Total value of stock on hand</dd>
          </div>
        </dl>
      </section></PermissionAction>

      <PermissionAction permission="reports.view"><section className={styles.row}>
        <div className={`${styles.panel} ${styles.topSellingPanel}`}>
          <div className={styles.panelHeader}><h2 className={styles.panelTitle}>Top-Selling Variants</h2><AdminSelect label="Date range" value={salesPeriod} onChange={setSalesPeriod} options={[{ value: "Last 7 Days", label: "Last 7 Days" }, { value: "Last 30 Days", label: "Last 30 Days" }, { value: "Last 90 Days", label: "Last 90 Days" }]} /></div>
          <div className={`${styles.panelBody} ${styles.topSellingScroll}`} tabIndex={0} role="region" aria-label="Top-selling variants"><div className={styles.list}>
            {(salesOverview?.topVariants ?? []).map((variant) => (
              <div
                key={variant.productVariantId}
                className={styles.item}
              >
                <div className={styles.itemMain}>
                  <div>
                    <p className={styles.itemName}>
                      {variant.productName} &bull; {variant.variantName}
                    </p>
                    <p className={styles.muted}>{variant.sku}</p>
                  </div>
                  <div>
                    <p className={styles.itemValue}>
                      {formatPeso(variant.revenue)}
                    </p>
                    <p className={styles.itemMeta}>
                      {variant.quantitySold} sold &bull;{" "}
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
      </section></PermissionAction>
      <PermissionAction permission="reports.view"><section className={styles.rowThree}>

        <div className={styles.panel}><div className={styles.panelHeader}><h2 className={styles.panelTitle}>Near Expiry Watchlist</h2><button className={styles.viewAll} type="button" onClick={() => setActiveModal("expiry")}>View All</button></div><div className={styles.panelBody}><div className={styles.list}>
            {(inventoryHealth?.nearExpiryBatches ?? []).slice(0, 3).map((batch) => (
              <div
                key={batch.id}
                className={styles.item}
              >
                <div className={styles.itemMain}>
                  <p className={styles.itemName}>{batch.rawMaterial.name}</p>
                  <Clock3 size={18} className={styles.watchIcon} />
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

        <div className={styles.panel}><div className={styles.panelHeader}><h2 className={styles.panelTitle}>Waste Reason</h2><button className={styles.viewAll} type="button" onClick={() => setActiveModal("waste")}>View All</button></div><div className={styles.panelBody}><div className={styles.donutWrap}><div className={styles.donut} role="img" style={{ background: wasteGradient }} aria-label="Waste reason breakdown" /><div className={styles.legend}>{!wasteSummary?.byReason.length && <p className={styles.muted}>{loading ? "Loading waste records..." : "No waste records in this period."}</p>}
            {(wasteSummary?.byReason ?? []).map((reason, index, rows) => { const total = rows.reduce((sum, item) => sum + Number(item.cost), 0); const percentage = total ? (Number(reason.cost) / total) * 100 : 0; return <div key={reason.reasonCode} className={styles.legendRow}><span><i className={styles.legendDot} style={{ backgroundColor: WASTE_COLORS[index % WASTE_COLORS.length] }} />{reason.reasonCode.replaceAll("_", " ")}</span><strong>{percentage.toFixed(0)}% &middot; {formatPeso(reason.cost)}</strong></div>; })}
          </div></div><p className={styles.totalWaste}>Total Waste Cost <strong>{formatPeso(wasteSummary?.totals.cost ?? "0")}</strong></p></div></div>

        <div className={styles.panel}><div className={styles.panelHeader}><h2 className={styles.panelTitle}>Recent Orders</h2><button className={styles.viewAll} type="button" onClick={() => setActiveModal("orders")}>View All</button></div><div className={styles.panelBody}><div className={styles.orderTable}><div className={styles.orderHead}><span>Order / staff</span><span>Date / status</span><span>Amount</span></div>
            {(salesOverview?.recentOrders ?? []).slice(0, 5).map((order) => (
              <div
                key={order.id}
                className={styles.orderRow}
              >
                <div><span title={order.id}>{order.id.slice(0, 8)}</span><small>{order.createdBy.firstName}</small></div><div><span>{formatDate(order.completedAt)}</span><span className={styles.statusBadge}>Completed</span></div><strong>{formatPeso(order.totalAmount)}</strong>
              </div>
            ))}
          </div></div></div>
      </section></PermissionAction>
      <PermissionAction permission="alerts.view"><section className={styles.alertPanel}>
        <div className={styles.alertHeader}>
          <h2><Bell size={15} /> Alerts</h2>
          <a className={styles.viewAll} href="/alerts">View All</a>
        </div>
        <div className={styles.alertList}>
          {activeAlerts.length === 0 ? <div className={styles.empty}>No active alerts.</div> : activeAlerts.map((alert) => (
            <article key={alert.id} className={styles.alertRow}>
              <div className={styles.alertIcon}><AlertTriangle size={14} /></div>
              <div className={styles.alertContent}>
                <strong>{alert.title}</strong>
                <span>{alert.message}</span>
                <small>Material: {alert.rawMaterial?.name ?? "N/A"} &middot; Batch: {alert.stockBatch?.reference ?? alert.stockBatch?.id.slice(0, 8) ?? "N/A"} &middot; Expiry: {formatDate(alert.expiryDate)}</small>
              </div>
              <div className={styles.alertTags}>
                <span className={styles.alertTagWarning}>{alert.type.replaceAll("_", " ")}</span>
                <span className={styles.alertTagActive}>{alert.state}</span>
                <span className={styles.alertTagSeverity}>{alert.severity}</span>
              </div>
              <div className={styles.alertActions}>
                <PermissionAction permission={"alerts.acknowledge"}><button type="button" onClick={() => void updateAlert(alert.id, "acknowledge")}>Mark as Read</button></PermissionAction>
                <PermissionAction permission={"alerts.dismiss"}><button type="button" onClick={() => void updateAlert(alert.id, "dismiss")}>Dismiss</button></PermissionAction>
              </div>
              <time>{formatDateTime(alert.lastTriggeredAt)}</time>
            </article>
          ))}
        </div>
      </section></PermissionAction>

      {activeModal && <PermissionAction permission="reports.view"><InventoryReportModal
        className={styles.detailModal}
        title={activeModal === "orders" ? "Recent Orders" : activeModal === "expiry" ? "Near Expiry Watchlist" : "Waste Breakdown"}
        description={activeModal === "orders" ? "Recent orders from the selected sales period." : activeModal === "expiry" ? "Review remaining quantities and expiry dates for the batches returned by the inventory report." : "Waste events and costs grouped by reason for the dashboard reporting period."}
        onClose={() => setActiveModal(null)}>
        <div className={styles.detailScroll}>
          <table className={styles.detailTable}>
            <thead><tr>{(activeModal === "orders" ? ["Order ID", "Staff", "Date & time", "Amount"] : activeModal === "expiry" ? ["Material", "Expiry date", "Remaining quantity"] : ["Reason", "Events", "Waste cost"]).map((label, index, labels) => <th key={label} scope="col" className={index === labels.length - 1 ? styles.numeric : undefined}>{label}</th>)}</tr></thead>
            <tbody>
              {activeModal === "orders" && (salesOverview?.recentOrders ?? []).map(order => <tr key={order.id}><td className={styles.identifier}>{order.id}</td><td>{order.createdBy.firstName}</td><td>{formatDateTime(order.completedAt)}</td><td className={styles.numeric}>{formatPeso(order.totalAmount)}</td></tr>)}
              {activeModal === "expiry" && (inventoryHealth?.nearExpiryBatches ?? []).map(batch => <tr key={batch.id}><td>{batch.rawMaterial.name}</td><td>{formatDate(batch.expirationDate)}</td><td className={styles.numeric}>{Number(batch.remainingQuantity).toLocaleString("en-PH", { maximumFractionDigits: 4 })}</td></tr>)}
              {activeModal === "waste" && (wasteSummary?.byReason ?? []).map(reason => <tr key={reason.reasonCode}><td>{reason.reasonCode.replaceAll("_", " ")}</td><td>{reason.eventCount}</td><td className={styles.numeric}>{formatPeso(reason.cost)}</td></tr>)}
              {(activeModal === "orders" ? !salesOverview?.recentOrders.length : activeModal === "expiry" ? !inventoryHealth?.nearExpiryBatches.length : !wasteSummary?.byReason.length) && <tr><td colSpan={activeModal === "orders" ? 4 : 3}>{loading ? "Loading records..." : "No records available for this report."}</td></tr>}
            </tbody>
          </table>
        </div>
        <footer className={styles.modalFooter}>
          <a className={styles.workspaceLink} href={activeModal === "orders" ? "/reports/pos" : activeModal === "expiry" ? "/inventory" : "/reports/inventory"}>Open full workspace <ArrowRight size={18} aria-hidden="true" /></a>
        </footer>
      </InventoryReportModal></PermissionAction>}
      </div>
    </AdminDashboardLayout>
  );
}
