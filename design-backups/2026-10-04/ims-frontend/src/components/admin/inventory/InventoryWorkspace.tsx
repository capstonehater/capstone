"use client";
import { loadIfAllowed } from "@/lib/permission-loading";
import { useAuthStore } from "@/store/authStore";
import { PermissionAction } from "@/components/auth/PermissionGuard";

import AdminSectionHeader from "@/components/admin/AdminSectionHeader";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Plus,
} from "lucide-react";
import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import BatchTransactionModal from "@/components/admin/inventory/BatchTransactionModal";
import InventoryBusinessInsights from "@/components/admin/inventory/InventoryBusinessInsights";
import MaterialDetailPanel from "@/components/admin/inventory/MaterialDetailPanel";
import RawMaterialModals from "@/components/admin/inventory/RawMaterialModals";
import StockRunModals from "@/components/admin/inventory/StockRunModals";
import StockRunsPanel from "@/components/admin/inventory/StockRunsPanel";
import InventorySummaryPanel from "@/components/admin/inventory/InventorySummaryPanel";
import StoreAvailabilityModal from "@/components/admin/inventory/StoreAvailabilityModal";
import WasteModal from "@/components/admin/inventory/WasteModal";
import InventoryReportModal from "./InventoryReportModal";
import ActionAlert from "@/components/feedback/ActionAlert";
import { getDefaultWasteReasonCode } from "@/lib/inventory-reason-options";
import {
  addStockRunItem,
  archiveRawMaterial,
  createInventoryWaste,
  createRawMaterial,
  createStockRun,
  deleteStockRun,
  deleteStockRunItem,
  fetchInventorySummary,
  fetchRawMaterial,
  fetchRawMaterialBatches,
  fetchRawMaterialTransactions,
  fetchStockBatchTransactions,
  fetchStockRun,
  fetchStockRuns,
  fetchSuppliers,
  fetchUnits,
  postStockRun,
  updateRawMaterial,
  type InventorySummaryItem,
  type InventoryTransaction,
  type InventoryUnit,
  type RawMaterial,
  type StockBatch,
  type StockRun,
  type Supplier,
} from "@/lib/inventory";
import {
  fetchInventoryHealth,
  fetchStockRunSpend,
  fetchWasteSummary,
  type InventoryHealthReport,
  type StockRunSpendReport,
  type WasteSummaryReport,
} from "@/lib/reports";
import { useInventoryStore } from "@/store/inventoryStore";
import styles from "./InventoryWorkspace.module.css";

const LowStockPanel = dynamic(() => import("./LowStockPanel"), { loading: () => <p role="status">Loading low-stock report...</p> });
const NearExpiryPanel = dynamic(() => import("./NearExpiryPanel"), { loading: () => <p role="status">Loading expiry report...</p> });
const InsightPanel = dynamic(() => import("./InventoryInsightPage"), { loading: () => <p role="status">Loading report...</p> });
const workspaceSections = [
  ["overview", "Overview"], ["materials", "Materials"], ["stock-runs", "Stock Runs"],
] as const;
type SectionView = typeof workspaceSections[number][0];
type ReportView = "low-stock" | "near-expiry" | "waste" | "value" | "supplier";
export type InventoryView = SectionView | ReportView;
const reportDescriptions: Record<ReportView, string> = {"near-expiry":"Batches with remaining stock expiring within 14 days, including expired stock. Each batch is listed separately.","waste":"All recorded waste grouped by reason, with total quantities and costs.","supplier":"All posted stock-run spending grouped by supplier.","low-stock":"Active materials with usable stock above zero and at or below their reorder point.","value":"All active materials with usable stock and inventory value."};
const reportTitles: Record<ReportView, string> = { "low-stock": "Low Stock Materials", "near-expiry": "Near Expiry Materials", waste: "Waste Insights", value: "High-Value Inventory", supplier: "Supplier Spend" };

type PanelMode =
  | null
  | "create-material"
  | "edit-material"
  | "stock-run-create"
  | "stock-run-manage"
  | "waste"
  | "archive-material"
  | "delete-draft";

type MaterialFormState = {
  name: string;
  sku: string;
  unitId: string;
  reorderPoint: string;
};

type WasteFormState = {
  rawMaterialId: string;
  batchId: string;
  quantity: string;
  reasonCode: string;
  note: string;
};

type StockRunFormState = {
  name: string;
  notes: string;
};

type StockRunItemFormState = {
  rawMaterialId: string;
  supplierId: string;
  quantity: string;
  costPerUnit: string;
  expirationDate: string;
  receivedAt: string;
  note: string;
};

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

const quantityFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

function defaultMaterialForm(material?: RawMaterial | null, unitId?: string): MaterialFormState {
  return {
    name: material?.name ?? "",
    sku: material?.sku ?? "",
    unitId: material?.unitId ?? unitId ?? "",
    reorderPoint: material?.reorderPoint ?? "0",
  };
}

function defaultWasteForm(rawMaterialId?: string | null): WasteFormState {
  return {
    rawMaterialId: rawMaterialId ?? "",
    batchId: "",
    quantity: "",
    reasonCode: getDefaultWasteReasonCode(),
    note: "",
  };
}

function formatMoney(value: string) {
  return currencyFormatter.format(Number(value));
}

function formatQuantity(value: string) {
  return quantityFormatter.format(Number(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

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

function getTransactionDelta(transaction: InventoryTransaction) {
  return transaction.lines.reduce((sum, line) => sum + Number(line.quantityDelta), 0);
}

function getTransactionCost(transaction: InventoryTransaction) {
  return transaction.lines.reduce((sum, line) => sum + Number(line.totalCostDelta), 0);
}

export default function InventoryWorkspace({ initialView = "overview", initialDraftId, initialAction }: { initialView?: InventoryView; initialDraftId?: string; initialAction?: "create-material" | "stock-run-create" | "waste" }) {
  const canViewReports = useAuthStore(state => state.can("reports.view"));
  const canViewStockRuns = useAuthStore(state => state.can("stockRuns.view"));
  const sectionNavRef = useRef<HTMLElement>(null);
  const [activeSection, setActiveSection] = useState<SectionView>("overview");
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const threshold = (sectionNavRef.current?.getBoundingClientRect().bottom ?? 72) + 24;
      let current: SectionView = "overview";
      for (const [id] of workspaceSections) {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= threshold) current = id;
      }
      if (document.getElementById("stock-runs") && window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = "stock-runs";
      setActiveSection(current);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    for (const [id] of workspaceSections) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  const [reportRevision, setReportRevision] = useState(0);
  const [report, setReport] = useState<ReportView | null>(initialView in reportTitles ? initialView as ReportView : null);
  useEffect(() => {
    if (initialView === "materials" || initialView === "stock-runs") {
      document.getElementById(initialView)?.scrollIntoView({ block: "start" });
    }
  }, [initialView]);
  const router = useRouter();
  const search = useInventoryStore((state) => state.search);
  const statusFilter = useInventoryStore((state) => state.statusFilter);
  const supplierId = useInventoryStore((state) => state.supplierId);
  const selectedRawMaterialId = useInventoryStore((state) => state.selectedRawMaterialId);
  const activePanel = useInventoryStore((state) => state.activePanel) as PanelMode;
  const historyType = useInventoryStore((state) => state.historyType);
  const historyFrom = useInventoryStore((state) => state.historyFrom);
  const historyTo = useInventoryStore((state) => state.historyTo);
  const historySearch = useInventoryStore((state) => state.historySearch);
  const setSearch = useInventoryStore((state) => state.setSearch);
  const setStatusFilter = useInventoryStore((state) => state.setStatusFilter);
  const setSupplierId = useInventoryStore((state) => state.setSupplierId);
  const setSelectedRawMaterialId = useInventoryStore((state) => state.setSelectedRawMaterialId);
  const setActivePanel = useInventoryStore((state) => state.setActivePanel);
  const setHistoryType = useInventoryStore((state) => state.setHistoryType);
  const setHistoryFrom = useInventoryStore((state) => state.setHistoryFrom);
  const setHistoryTo = useInventoryStore((state) => state.setHistoryTo);
  const setHistorySearch = useInventoryStore((state) => state.setHistorySearch);

  const [availabilityMaterial, setAvailabilityMaterial] = useState<{ id: string; name: string } | null>(null);
  const [summaries, setSummaries] = useState<InventorySummaryItem[]>([]);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [stockRuns, setStockRuns] = useState<StockRun[]>([]);
  const [activeStockRunId, setActiveStockRunId] = useState<string | null>(initialDraftId ?? null);
  const [activeStockRun, setActiveStockRun] = useState<StockRun | null>(null);
  const [inventoryHealth, setInventoryHealth] = useState<InventoryHealthReport | null>(null);
  const [stockRunSpend, setStockRunSpend] = useState<StockRunSpendReport | null>(null);
  const [wasteSummary, setWasteSummary] = useState<WasteSummaryReport | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [batchTransactions, setBatchTransactions] = useState<InventoryTransaction[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [stockRunLoading, setStockRunLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [batchTransactionsLoading, setBatchTransactionsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summarySearchInput, setSummarySearchInput] = useState(search);
  const [historySearchInput, setHistorySearchInput] = useState(historySearch);
  const [materialForm, setMaterialForm] = useState<MaterialFormState>(defaultMaterialForm());
  const [wasteForm, setWasteForm] = useState<WasteFormState>(defaultWasteForm());
  const [stockRunForm, setStockRunForm] = useState<StockRunFormState>({ name: "", notes: "" });
  const [stockRunItemForm, setStockRunItemForm] = useState<StockRunItemFormState>({
    rawMaterialId: "",
    supplierId: "",
    quantity: "",
    costPerUnit: "",
    expirationDate: "",
    receivedAt: "",
    note: "",
  });

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (initialDraftId) setActivePanel("stock-run-manage");
    else if (initialAction) setActivePanel(initialAction);
  }, [initialDraftId, initialAction, setActivePanel]);

  const selectedSummary =
    summaries.find((item) => item.rawMaterialId === selectedRawMaterialId) ?? null;

  async function loadInventorySummary(supplierFilter = supplierId) {
    const nextSummaries = await fetchInventorySummary({
      search,
      status: statusFilter || undefined,
      supplierId: supplierFilter || undefined,
    });
    setSummaries(nextSummaries);
    if (!selectedRawMaterialId && nextSummaries[0]) setSelectedRawMaterialId(nextSummaries[0].rawMaterialId);
    if (selectedRawMaterialId && !nextSummaries.some((item) => item.rawMaterialId === selectedRawMaterialId)) {
      setSelectedRawMaterialId(nextSummaries[0]?.rawMaterialId ?? null);
    }
  }

  async function loadSupportData() {
    const [nextUnits, nextSuppliers, nextStockRuns] = await Promise.all([
      fetchUnits(),
      loadIfAllowed("suppliers.view", () => fetchSuppliers(), []),
      loadIfAllowed("stockRuns.view", () => fetchStockRuns({}), []),
    ]);
    setUnits(nextUnits);
    setSuppliers(nextSuppliers);
    setStockRuns(nextStockRuns);
    setActiveStockRunId((current) => {
      if (current && nextStockRuns.some((run) => run.id === current)) return current;
      return nextStockRuns.find((run) => run.status === "DRAFT")?.id ?? null;
    });
  }

  async function loadMaterialBase(rawMaterialId: string) {
    setDetailLoading(true);
    try {
      const [material, nextBatches] = await Promise.all([
        fetchRawMaterial(rawMaterialId),
        fetchRawMaterialBatches(rawMaterialId),
      ]);
      setSelectedMaterial(material);
      setBatches(nextBatches);
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadMaterialHistory(rawMaterialId: string) {
    if (historyFrom && historyTo && historyFrom > historyTo) return;
    setHistoryLoading(true);
    try {
      const nextTransactions = await fetchRawMaterialTransactions(rawMaterialId, {
        type: historyType || undefined,
        from: historyFrom || undefined,
        to: historyTo || undefined,
        search: historySearch || undefined,
      });
      setTransactions(nextTransactions);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadActiveStockRun(stockRunId: string) {
    if (!useAuthStore.getState().can("stockRuns.view")) return;
    setStockRunLoading(true);
    try {
      setActiveStockRun(await fetchStockRun(stockRunId));
    } finally {
      setStockRunLoading(false);
    }
  }

  async function refreshEverything(
    reloadStockRuns = false,
    stockRunIdOverride: string | null | undefined = activeStockRunId
  ) {
    await loadInventorySummary();
    if (reloadStockRuns) await loadSupportData();
    if (selectedRawMaterialId) {
      await Promise.all([loadMaterialBase(selectedRawMaterialId), loadMaterialHistory(selectedRawMaterialId)]);
    }
    if (stockRunIdOverride) await loadActiveStockRun(stockRunIdOverride);
    setReportRevision((revision) => revision + 1);
  }

  async function loadBusinessReports() {
    if (!useAuthStore.getState().can("reports.view")) { setReportLoading(false); return; }
    setReportLoading(true);
    try {
      const [nextInventoryHealth, nextStockRunSpend, nextWasteSummary] = await Promise.all([
        fetchInventoryHealth({ limit: 5 }),
        fetchStockRunSpend({ limit: 5 }),
        fetchWasteSummary({ limit: 5 }),
      ]);
      setInventoryHealth(nextInventoryHealth);
      setStockRunSpend(nextStockRunSpend);
      setWasteSummary(nextWasteSummary);
    } finally {
      setReportLoading(false);
    }
  }

  async function openBatchDrilldown(batch: StockBatch) {
    setSelectedBatch(batch);
    setBatchTransactionsLoading(true);
    try {
      const nextTransactions = await fetchStockBatchTransactions(batch.id);
      setBatchTransactions(nextTransactions);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to load batch transactions"
      );
    } finally {
      setBatchTransactionsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (summarySearchInput !== search) setSearch(summarySearchInput);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, setSearch, summarySearchInput]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (historySearchInput !== historySearch) setHistorySearch(historySearchInput);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [historySearch, historySearchInput, setHistorySearch]);

  useEffect(() => {
    void (async () => {
      setInitialLoading(true);
      try {
        await Promise.all([loadSupportData(), loadInventorySummary(), loadBusinessReports()]);
        hydratedRef.current = true;
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Failed to load inventory");
      } finally {
        setInitialLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    setSummaryLoading(true);
    void loadInventorySummary()
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : "Failed to refresh inventory"))
      .finally(() => setSummaryLoading(false));
  }, [search, statusFilter, supplierId]);

  useEffect(() => {
    if (!selectedRawMaterialId) return;
    void Promise.all([loadMaterialBase(selectedRawMaterialId), loadMaterialHistory(selectedRawMaterialId)]).catch((nextError) =>
      setError(nextError instanceof Error ? nextError.message : "Failed to load material details")
    );
  }, [selectedRawMaterialId]);

  useEffect(() => {
    if (!selectedRawMaterialId || !hydratedRef.current) return;
    void loadMaterialHistory(selectedRawMaterialId).catch((nextError) =>
      setError(nextError instanceof Error ? nextError.message : "Failed to refresh transaction history")
    );
  }, [historyType, historyFrom, historyTo, historySearch, selectedRawMaterialId]);

  useEffect(() => {
    if (!activeStockRunId) {
      setActiveStockRun(null);
      return;
    }
    void loadActiveStockRun(activeStockRunId).catch((nextError) =>
      setError(nextError instanceof Error ? nextError.message : "Failed to load stock-run draft")
    );
  }, [activeStockRunId]);

  useEffect(() => {
    setWasteForm((current) => ({ ...current, rawMaterialId: selectedRawMaterialId || "", batchId: current.rawMaterialId === selectedRawMaterialId ? current.batchId : "" }));
    setStockRunItemForm((current) => ({ ...current, rawMaterialId: selectedRawMaterialId || "" }));
  }, [selectedRawMaterialId]);

  const runAction = async (action: () => Promise<void>, fallbackMessage: string) => {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : fallbackMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminDashboardLayout showHeader={false}>
      <div className={`flex min-w-0 w-full flex-col gap-5 bg-[#f5f5f5] text-[#232d46] `}>
        <AdminSectionHeader title="Inventory" description="Check stock, receive deliveries, and take action from one workspace." />
        <nav ref={sectionNavRef} aria-label="Inventory sections" className={styles.sectionNav}>
          {workspaceSections.filter(([id]) => id !== "stock-runs" || canViewStockRuns).map(([id, label]) => <a key={id} href={`#${id}`} aria-current={activeSection === id ? "location" : undefined} onClick={(event) => { event.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }); }}>{label}</a>)}
        </nav>
        <div className={styles.materialActions} aria-label="Material actions">
          <PermissionAction permission={"inventory.create"}><button type="button" disabled={initialLoading || submitting} onClick={() => { setError(null); setMaterialForm(defaultMaterialForm(null, units[0]?.id)); setActivePanel("create-material"); }}><Plus size={16} />Add Raw Material</button></PermissionAction>
          <PermissionAction permission={"stockRuns.create"}><button type="button" disabled={initialLoading || submitting} onClick={() => { setError(null); setStockRunForm({ name: "", notes: "" }); setActivePanel("stock-run-create"); }}><Plus size={16} />Create Stock-Run Draft</button></PermissionAction>
          <PermissionAction permission={"inventory.waste"}><button type="button" style={{ marginLeft: 8 }} disabled={initialLoading || submitting} onClick={() => { setError(null); setWasteForm(defaultWasteForm(selectedRawMaterialId)); setActivePanel("waste"); }}>Record Waste</button></PermissionAction>
        </div>

        <section id="overview" style={{ scrollMarginTop: 90 }} aria-label="Overview" className={styles.overview}>
          {!canViewReports && <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm">Your available materials and stock actions are below. Report summaries require reporting access.</p>}
          <div className="w-full">
            <div className="min-w-0">
              <PermissionAction permission="reports.view"><div aria-label="Inventory overview metrics" className={styles.metricGrid}>
                <MetricCard label="Materials" value={inventoryHealth ? String(inventoryHealth.summary.totalMaterials) : "—"} />
                <MetricCard label="In Stock" value={inventoryHealth ? String(inventoryHealth.summary.inStockCount) : "—"} />
                <MetricCard label="Low Stock" value={inventoryHealth ? String(inventoryHealth.summary.lowStockCount) : "—"} />
                <MetricCard label="Out of Stock" value={inventoryHealth ? String(inventoryHealth.summary.outOfStockCount) : "—"} />
                <MetricCard label="Inventory Value" value={inventoryHealth ? formatMoney(inventoryHealth.summary.totalInventoryValue) : "—"} />
              </div></PermissionAction>
            </div>
          </div>
        </section>

        {message ? <ActionAlert tone="success" title="Saved!" message={message} onDismiss={() => setMessage(null)} /> : null}
        {error ? <ActionAlert tone="error" title="Action failed" message={error} onDismiss={() => setError(null)} /> : null}

        <PermissionAction permission={"reports.view"}><InventoryBusinessInsights
          onOpenReport={setReport}
          inventoryHealth={inventoryHealth}
          stockRunSpend={stockRunSpend}
          wasteSummary={wasteSummary}
          loading={initialLoading || reportLoading}
          formatMoney={formatMoney}
          formatQuantity={formatQuantity}
          formatDate={formatDate}
        /></PermissionAction>

        <section id="materials" className={styles.pageSection} aria-label="Materials">
          <hr className={styles.sectionDivider} />
          <div className={`grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] ${styles.unifiedMaterials}`}>
          <InventorySummaryPanel
            summarySearchInput={summarySearchInput}
            statusFilter={statusFilter}
            supplierId={supplierId}
            suppliers={suppliers}
            summaries={summaries}
            selectedRawMaterialId={selectedRawMaterialId}
            loading={initialLoading || summaryLoading}
            onSearchInputChange={setSummarySearchInput}
            onStatusFilterChange={setStatusFilter}
            onSupplierChange={setSupplierId}
            onSelectRawMaterial={setSelectedRawMaterialId}
            onRefresh={() => void refreshEverything(true)}
            formatQuantity={formatQuantity}
            formatMoney={formatMoney}
          />

          <MaterialDetailPanel
            key={selectedRawMaterialId ?? "no-material"}
            selectedRawMaterialId={selectedRawMaterialId}
            selectedMaterial={selectedMaterial}
            selectedSummary={selectedSummary}
            detailLoading={detailLoading}
            historyLoading={historyLoading}
            batches={batches}
            transactions={transactions}
            historyType={historyType}
            historyFrom={historyFrom}
            historyTo={historyTo}
            historySearchInput={historySearchInput}
            onHistoryTypeChange={setHistoryType}
            onHistoryFromChange={setHistoryFrom}
            onHistoryToChange={setHistoryTo}
            onHistorySearchInputChange={setHistorySearchInput}
            onSelectBatch={(batch) => void openBatchDrilldown(batch)}
            onEdit={() => { setMaterialForm(defaultMaterialForm(selectedMaterial, units[0]?.id)); setActivePanel("edit-material"); }}
            onWaste={() => { setWasteForm(defaultWasteForm(selectedRawMaterialId)); setActivePanel("waste"); }}
            onStoreAvailability={() => { if (selectedRawMaterialId && selectedSummary) setAvailabilityMaterial({ id: selectedRawMaterialId, name: selectedSummary.name }); }}
            onArchive={() => setActivePanel("archive-material")}
            formatQuantity={formatQuantity}
            formatMoney={formatMoney}
            formatDate={formatDate}
            formatDateTime={formatDateTime}
            getTransactionDelta={getTransactionDelta}
            getTransactionCost={getTransactionCost}
          />
        </div>
        </section>

        <PermissionAction permission={"stockRuns.view"}><section id="stock-runs" className={styles.pageSection} aria-label="Stock Runs">
        <hr className={styles.sectionDivider} />
        <StockRunsPanel
          loading={initialLoading}
          stockRuns={stockRuns}
          activeDraftCount={stockRuns.filter((run) => run.status === "DRAFT").length}
          onOpenDraft={(stockRunId) => { setActiveStockRunId(stockRunId); setActivePanel("stock-run-manage"); }}
          onDeleteDraft={(stockRun) => {
            setActiveStockRunId(stockRun.id);
            setActiveStockRun(stockRun);
            setActivePanel("delete-draft");
          }}
          formatMoney={formatMoney}
          formatDateTime={formatDateTime}
        />
        </section></PermissionAction>

        {report && <PermissionAction permission={"reports.view"}><InventoryReportModal title={reportTitles[report]} description={reportDescriptions[report]} onClose={() => setReport(null)}>
        {report === "low-stock" && <LowStockPanel key={reportRevision} embedded />}
        {report === "near-expiry" && <NearExpiryPanel key={reportRevision} embedded />}
        {(report === "waste" || report === "value" || report === "supplier") && <InsightPanel key={`${report}-${reportRevision}`} kind={report} embedded />}

        </InventoryReportModal></PermissionAction>}

        <PermissionAction permission={activePanel === "create-material" ? "inventory.create" : activePanel === "edit-material" ? "inventory.edit" : "inventory.archive"}><RawMaterialModals
          activePanel={activePanel}
          submitting={submitting}
          units={units}
          selectedMaterial={selectedMaterial}
          materialForm={materialForm}
          onClose={() => setActivePanel(null)}
          onMaterialFormChange={setMaterialForm}
          onCreateMaterial={(event) => {
            event.preventDefault();
            void runAction(async () => {
              const material = await createRawMaterial({ name: materialForm.name, sku: materialForm.sku, unitId: materialForm.unitId, reorderPoint: Number(materialForm.reorderPoint) });
              setSelectedRawMaterialId(material.id);
              setActivePanel(null);
              setMessage(`Created ${material.name}.`);
              await refreshEverything();
              await loadBusinessReports();
            }, "Failed to create material");
          }}
          onUpdateMaterial={(event) => {
            event.preventDefault();
            if (!selectedMaterial) return;
            void runAction(async () => {
              await updateRawMaterial(selectedMaterial.id, { name: materialForm.name, sku: materialForm.sku, unitId: materialForm.unitId, reorderPoint: Number(materialForm.reorderPoint) });
              setActivePanel(null);
              setMessage(`Updated ${materialForm.name}.`);
              await refreshEverything();
              await loadBusinessReports();
            }, "Failed to update material");
          }}
          onArchiveMaterial={() => void runAction(async () => {
            if (!selectedMaterial) return;
            await archiveRawMaterial(selectedMaterial.id);
            setActivePanel(null);
            setMessage(`${selectedMaterial.name} archived.`);
            await refreshEverything();
            await loadBusinessReports();
          }, "Failed to archive material")}
        /></PermissionAction>

        <PermissionAction permission={activePanel === "stock-run-create" ? "stockRuns.create" : activePanel === "delete-draft" ? "stockRuns.delete" : "stockRuns.view"}><StockRunModals
          activePanel={activePanel}
          submitting={submitting}
          summaries={summaries}
          suppliers={suppliers}
          activeStockRun={activeStockRun}
          activeStockRunId={activeStockRunId}
          stockRunLoading={stockRunLoading}
          stockRunForm={stockRunForm}
          stockRunItemForm={stockRunItemForm}
          onClose={() => setActivePanel(null)}
          onOpenDeleteDraft={() => setActivePanel("delete-draft")}
          onBackToManage={() => setActivePanel("stock-run-manage")}
          onStockRunFormChange={setStockRunForm}
          onStockRunItemFormChange={setStockRunItemForm}
          onCreateStockRun={(event) => {
            event.preventDefault();
            void runAction(async () => {
              const stockRun = await createStockRun(stockRunForm);
              setStockRunForm({ name: "", notes: "" });
              setActiveStockRunId(stockRun.id);
              setActivePanel("stock-run-manage");
              setMessage(`Created stock run draft: ${stockRun.name}.`);
              await refreshEverything(true);
            }, "Failed to create stock run");
          }}
          onAddStockRunItem={(event) => {
            event.preventDefault();
            if (!activeStockRunId) return;
            void runAction(async () => {
              await addStockRunItem(activeStockRunId, { rawMaterialId: stockRunItemForm.rawMaterialId, supplierId: stockRunItemForm.supplierId || undefined, quantity: Number(stockRunItemForm.quantity), costPerUnit: Number(stockRunItemForm.costPerUnit), expirationDate: stockRunItemForm.expirationDate || undefined, receivedAt: stockRunItemForm.receivedAt || undefined, note: stockRunItemForm.note || undefined });
              setStockRunItemForm({ rawMaterialId: selectedRawMaterialId || "", supplierId: "", quantity: "", costPerUnit: "", expirationDate: "", receivedAt: "", note: "" });
              setMessage("Added stock run item.");
              await refreshEverything(true);
              await loadBusinessReports();
            }, "Failed to add stock run item");
          }}
          onDeleteStockRunItem={(stockRunItemId) => void runAction(async () => {
            if (!activeStockRunId) return;
            await deleteStockRunItem(activeStockRunId, stockRunItemId);
            setMessage("Removed stock run item.");
            await refreshEverything(true);
            await loadBusinessReports();
          }, "Failed to remove stock run item")}
          onDeleteStockRunDraft={() => void runAction(async () => {
            if (!activeStockRunId || !activeStockRun) return;
            await deleteStockRun(activeStockRunId);
            setActiveStockRunId(null);
            setActiveStockRun(null);
            setActivePanel(null);
            setMessage(`Removed draft ${activeStockRun.name}.`);
            await refreshEverything(true, null);
            await loadBusinessReports();
          }, "Failed to remove draft")}
          onPostStockRun={() => void runAction(async () => {
            if (!activeStockRunId) return;
            const stockRun = await postStockRun(activeStockRunId);
            setActivePanel(null);
            setActiveStockRunId(null);
            setActiveStockRun(null);
            setMessage(`Posted stock run ${stockRun.name}.`);
            await refreshEverything(true, null);
            await loadBusinessReports();
          }, "Failed to post stock run")}
          onSelectRawMaterial={setSelectedRawMaterialId}
          formatQuantity={formatQuantity}
          formatMoney={formatMoney}
          formatDate={formatDate}
        /></PermissionAction>

        <PermissionAction permission={"inventory.waste"}><WasteModal
          activePanel={activePanel}
          submitting={submitting}
          summaries={summaries}
          batches={batches}
          wasteForm={wasteForm}
          onClose={() => setActivePanel(null)}
          onWasteFormChange={setWasteForm}
          onSubmitWaste={(event) => {
            event.preventDefault();
            void runAction(async () => {
              await createInventoryWaste({ rawMaterialId: wasteForm.rawMaterialId, batchId: wasteForm.batchId, quantity: Number(wasteForm.quantity), reasonCode: wasteForm.reasonCode, note: wasteForm.note || undefined });
              setWasteForm(defaultWasteForm(selectedRawMaterialId));
              setActivePanel(null);
              setMessage("Waste entry recorded.");
              await refreshEverything();
              await loadBusinessReports();
            }, "Failed to record waste");
          }}
          onSelectRawMaterial={setSelectedRawMaterialId}
          formatQuantity={formatQuantity}
        /></PermissionAction>

        {availabilityMaterial && <PermissionAction permission={"suppliers.searchAvailability"}><StoreAvailabilityModal key={availabilityMaterial.id} materialId={availabilityMaterial.id} materialName={availabilityMaterial.name} onClose={() => setAvailabilityMaterial(null)} onJourney={() => { setAvailabilityMaterial(null); router.push("/admin/inventory/suppliers"); }} /></PermissionAction>}

        <BatchTransactionModal
          batch={selectedBatch}
          transactions={batchTransactions}
          loading={batchTransactionsLoading}
          onClose={() => setSelectedBatch(null)}
          formatMoney={formatMoney}
          formatQuantity={formatQuantity}
          formatDate={formatDate}
          formatDateTime={formatDateTime}
        />
      </div>
    </AdminDashboardLayout>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return <div className={styles.metricCard}><p className={styles.metricLabel}>{label}</p><p className={styles.metricValue}>{value}</p></div>;
}
