"use client";

import { useEffect, useState } from "react";
import styles from "./alerts.module.css";
import { Search } from "lucide-react";
import AdminSelect from "@/components/admin/AdminSelect";
import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import { acknowledgeAlert, dismissAlert, fetchAlerts, type AlertRecord, type AlertState, type AlertType } from "@/lib/alerts";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function tone(alert: AlertRecord) {
  if (alert.severity === "CRITICAL") return styles.critical;
  if (alert.severity === "WARNING") return styles.warning;
  return styles.info;
}

const STATE_OPTIONS: Array<{ value: AlertState | ""; label: string }> = [
  { value: "", label: "All states" },
  { value: "ACTIVE", label: "Active" },
  { value: "ACKNOWLEDGED", label: "Read" },
  { value: "DISMISSED", label: "Dismissed" },
  { value: "RESOLVED", label: "Resolved" },
];

const TYPE_OPTIONS: Array<{ value: AlertType | ""; label: string }> = [
  { value: "", label: "All types" },
  { value: "LOW_STOCK", label: "Low Stock" },
  { value: "NEAR_EXPIRY", label: "Near Expiry" },
  { value: "EXPIRED", label: "Expired" },
];

function formatAlertState(state: AlertState) {
  if (state === "ACKNOWLEDGED") return "READ";
  return state.replaceAll("_", " ");
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [stateFilter, setStateFilter] = useState<AlertState | "">("");
  const [typeFilter, setTypeFilter] = useState<AlertType | "">("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const nextAlerts = await fetchAlerts({
        state: stateFilter || undefined,
        type: typeFilter || undefined,
        search: search || undefined,
        limit: 100,
      });
      setAlerts(nextAlerts);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAlerts();
  }, [stateFilter, typeFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAlerts();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search]);

  const handleAction = async (alertId: string, action: "acknowledge" | "dismiss") => {
    setActionId(alertId);
    try {
      if (action === "acknowledge") {
        await acknowledgeAlert(alertId);
      } else {
        await dismissAlert(alertId);
      }
      // Re-fetch after the mutation so the list reflects the server state,
      // including any alert reevaluation or ordering changes.
      await loadAlerts();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to update alert");
    } finally {
      setActionId(null);
    }
  };

  return (
    <AdminDashboardLayout showHeader={false}>
      <div className={styles.workspace}>
        <section className={styles.header}>
          <div className={styles.headerContent}>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Operational Alerts</h1>
              <p className="mt-2 text-neutral-600">
                Review low-stock and expiry events generated from stock activity and scheduled reevaluation.
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Unread alerts stay visible until addressed. Read or dismissed alerts remain visible for 30 days and sort below unread items.
              </p>
            </div>

            <div className={styles.filters}>
              <AdminSelect
                label="State"
                value={stateFilter}
                onChange={(value) => setStateFilter(value as AlertState | "")}
                options={STATE_OPTIONS}
              />
              <AdminSelect
                label="Type"
                value={typeFilter}
                onChange={(value) => setTypeFilter(value as AlertType | "")}
                options={TYPE_OPTIONS}
              />
              <label className={styles.searchField}>
                <span className={styles.filterLabel}>Search</span>
                <span className={styles.searchControl}>
                  <Search size={17} aria-hidden="true" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Material, supplier, alert title..."
                    className={styles.searchInput}
                  />
                </span>
              </label>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500 shadow-sm">
              Loading alerts...
            </div>
          ) : alerts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500 shadow-sm">
              No alerts matched the current filters.
            </div>
          ) : (
            alerts.map((alert) => (
              <article
                key={alert.id}
                className={`${styles.alert} ${tone(alert)}`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-neutral-900">{alert.title}</h2>
                      <span className="rounded-full bg-white/70 px-3 py-1 text-[13px] font-semibold uppercase tracking-wide text-neutral-700">
                        {alert.type.replaceAll("_", " ")}
                      </span>
                      <span className="rounded-full bg-white/70 px-3 py-1 text-[13px] font-semibold uppercase tracking-wide text-neutral-700">
                        {formatAlertState(alert.state)}
                      </span>
                      <span className="rounded-full bg-white/70 px-3 py-1 text-[13px] font-semibold uppercase tracking-wide text-neutral-700">
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-700">{alert.message}</p>
                    {alert.acknowledgedAt ? (
                      <p className="text-xs font-medium text-neutral-600">
                        Marked as read: <time dateTime={alert.acknowledgedAt}>{formatDateTime(alert.acknowledgedAt)}</time>
                      </p>
                    ) : null}
                    {alert.dismissedAt ? (
                      <p className="text-xs font-medium text-neutral-600">
                        Dismissed: <time dateTime={alert.dismissedAt}>{formatDateTime(alert.dismissedAt)}</time>
                      </p>
                    ) : null}
                    <div className="grid gap-1 text-xs text-neutral-500">
                      <p>
                        Material: {alert.rawMaterial?.name ?? "N/A"}
                        {alert.rawMaterial?.sku ? ` • ${alert.rawMaterial.sku}` : ""}
                      </p>
                      <p>
                        Batch: {alert.stockBatchId ? alert.stockBatchId.slice(0, 8) : "N/A"} •
                        Remaining: {alert.remainingQuantity ?? "N/A"}
                      </p>
                      <p>
                        Expiry: {formatDateTime(alert.expiryDate)} • Last triggered: {formatDateTime(alert.lastTriggeredAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    {alert.state === "ACTIVE" || alert.state === "DISMISSED" ? (
                      <button
                        type="button"
                        disabled={actionId === alert.id}
                        onClick={() => void handleAction(alert.id, "acknowledge")}
                        className={styles.primary}
                      >
                        Mark as Read
                      </button>
                    ) : null}
                    {alert.state === "ACTIVE" ? (
                      <button
                        type="button"
                        disabled={actionId === alert.id}
                        onClick={() => void handleAction(alert.id, "dismiss")}
                        className={styles.secondary}
                      >
                        Dismiss
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </AdminDashboardLayout>
  );
}
