"use client";
import DateFilter from "@/components/staff-pos/DateFilter";
import selectStyles from "@/components/admin/AdminSelect.module.css";
import AdminSelect from "@/components/admin/AdminSelect";
import { PermissionAction } from "@/components/auth/PermissionGuard";

import { useState } from "react";
import styles from "./MaterialDetailPanel.module.css";
import {
  AlertTriangle,
  Archive,
  ClipboardList,
  FlaskConical,
  Loader2,
  Store,
} from "lucide-react";
import {
  inventoryInputClasses,
} from "@/components/admin/inventory/InventoryField";
import type {
  InventorySummaryItem,
  InventoryTransaction,
  RawMaterial,
  StockBatch,
} from "@/lib/inventory";

function statusClasses(status: InventorySummaryItem["status"]) {
  switch (status) {
    case "IN_STOCK":
      return "bg-lime-100 text-[#28511a]";
    case "LOW_STOCK":
      return "bg-amber-100 text-amber-800";
    case "OUT_OF_STOCK":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-slate-200 text-slate-700";
  }
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-2 font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function InlineActionButton({
  label,
  icon,
  onClick,
  destructive = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
        destructive
          ? "border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50"
          : "border-slate-200 text-[#232d46] hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

type MaterialDetailPanelProps = {
  selectedRawMaterialId: string | null;
  selectedMaterial: RawMaterial | null;
  selectedSummary: InventorySummaryItem | null;
  detailLoading: boolean;
  historyLoading: boolean;
  batches: StockBatch[];
  transactions: InventoryTransaction[];
  historyType: string;
  historyFrom: string;
  historyTo: string;
  historySearchInput: string;
  onHistoryTypeChange: (value: string) => void;
  onHistoryFromChange: (value: string) => void;
  onHistoryToChange: (value: string) => void;
  onHistorySearchInputChange: (value: string) => void;
  onSelectBatch: (batch: StockBatch) => void;
  onEdit: () => void;
  onWaste: () => void;
  onArchive: () => void;
  onStoreAvailability: () => void;
  formatQuantity: (value: string) => string;
  formatMoney: (value: string) => string;
  formatDate: (value: string | null | undefined) => string;
  formatDateTime: (value: string | null | undefined) => string;
  getTransactionDelta: (transaction: InventoryTransaction) => number;
  getTransactionCost: (transaction: InventoryTransaction) => number;
};

export default function MaterialDetailPanel({
  selectedRawMaterialId,
  selectedMaterial,
  selectedSummary,
  detailLoading,
  historyLoading,
  batches,
  transactions,
  historyType,
  historyFrom,
  historyTo,
  historySearchInput,
  onHistoryTypeChange,
  onHistoryFromChange,
  onHistoryToChange,
  onHistorySearchInputChange,
  onSelectBatch,
  onEdit,
  onWaste,
  onArchive,
  onStoreAvailability,
  formatQuantity,
  formatMoney,
  formatDate,
  formatDateTime,
  getTransactionDelta,
  getTransactionCost,
}: MaterialDetailPanelProps) {
  const [batchSearch, setBatchSearch] = useState("");
  const [batchStatus, setBatchStatus] = useState("");
  const [batchSupplier, setBatchSupplier] = useState("");
  const [batchOrder, setBatchOrder] = useState("desc");
  const invalidHistoryDates = Boolean(historyFrom && historyTo && historyFrom > historyTo);
  const activeBatches = batches.filter((batch) => Number(batch.remainingQuantity) > 0);
  const batchSuppliers = [...new Map(batches.filter((batch) => batch.supplier).map((batch) => [batch.supplier!.id, batch.supplier!])).values()];
  const matchingBatches = batches.filter((batch) => {
    const matchesSearch = `${batch.id} ${batch.supplier?.name ?? ""} ${batch.stockRunItem?.stockRun.name ?? ""}`.toLowerCase().includes(batchSearch.trim().toLowerCase());
    const remaining = Number(batch.remainingQuantity);
    return matchesSearch
      && (!batchStatus || (batchStatus === "active" ? remaining > 0 : remaining <= 0))
      && (!batchSupplier || (batchSupplier === "none" ? !batch.supplierId : batch.supplierId === batchSupplier));
  });
  const recentBatches = [...matchingBatches]
    .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt) || b.id.localeCompare(a.id));
  if (batchOrder === "asc") recentBatches.reverse();
  const recentTransactions = [...transactions]
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || b.id.localeCompare(a.id));

  if (!selectedRawMaterialId) {
    return (
      <section className="flex min-h-72 flex-col rounded-xl border border-slate-200 bg-white p-4 2xl:h-[42rem]">
        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
          Select a material to inspect summary, batches, and transaction history.
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 2xl:h-[42rem] 2xl:overflow-x-hidden 2xl:overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[160px] flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="mb-0 text-lg font-bold text-[#232d46]">
              {selectedMaterial?.name ?? selectedSummary?.name ?? "Raw Material"}
            </h2>
            {selectedSummary ? (
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(selectedSummary.status)}`}
              >
                {selectedSummary.status.replaceAll("_", " ")}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Inspect batches and movement history without leaving the main workspace.
          </p>
        </div>

        <div className="flex max-w-full flex-col items-start gap-2">
          <div className="flex flex-wrap items-center gap-2">
          <PermissionAction permission={"suppliers.searchAvailability"}><InlineActionButton label="Store Availability" icon={<Store size={15} />} onClick={onStoreAvailability} /></PermissionAction>
          <PermissionAction permission={"inventory.edit"}><InlineActionButton label="Edit" icon={<ClipboardList size={15} />} onClick={onEdit} /></PermissionAction>
          <PermissionAction permission={"inventory.waste"}><InlineActionButton label="Record Waste" icon={<FlaskConical size={15} />} onClick={onWaste} /></PermissionAction>
          </div>
          <PermissionAction permission={"inventory.archive"}><InlineActionButton
            label="Archive"
            icon={<Archive size={15} />}
            onClick={onArchive}
            destructive
          /></PermissionAction>
        </div>
      </div>

      {selectedSummary?.status === "LOW_STOCK" || selectedSummary?.status === "OUT_OF_STOCK" ? (
        <div className={styles.stockAlert} data-status={selectedSummary.status} role="status">
          <span className={styles.stockAlertIcon}><AlertTriangle size={20} aria-hidden="true" /></span>
          <div className={styles.stockAlertContent}>
            <div className={styles.stockAlertHeading}>
              <p className={styles.stockAlertTitle}>{selectedSummary.name}</p>
              <span className={styles.stockAlertBadge}>{selectedSummary.status === "OUT_OF_STOCK" ? "Out of stock" : "Low stock"}</span>
            </div>
            <p className={styles.stockAlertDescription}>
              {selectedSummary.status === "OUT_OF_STOCK"
                ? "No usable stock remaining. Create a stock run to replenish this material."
                : "Stock is below the reorder point. Plan a stock run to replenish this material."}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <MetricTile
          label="On Hand"
          value={selectedMaterial?.summary ? formatQuantity(selectedMaterial.summary.onHandQuantity) : "—"}
        />
        <MetricTile
          label="Usable"
          value={selectedMaterial?.summary ? formatQuantity(selectedMaterial.summary.usableQuantity) : "—"}
        />
        <MetricTile
          label="Reorder Point"
          value={selectedMaterial ? formatQuantity(selectedMaterial.reorderPoint) : "—"}
        />
        <MetricTile label="Inventory Value" value={selectedSummary ? formatMoney(selectedSummary.inventoryValue) : "—"} />
      </div>

      <div className="mt-4 grid shrink-0 gap-4">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Batches</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {activeBatches.length} active batch{activeBatches.length === 1 ? "" : "es"}. {matchingBatches.length} matching batches. Scroll to view more.
                </p>
              </div>
              {detailLoading ? (
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <Loader2 size={14} className="animate-spin" />
                  Refreshing
                </span>
              ) : null}
            </div>
          </div>
          <div className={`${styles.historyFilters} grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-2 xl:grid-cols-4`}>
            <div>
                  <label htmlFor="batch-search" className={selectStyles.label}>Search batches</label>
              <input id="batch-search" value={batchSearch} onChange={(event) => setBatchSearch(event.target.value)} placeholder="Batch ID, supplier, or stock run" className={inventoryInputClasses} />
            </div>
            <AdminSelect label="Status" value={batchStatus} onChange={setBatchStatus} options={[{ value: "", label: "All statuses" }, { value: "active", label: "Remaining stock" }, { value: "depleted", label: "Depleted" }]} />
            <AdminSelect label="Supplier" value={batchSupplier} onChange={setBatchSupplier} options={[{ value: "", label: "All suppliers" }, { value: "none", label: "No supplier" }, ...batchSuppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))]} />
            <AdminSelect label="Received date order" value={batchOrder} onChange={setBatchOrder} options={[{ value: "desc", label: "Newest first" }, { value: "asc", label: "Oldest first" }]} />
          </div>
          <div tabIndex={0} role="region" aria-label="Batches table" className="h-[17rem] min-h-0 shrink-0 overflow-x-auto overflow-y-scroll [scrollbar-gutter:stable]">
            <table className="w-full min-w-[40rem] table-fixed text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Remaining</th>
                  <th className="px-4 py-3">Cost</th>
                  <th className="px-4 py-3">Expiry</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentBatches.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={6}>
                      No batches match the current filters.
                    </td>
                  </tr>
                ) : (
                  recentBatches.map((batch) => (
                    <tr key={batch.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-900">{batch.id.slice(0, 8)}</td>
                      <td className="px-3 py-2">{formatQuantity(batch.remainingQuantity)}</td>
                      <td className="px-3 py-2">{formatMoney(batch.costPerUnit)}</td>
                      <td className="px-3 py-2">{formatDate(batch.expirationDate)}</td>
                      <td className="px-3 py-2">{batch.supplier?.name ?? "N/A"}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectBatch(batch)}
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex min-h-[24rem] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 xl:min-h-0">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Inventory History</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {transactions.length} matching transactions, newest first. Scroll to view older records.
                  </p>
                </div>
                {historyLoading ? (
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <Loader2 size={14} className="animate-spin" />
                    Updating
                  </span>
                ) : null}
              </div>

              <div className={`${styles.historyFilters} grid gap-3 md:grid-cols-2 xl:grid-cols-4`}>
                <AdminSelect label="Transaction type" value={historyType} onChange={onHistoryTypeChange} options={[{ value: "", label: "All transaction types" }, { value: "STOCK_RUN", label: "Stock run" }, { value: "ADJUSTMENT", label: "Adjustment" }, { value: "WASTE", label: "Waste" }, { value: "CHECKOUT", label: "Checkout" }, { value: "REFUND", label: "Refund" }]} />
                <DateFilter label="From date" value={historyFrom} onChange={onHistoryFromChange} />
                <DateFilter label="To date" value={historyTo} onChange={onHistoryToChange} />
                <div>
                  <label htmlFor="history-search" className={selectStyles.label}>Search</label>
                  <input
                    id="history-search"
                    title={historySearchInput || "Type, reason code, note, or actor"}
                    value={historySearchInput}
                    onChange={(event) => onHistorySearchInputChange(event.target.value)}
                    placeholder="Type, reason code, note, or actor"
                    className={inventoryInputClasses}
                  />
                </div>
              </div>
              {invalidHistoryDates && (
                <p role="alert" className={styles.dateError}>
                  From date must be on or before To date. Correct the date range to update the history results.
                </p>
              )}
            </div>
          </div>

          <div tabIndex={0} role="region" aria-label="Inventory history table" className="h-[30rem] min-h-0 shrink-0 overflow-x-auto overflow-y-scroll [scrollbar-gutter:stable]">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="sticky top-0 z-10 bg-white text-left text-xs uppercase tracking-[0.18em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Occurred</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Delta</th>
                  <th className="px-4 py-3">Cost</th>
                  <th className="px-4 py-3">Actor</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={6}>
                      No transactions matched the current filters.
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((transaction) => {
                    const delta = getTransactionDelta(transaction);
                    const totalCost = getTransactionCost(transaction);
                    const actor = transaction.actorUser
                      ? `${transaction.actorUser.firstName} ${transaction.actorUser.lastName}`
                      : "System";

                    return (
                      <tr key={transaction.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 align-top">{formatDateTime(transaction.occurredAt)}</td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium text-slate-900">{transaction.type}</div>
                          <div className="mt-1 text-xs text-slate-500">{transaction.sourceType}</div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium text-slate-900">
                            {transaction.reasonCode || "N/A"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {transaction.note || "No note"}
                          </div>
                        </td>
                        <td
                          className={`px-4 py-3 align-top font-semibold ${
                            delta >= 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {delta >= 0 ? "+" : ""}
                          {formatQuantity(delta.toString())}
                        </td>
                        <td className="px-4 py-3 align-top">{formatMoney(totalCost.toString())}</td>
                        <td className="px-4 py-3 align-top break-words">{actor}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
