"use client";
import PageSkeleton from "@/components/loading/PageSkeleton";
import SearchInput from "@/components/ui/SearchInput";
import { PermissionAction } from "@/components/auth/PermissionGuard";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import styles from "@/app/admin/alerts/alerts.module.css";
import { Search } from "lucide-react";
import AdminSelect from "@/components/admin/AdminSelect";
import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import { acknowledgeAlert, deleteResolvedAlerts, dismissAlert, fetchAlerts, type AlertRecord, type AlertState, type AlertType } from "@/lib/alerts";

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
  if (alert.state === "RESOLVED") return styles.resolved;
  if (alert.severity === "CRITICAL") return styles.critical;
  if (alert.severity === "WARNING") return styles.warning;
  return styles.info;
}

const STATE_OPTIONS: Array<{ value: AlertState | ""; label: string }> = [
  { value: "", label: "All status" },
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

export default function AlertsFeature() {
  const router = useRouter();
  const can = useAuthStore(state => state.can);
  const openingRef = useRef(false);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [stateFilter, setStateFilter] = useState<AlertState | "">("");
  const [typeFilter, setTypeFilter] = useState<AlertType | "">("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [selectingForDelete, setSelectingForDelete] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const deleteRef = useRef(false);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectionControlsRef = useRef<HTMLDivElement>(null);
  const [controlsSize, setControlsSize] = useState({ width: 0, height: 44 });
  const requestRef = useRef(0);
  const canDeleteResolved = stateFilter === "RESOLVED" && can("alerts.dismiss");
  const selectionMode = canDeleteResolved && selectingForDelete;
  useEffect(() => {
    const controls = selectionControlsRef.current;
    if (!controls) return;
    const measure = () => setControlsSize({ width: controls.getBoundingClientRect().width, height: controls.getBoundingClientRect().height });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(controls);
    return () => observer.disconnect();
  }, [canDeleteResolved]);
  const selectableIds = selectionMode ? alerts.filter(alert => alert.state === "RESOLVED").map(alert => alert.id) : [];
  const selectedVisibleIds = selectedIds.filter(id => selectableIds.includes(id));
  const allSelected = selectableIds.length > 0 && selectedVisibleIds.length === selectableIds.length;
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = selectedVisibleIds.length > 0 && !allSelected;
  }, [selectedVisibleIds.length, allSelected, selectionMode]);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = async () => {
    const request = ++requestRef.current;
    setLoading(true);
    try {
      const nextAlerts = await fetchAlerts({
        state: stateFilter || undefined,
        type: typeFilter || undefined,
        search: search || undefined,
        limit: stateFilter === "RESOLVED" ? 200 : 100,
      });
      if (request !== requestRef.current) return;
      setAlerts(nextAlerts);
      setSelectedIds(current => current.filter(id => nextAlerts.some(alert => alert.id === id && alert.state === "RESOLVED")));
      setError(null);
    } catch (nextError) {
      if (request === requestRef.current) setError(nextError instanceof Error ? nextError.message : "Failed to load alerts");
    } finally {
      if (request === requestRef.current) setLoading(false);
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

  const toggleSelected = (id: string) => {
    if (deleting || loading) return;
    setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };
  const handleDelete = async () => {
    if (!selectionMode || loading || deleteRef.current || !selectedVisibleIds.length) return;
    deleteRef.current = true;
    setDeleting(true);
    setError(null);
    try {
      await deleteResolvedAlerts(selectedVisibleIds);
      setSelectedIds([]);
      setSelectingForDelete(false);
      await loadAlerts();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to delete resolved alerts");
    } finally {
      deleteRef.current = false;
      setDeleting(false);
    }
  };

  const openAlert = async (alert: AlertRecord) => {
    if (alert.state === "RESOLVED" || openingRef.current || actionId) return;
    openingRef.current = true;
    setActionId(alert.id);
    setError(null);
    try {
      if ((alert.state === "ACTIVE" || alert.state === "DISMISSED") && can("alerts.acknowledge")) await acknowledgeAlert(alert.id);
      const params = new URLSearchParams({ view: "materials" });
      if (alert.rawMaterialId) params.set("material", alert.rawMaterialId);
      if (alert.stockBatchId) params.set("batch", alert.stockBatchId);
      if (alert.type === "LOW_STOCK" && can("stockRuns.create") && can("stockRuns.view")) params.set("action", "stock-run-create");
      else if (alert.type === "EXPIRED" && can("inventory.waste")) params.set("action", "waste");
      router.push("/inventory?" + params.toString());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to open alert");
    } finally {
      openingRef.current = false;
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
                Unread alerts stay visible until addressed. Read or dismissed alerts remain visible for 30 days after that action and sort below unread items.
              </p>
            </div>

            <div className={styles.filters}>
              <AdminSelect
                label="State"
                value={stateFilter}
                disabled={deleting}
                onChange={(value) => { setSelectingForDelete(false); setSelectedIds([]); setStateFilter(value as AlertState | ""); }}
                options={STATE_OPTIONS}
              />
              <AdminSelect
                label="Type"
                value={typeFilter}
                disabled={deleting}
                onChange={(value) => { setSelectingForDelete(false); setSelectedIds([]); setTypeFilter(value as AlertType | ""); }}
                options={TYPE_OPTIONS}
              />
              <label className={styles.searchField}>
                <span className={styles.filterLabel}>Search</span>
                <span className={styles.searchControl}>
                  <Search size={17} aria-hidden="true" />
                  <SearchInput
                    type="search"
                    value={search}
                    disabled={deleting}
                    onChange={(event) => { setSelectedIds([]); setSearch(event.target.value); }}
                    placeholder="Ex. Milk, supplier name, low stock..."
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

        {canDeleteResolved ? (
          <>
            <div className={`${styles.selectionToolbar} ${selectionMode ? styles.selectionToolbarActive : ""}`}>
              <button type="button" className={styles.deleteButton} disabled={loading || deleting || (selectionMode && !selectedVisibleIds.length)} aria-expanded={selectionMode} aria-controls="resolved-selection-controls" onClick={() => { if (!selectionMode) setSelectingForDelete(true); else void handleDelete(); }}>
                {deleting ? "Deleting…" : "Delete Alert"}
              </button>
              <div id="resolved-selection-controls" className={styles.selectionControls} style={{ "--controls-width": `${controlsSize.width}px`, "--controls-height": `${controlsSize.height}px` } as CSSProperties} inert={!selectionMode} aria-hidden={!selectionMode}>
                <div ref={selectionControlsRef} className={styles.selectionControlsInner}>
                  <label className={styles.selectionLabel}>
                    <input ref={selectAllRef} type="checkbox" checked={allSelected} disabled={loading || deleting || !selectableIds.length} onChange={(event) => setSelectedIds(event.target.checked ? selectableIds : [])} />
                    Select all
                  </label>
                  <span role="status">{selectedVisibleIds.length} selected</span>
                  <button type="button" className={styles.secondary} disabled={deleting} onClick={() => { setSelectedIds([]); setSelectingForDelete(false); }}>Cancel</button>
                </div>
              </div>
            </div>
            {selectionMode ? <p className={styles.selectionHint}>Select all applies to the alerts shown. Selected resolved alerts will be permanently deleted.</p> : null}
          </>
        ) : null}

        <section className="grid gap-4">
          {loading ? (
            <PageSkeleton page="alerts" header={false} />
          ) : alerts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500 shadow-sm">
              No alerts matched the current filters.
            </div>
          ) : (
            alerts.map((alert) => (
              <article
                key={alert.id}
                className={`${styles.alert} ${tone(alert)} ${styles.lift} ${selectionMode && selectedIds.includes(alert.id) ? styles.selected : ""} ${alert.state !== "RESOLVED" && can("inventory.view") ? styles.clickable : ""}`}
                onClick={alert.state !== "RESOLVED" && can("inventory.view") ? () => void openAlert(alert) : undefined}
                aria-busy={actionId === alert.id}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className={`${styles.alertContent} space-y-3`}>
                    <div className="flex flex-wrap items-center gap-2">
                      {selectionMode && alert.state === "RESOLVED" ? (
                        <label className={`${styles.selectionLabel} ${styles.cardCheckbox}`} onClick={(event) => event.stopPropagation()}>
                          <input type="checkbox" aria-label={`Select ${alert.title}`} checked={selectedIds.includes(alert.id)} disabled={deleting || loading} onChange={() => toggleSelected(alert.id)} />
                        </label>
                      ) : null}
                      <h2 className="text-lg font-semibold text-neutral-900">
                        {alert.state !== "RESOLVED" && can("inventory.view") ? <button type="button" className={styles.alertLink} disabled={actionId !== null} onClick={(event) => { event.stopPropagation(); void openAlert(alert); }}>{alert.title}</button> : alert.title}
                      </h2>
                      {alert.state !== "RESOLVED" ? (
                        <span className="rounded-full bg-white/70 px-3 py-1 text-[13px] font-semibold uppercase tracking-wide text-neutral-700">
                          {alert.type.replaceAll("_", " ")}
                        </span>
                      ) : null}
                      <span className="rounded-full bg-white/70 px-3 py-1 text-[13px] font-semibold uppercase tracking-wide text-neutral-700">
                        {formatAlertState(alert.state)}
                      </span>
                      {alert.state !== "RESOLVED" ? (
                        <span className="rounded-full bg-white/70 px-3 py-1 text-[13px] font-semibold uppercase tracking-wide text-neutral-700">
                          {alert.severity}
                        </span>
                      ) : null}
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
                    <div className={styles.alertDetails}>
                      <p>
                        Material: {alert.rawMaterial?.name ?? "N/A"}
                        {alert.rawMaterial?.sku ? ` • ${alert.rawMaterial.sku}` : ""}
                      </p>
                      <p>
                        Batch: {alert.stockBatch?.reference ?? (alert.stockBatchId ? alert.stockBatchId.slice(0, 8) : "N/A")} •
                        Remaining: {alert.remainingQuantity ?? "N/A"}
                      </p>
                      <p>
                        Expiry: {formatDateTime(alert.expiryDate)} • Last triggered: {formatDateTime(alert.lastTriggeredAt)}
                      </p>
                    </div>
                  </div>

                  <div className={`${styles.alertActions} flex flex-wrap gap-2`} onClick={(event) => event.stopPropagation()}>
                    {alert.state === "ACTIVE" || alert.state === "DISMISSED" ? (
                      <PermissionAction permission={"alerts.acknowledge"}><button
                        type="button"
                        disabled={actionId !== null}
                        onClick={() => void handleAction(alert.id, "acknowledge")}
                        className={styles.primary}
                      >
                        Mark as Read
                      </button></PermissionAction>
                    ) : null}
                    {alert.state === "ACTIVE" ? (
                      <PermissionAction permission={"alerts.dismiss"}><button
                        type="button"
                        disabled={actionId !== null}
                        onClick={() => void handleAction(alert.id, "dismiss")}
                        className={styles.secondary}
                      >
                        Dismiss
                      </button></PermissionAction>
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
