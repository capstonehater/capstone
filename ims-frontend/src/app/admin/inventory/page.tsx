"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Boxes,
  Building2,
  FlaskConical,
  Plus,
  RefreshCcw,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import AdjustmentModal from "@/components/admin/inventory/AdjustmentModal";
import BatchTransactionModal from "@/components/admin/inventory/BatchTransactionModal";
import InventoryBusinessInsights from "@/components/admin/inventory/InventoryBusinessInsights";
import MaterialDetailPanel from "@/components/admin/inventory/MaterialDetailPanel";
import RawMaterialModals from "@/components/admin/inventory/RawMaterialModals";
import StockRunModals from "@/components/admin/inventory/StockRunModals";
import StockRunsPanel from "@/components/admin/inventory/StockRunsPanel";
import InventorySummaryPanel from "@/components/admin/inventory/InventorySummaryPanel";
import SupplierManagementModal from "@/components/admin/inventory/SupplierManagementModal";
import WasteModal from "@/components/admin/inventory/WasteModal";
import { fetchAlerts, type AlertRecord } from "@/lib/alerts";
import {
  getDefaultAdjustmentReasonCode,
  getDefaultWasteReasonCode,
} from "@/lib/inventory-reason-options";
import {
  addStockRunItem,
  archiveRawMaterial,
  createSupplier,
  createInventoryAdjustment,
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
  updateSupplier,
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

type PanelMode =
  | null
  | "create-material"
  | "edit-material"
  | "supplier-management"
  | "stock-run-create"
  | "stock-run-manage"
  | "adjustment"
  | "waste"
  | "archive-material"
  | "delete-draft";

type MaterialFormState = {
  name: string;
  sku: string;
  unitId: string;
  reorderPoint: string;
};

type AdjustmentFormState = {
  direction: "INCREASE" | "DECREASE";
  rawMaterialId: string;
  batchId: string;
  quantity: string;
  reasonCode: string;
  note: string;
  costPerUnit: string;
  supplierId: string;
  expirationDate: string;
  receivedAt: string;
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

function defaultAdjustmentForm(rawMaterialId?: string | null): AdjustmentFormState {
  return {
    direction: "INCREASE",
    rawMaterialId: rawMaterialId ?? "",
    batchId: "",
    quantity: "",
    reasonCode: getDefaultAdjustmentReasonCode("INCREASE"),
    note: "",
    costPerUnit: "",
    supplierId: "",
    expirationDate: "",
    receivedAt: "",
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

export default function InventoryPage() {
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

  const [summaries, setSummaries] = useState<InventorySummaryItem[]>([]);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [stockRuns, setStockRuns] = useState<StockRun[]>([]);
  const [activeStockRunId, setActiveStockRunId] = useState<string | null>(null);
  const [activeStockRun, setActiveStockRun] = useState<StockRun | null>(null);
  const [inventoryHealth, setInventoryHealth] = useState<InventoryHealthReport | null>(null);
  const [stockRunSpend, setStockRunSpend] = useState<StockRunSpendReport | null>(null);
  const [wasteSummary, setWasteSummary] = useState<WasteSummaryReport | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<AlertRecord[]>([]);
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
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentFormState>(defaultAdjustmentForm());
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

  const stats = {
    totalMaterials: summaries.length,
    inStock: summaries.filter((item) => item.status === "IN_STOCK").length,
    lowStock: summaries.filter((item) => item.status === "LOW_STOCK").length,
    outOfStock: summaries.filter((item) => item.status === "OUT_OF_STOCK").length,
    inventoryValue: currencyFormatter.format(
      summaries.reduce((sum, item) => sum + Number(item.inventoryValue), 0)
    ),
  };

  const selectedSummary =
    summaries.find((item) => item.rawMaterialId === selectedRawMaterialId) ?? null;

  async function loadInventorySummary() {
    const nextSummaries = await fetchInventorySummary({
      search,
      status: statusFilter || undefined,
      supplierId: supplierId || undefined,
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
      fetchSuppliers(),
      fetchStockRuns({}),
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
  }

  async function loadBusinessReports() {
    setReportLoading(true);
    try {
      const [nextInventoryHealth, nextStockRunSpend, nextWasteSummary, nextAlerts] = await Promise.all([
        fetchInventoryHealth({ limit: 5 }),
        fetchStockRunSpend({ limit: 5 }),
        fetchWasteSummary({ limit: 5 }),
        fetchAlerts({ state: "ACTIVE", limit: 6 }),
      ]);
      setInventoryHealth(nextInventoryHealth);
      setStockRunSpend(nextStockRunSpend);
      setWasteSummary(nextWasteSummary);
      setActiveAlerts(nextAlerts);
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
    setAdjustmentForm((current) => ({ ...current, rawMaterialId: selectedRawMaterialId || "", batchId: current.rawMaterialId === selectedRawMaterialId ? current.batchId : "" }));
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

  const handleCreateSupplier = async (input: {
    name: string;
    latitude?: number;
    longitude?: number;
    address?: string;
    contactInfo?: string;
  }) => {
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const supplier = await createSupplier(input);
      await loadSupportData();
      setMessage(`Created supplier ${supplier.name}.`);
      return supplier;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to create supplier");
      throw nextError;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSupplier = async (
    supplierId: string,
    input: {
      name?: string;
      latitude?: number;
      longitude?: number;
      address?: string;
      contactInfo?: string;
    }
  ) => {
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const supplier = await updateSupplier(supplierId, input);
      await loadSupportData();
      setMessage(`Updated supplier ${supplier.name}.`);
      return supplier;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to update supplier");
      throw nextError;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminDashboardLayout>
      <div className="flex flex-col gap-6 xl:min-h-full">
        <section className="overflow-hidden rounded-[36px] bg-[linear-gradient(135deg,#1f2937_0%,#334155_42%,#f45a1f_100%)] p-6 text-white shadow-[0_26px_80px_rgba(15,23,42,0.18)] md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-100/90">Admin Inventory Control</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Keep purchasing, waste, and adjustments focused.</h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-100/85 md:text-base">The backend stays untouched while the admin workspace moves into clearer modal flows, stable filtering, and table-first scrolling.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <HeroButton label="Add Raw Material" icon={<Plus size={16} />} onClick={() => { setMaterialForm(defaultMaterialForm(null, units[0]?.id)); setActivePanel("create-material"); }} />
              <HeroButton label="Manage Suppliers" icon={<Building2 size={16} />} onClick={() => setActivePanel("supplier-management")} />
              <HeroButton label="New Stock Run" icon={<Boxes size={16} />} onClick={() => { setStockRunForm({ name: "", notes: "" }); setActivePanel("stock-run-create"); }} />
              <HeroButton label="Record Adjustment" icon={<RefreshCcw size={16} />} onClick={() => setActivePanel("adjustment")} />
              <HeroButton label="Record Waste" icon={<Trash2 size={16} />} onClick={() => setActivePanel("waste")} />
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Materials" value={String(stats.totalMaterials)} />
            <MetricCard label="In Stock" value={String(stats.inStock)} />
            <MetricCard label="Low Stock" value={String(stats.lowStock)} />
            <MetricCard label="Out of Stock" value={String(stats.outOfStock)} />
            <MetricCard label="Inventory Value" value={stats.inventoryValue} />
          </div>
        </section>

        {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <InventoryBusinessInsights
          inventoryHealth={inventoryHealth}
          stockRunSpend={stockRunSpend}
          wasteSummary={wasteSummary}
          loading={initialLoading || reportLoading}
          formatMoney={formatMoney}
          formatQuantity={formatQuantity}
          formatDate={formatDate}
        />

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Active Alerts</h2>
              <p className="mt-1 text-sm text-slate-500">
                Operational alerts generated from stock activity and expiry reevaluation.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {activeAlerts.length} active
            </span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {activeAlerts.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 lg:col-span-3">
                No active alerts right now.
              </div>
            ) : (
              activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-900">{alert.title}</h3>
                    <AlertTriangle className="h-4 w-4 text-[#f45a1f]" />
                  </div>
                  <p className="text-sm text-slate-600">{alert.message}</p>
                  <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">
                    {alert.type.replaceAll("_", " ")} • {alert.severity}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.45fr] xl:items-start">
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
            onAdjustment={() => setActivePanel("adjustment")}
            onWaste={() => setActivePanel("waste")}
            onArchive={() => setActivePanel("archive-material")}
            formatQuantity={formatQuantity}
            formatMoney={formatMoney}
            formatDate={formatDate}
            formatDateTime={formatDateTime}
            getTransactionDelta={getTransactionDelta}
            getTransactionCost={getTransactionCost}
          />
        </div>

        <StockRunsPanel
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

        <RawMaterialModals
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
        />

        <StockRunModals
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
        />

        <AdjustmentModal
          activePanel={activePanel}
          submitting={submitting}
          summaries={summaries}
          suppliers={suppliers}
          batches={batches}
          adjustmentForm={adjustmentForm}
          onClose={() => setActivePanel(null)}
          onAdjustmentFormChange={setAdjustmentForm}
          onSubmitAdjustment={(event) => {
            event.preventDefault();
            void runAction(async () => {
              await createInventoryAdjustment({ direction: adjustmentForm.direction, rawMaterialId: adjustmentForm.rawMaterialId, batchId: adjustmentForm.direction === "DECREASE" ? adjustmentForm.batchId : undefined, quantity: Number(adjustmentForm.quantity), reasonCode: adjustmentForm.reasonCode, note: adjustmentForm.note || undefined, costPerUnit: adjustmentForm.direction === "INCREASE" ? Number(adjustmentForm.costPerUnit) : undefined, supplierId: adjustmentForm.supplierId || undefined, expirationDate: adjustmentForm.expirationDate || undefined, receivedAt: adjustmentForm.receivedAt || undefined });
              setAdjustmentForm(defaultAdjustmentForm(selectedRawMaterialId));
              setActivePanel(null);
              setMessage("Inventory adjustment recorded.");
              await refreshEverything(true);
              await loadBusinessReports();
            }, "Failed to record adjustment");
          }}
          onSelectRawMaterial={setSelectedRawMaterialId}
          formatQuantity={formatQuantity}
        />

        <WasteModal
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
        />

        <SupplierManagementModal
          open={activePanel === "supplier-management"}
          suppliers={suppliers}
          submitting={submitting}
          onClose={() => setActivePanel(null)}
          onCreateSupplier={handleCreateSupplier}
          onUpdateSupplier={handleUpdateSupplier}
        />

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

function HeroButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/15">{icon}{label}</button>;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[24px] border border-white/15 bg-white/10 px-5 py-4 text-white"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-100/85">{label}</p><p className="mt-3 text-3xl font-semibold">{value}</p></div>;
}
