"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Plus,
  Trash2,
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

export default function InventoryPage() {
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
  const [activeStockRunId, setActiveStockRunId] = useState<string | null>(null);
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
    <AdminDashboardLayout>
      <div className="flex flex-col gap-5 bg-[#f5f5f5] text-[#232d46]">
        <section id="overview" className="overflow-hidden rounded-xl bg-[linear-gradient(115deg,#202b45_0%,#1d355a_55%,#0875a6_100%)] p-5 text-white shadow-sm md:p-6">
          <div className="grid gap-5 2xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,2fr)] 2xl:items-center">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-200">Inventory Overview</p>
              <h1 className="mt-4 max-w-md text-2xl font-semibold leading-tight tracking-tight md:text-3xl">Inventory Management</h1>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <BannerActionButton label="Add Raw Material" icon={<Plus size={14} />} onClick={() => { setMaterialForm(defaultMaterialForm(null, units[0]?.id)); setActivePanel("create-material"); }} />
                <BannerActionButton label="New Stock Run" icon={<Boxes size={14} />} onClick={() => { setStockRunForm({ name: "", notes: "" }); setActivePanel("stock-run-create"); }} />
                <BannerActionButton label="Record Waste" icon={<Trash2 size={14} />} onClick={() => setActivePanel("waste")} />
              </div>
              <div aria-label="Inventory overview metrics" className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                <MetricCard label="Materials" value={inventoryHealth ? String(inventoryHealth.summary.totalMaterials) : "—"} />
                <MetricCard label="In Stock" value={inventoryHealth ? String(inventoryHealth.summary.inStockCount) : "—"} />
                <MetricCard label="Low Stock" value={inventoryHealth ? String(inventoryHealth.summary.lowStockCount) : "—"} />
                <MetricCard label="Out of Stock" value={inventoryHealth ? String(inventoryHealth.summary.outOfStockCount) : "—"} />
                <MetricCard label="Inventory Value" value={inventoryHealth ? formatMoney(inventoryHealth.summary.totalInventoryValue) : "—"} />
              </div>
            </div>
          </div>
        </section>

        {message ? <ActionAlert tone="success" title="Saved!" message={message} onDismiss={() => setMessage(null)} /> : null}
        {error ? <ActionAlert tone="error" title="Action failed" message={error} onDismiss={() => setError(null)} /> : null}

        <InventoryBusinessInsights
          inventoryHealth={inventoryHealth}
          stockRunSpend={stockRunSpend}
          wasteSummary={wasteSummary}
          loading={initialLoading || reportLoading}
          formatMoney={formatMoney}
          formatQuantity={formatQuantity}
          formatDate={formatDate}
        />

        <div className="grid items-start gap-4 2xl:items-stretch 2xl:grid-cols-[minmax(19rem,0.85fr)_minmax(0,1.65fr)]">
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
            onWaste={() => setActivePanel("waste")}
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

        {availabilityMaterial && <StoreAvailabilityModal key={availabilityMaterial.id} materialId={availabilityMaterial.id} materialName={availabilityMaterial.name} onClose={() => setAvailabilityMaterial(null)} onJourney={() => { setAvailabilityMaterial(null); router.push("/admin/inventory/suppliers"); }} />}

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

function BannerActionButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/35 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/15">{icon}{label}</button>;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/30 bg-[#17243c]/35 px-3 py-2.5 text-white"><p className="text-[11px] font-medium text-slate-200">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>;
}
