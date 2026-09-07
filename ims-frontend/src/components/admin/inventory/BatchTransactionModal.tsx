"use client";

import InventoryModal from "@/components/admin/inventory/InventoryModal";
import type { InventoryTransaction, StockBatch } from "@/lib/inventory";

type BatchTransactionModalProps = {
  batch: StockBatch | null;
  transactions: InventoryTransaction[];
  loading: boolean;
  onClose: () => void;
  formatMoney: (value: string) => string;
  formatQuantity: (value: string) => string;
  formatDate: (value: string | null | undefined) => string;
  formatDateTime: (value: string | null | undefined) => string;
};

export default function BatchTransactionModal({
  batch,
  transactions,
  loading,
  onClose,
  formatMoney,
  formatQuantity,
  formatDate,
  formatDateTime,
}: BatchTransactionModalProps) {
  if (!batch) return null;

  return (
    <InventoryModal
      title={`Batch ${batch.id.slice(0, 8)} Drill-Down`}
      description="Review every stock movement tied to this batch, including quantity delta, cost delta, actor, and source."
      onClose={onClose}
      wide
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Remaining
          </div>
          <div className="mt-3 font-semibold text-slate-900">
            {formatQuantity(batch.remainingQuantity)}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Cost Per Unit
          </div>
          <div className="mt-3 font-semibold text-slate-900">
            {formatMoney(batch.costPerUnit)}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Expiry
          </div>
          <div className="mt-3 font-semibold text-slate-900">
            {formatDate(batch.expirationDate)}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Supplier
          </div>
          <div className="mt-3 font-semibold text-slate-900">
            {batch.supplier?.name ?? "N/A"}
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid grid-cols-[1.15fr_0.8fr_1fr_0.8fr_0.9fr_1fr] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <span>Occurred</span>
          <span>Type</span>
          <span>Reason</span>
          <span>Delta</span>
          <span>Cost</span>
          <span>Actor</span>
        </div>

        <div className="max-h-[28rem] overflow-y-auto">
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading batch transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              No transactions were found for this batch.
            </div>
          ) : (
            transactions.map((transaction) => {
              const line = transaction.lines.find((candidate) => candidate.stockBatchId === batch.id);
              const actor = transaction.actorUser
                ? `${transaction.actorUser.firstName} ${transaction.actorUser.lastName}`
                : "System";

              return (
                <div
                  key={transaction.id}
                  className="grid grid-cols-[1.15fr_0.8fr_1fr_0.8fr_0.9fr_1fr] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                >
                  <div>{formatDateTime(transaction.occurredAt)}</div>
                  <div>
                    <div className="font-semibold text-slate-900">{transaction.type}</div>
                    <div className="mt-1 text-xs text-slate-500">{transaction.sourceType}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">
                      {transaction.reasonCode || "N/A"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {transaction.note || "No note"}
                    </div>
                  </div>
                  <div
                    className={`font-semibold ${
                      Number(line?.quantityDelta ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {Number(line?.quantityDelta ?? 0) >= 0 ? "+" : ""}
                    {formatQuantity(line?.quantityDelta ?? "0")}
                  </div>
                  <div>{formatMoney(line?.totalCostDelta ?? "0")}</div>
                  <div>{actor}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </InventoryModal>
  );
}
