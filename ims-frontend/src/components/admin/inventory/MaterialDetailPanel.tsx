"use client";

import {
  AlertTriangle,
  Archive,
  ClipboardList,
  FlaskConical,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import {
  InventoryField,
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
      return "bg-emerald-100 text-emerald-700";
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
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-3 font-semibold text-slate-900">{value}</div>
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
          : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
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
  onAdjustment: () => void;
  onWaste: () => void;
  onArchive: () => void;
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
  onAdjustment,
  onWaste,
  onArchive,
  formatQuantity,
  formatMoney,
  formatDate,
  formatDateTime,
  getTransactionDelta,
  getTransactionCost,
}: MaterialDetailPanelProps) {
  const activeBatches = batches.filter((batch) => Number(batch.remainingQuantity) > 0);

  if (!selectedRawMaterialId) {
    return (
      <section className="flex min-h-[24rem] flex-col rounded-[28px] border border-black/5 bg-white/95 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
          Select a material to inspect summary, batches, and transaction history.
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-[44rem] flex-col rounded-[28px] border border-black/5 bg-white/95 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)] xl:h-[68rem] xl:min-h-0 xl:overflow-hidden">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-900">
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

        <div className="flex flex-wrap gap-2">
          <InlineActionButton label="Edit" icon={<ClipboardList size={15} />} onClick={onEdit} />
          <InlineActionButton
            label="Adjustment"
            icon={<RefreshCcw size={15} />}
            onClick={onAdjustment}
          />
          <InlineActionButton label="Waste" icon={<FlaskConical size={15} />} onClick={onWaste} />
          <InlineActionButton
            label="Archive"
            icon={<Archive size={15} />}
            onClick={onArchive}
            destructive
          />
        </div>
      </div>

      {selectedSummary?.status === "LOW_STOCK" || selectedSummary?.status === "OUT_OF_STOCK" ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5" size={18} />
            <div>
              <p className="font-semibold">{selectedSummary.name} needs attention</p>
              <p className="mt-1 text-amber-800">
                This material is {selectedSummary.status.replaceAll("_", " ").toLowerCase()}. Use
                a stock run, adjustment, or waste entry so the ledger and summaries stay aligned.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="SKU" value={selectedMaterial?.sku ?? selectedSummary?.sku ?? "N/A"} />
        <MetricTile
          label="On Hand"
          value={formatQuantity(selectedMaterial?.summary?.onHandQuantity ?? "0")}
        />
        <MetricTile
          label="Usable"
          value={formatQuantity(selectedMaterial?.summary?.usableQuantity ?? "0")}
        />
        <MetricTile
          label="Reorder Point"
          value={formatQuantity(selectedMaterial?.reorderPoint ?? "0")}
        />
      </div>

      <div className="mt-5 grid flex-1 gap-4 xl:min-h-0 xl:grid-rows-[minmax(0,0.82fr)_minmax(0,1.18fr)] xl:overflow-hidden">
        <section className="flex min-h-[18rem] flex-col overflow-hidden rounded-2xl border border-slate-200 xl:min-h-0">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Batches</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {activeBatches.length} active batch{activeBatches.length === 1 ? "" : "es"}.
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
          <div className="min-h-[16rem] flex-1 overflow-y-auto overflow-x-hidden xl:min-h-0">
            <table className="w-full table-fixed text-sm">
              <thead className="sticky top-0 z-10 bg-white text-left text-xs uppercase tracking-[0.18em] text-slate-400">
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
                {batches.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={6}>
                      No batches found for this material.
                    </td>
                  </tr>
                ) : (
                  batches.map((batch) => (
                    <tr key={batch.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-900">{batch.id.slice(0, 8)}</td>
                      <td className="px-4 py-3">{formatQuantity(batch.remainingQuantity)}</td>
                      <td className="px-4 py-3">{formatMoney(batch.costPerUnit)}</td>
                      <td className="px-4 py-3">{formatDate(batch.expirationDate)}</td>
                      <td className="px-4 py-3">{batch.supplier?.name ?? "N/A"}</td>
                      <td className="px-4 py-3 text-right">
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
                    Filter the ledger without kicking focus out of the search field.
                  </p>
                </div>
                {historyLoading ? (
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <Loader2 size={14} className="animate-spin" />
                    Updating
                  </span>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <InventoryField htmlFor="history-type" label="Transaction type">
                  <select
                    id="history-type"
                    value={historyType}
                    onChange={(event) => onHistoryTypeChange(event.target.value)}
                    className={inventoryInputClasses}
                  >
                    <option value="">All transaction types</option>
                    <option value="STOCK_RUN">Stock run</option>
                    <option value="ADJUSTMENT">Adjustment</option>
                    <option value="WASTE">Waste</option>
                    <option value="CHECKOUT">Checkout</option>
                    <option value="VOID">Void</option>
                    <option value="REFUND">Refund</option>
                  </select>
                </InventoryField>
                <InventoryField htmlFor="history-from" label="From date">
                  <input
                    id="history-from"
                    type="date"
                    value={historyFrom}
                    onChange={(event) => onHistoryFromChange(event.target.value)}
                    className={inventoryInputClasses}
                  />
                </InventoryField>
                <InventoryField htmlFor="history-to" label="To date">
                  <input
                    id="history-to"
                    type="date"
                    value={historyTo}
                    onChange={(event) => onHistoryToChange(event.target.value)}
                    className={inventoryInputClasses}
                  />
                </InventoryField>
                <InventoryField htmlFor="history-search" label="Search">
                  <input
                    id="history-search"
                    value={historySearchInput}
                    onChange={(event) => onHistorySearchInputChange(event.target.value)}
                    placeholder="Type, reason code, note, or actor"
                    className={inventoryInputClasses}
                  />
                </InventoryField>
              </div>
            </div>
          </div>

          <div className="min-h-[18rem] flex-1 overflow-x-auto overflow-y-auto xl:min-h-0">
            <table className="min-w-[52rem] text-sm">
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
                {transactions.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={6}>
                      No transactions matched the current filters.
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaction) => {
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
