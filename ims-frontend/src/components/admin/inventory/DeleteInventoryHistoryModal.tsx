"use client";

import { useRef, useState } from "react";
import type { InventoryTransaction } from "@/lib/inventory";
import InventoryModal from "./InventoryModal";

export default function DeleteInventoryHistoryModal({ transaction, onClose, onDelete, formatDateTime }: {
  transaction: InventoryTransaction;
  onClose: () => void;
  onDelete: (transactionId: string) => Promise<void>;
  formatDateTime: (value: string | null | undefined) => string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  async function confirmDelete() {
    if (pending.current) return;
    pending.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await onDelete(transaction.id);
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to delete history entry");
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }
  return (
    <InventoryModal professional title="Delete Inventory History"
      description="Remove this entry from history and undo its original stock movement."
      onClose={() => { if (!pending.current) onClose(); }}>
      <div className="space-y-5">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <p className="font-semibold">{transaction.type.replaceAll("_", " ")} · {formatDateTime(transaction.occurredAt)}</p>
          <p className="mt-2">{transaction.note || transaction.reasonCode || `Entry ${transaction.id.slice(0, 8)}`}</p>
        </div>
        <p className="text-sm text-slate-600">Stock added by this entry will be removed. Stock deducted by this entry will be restored. This applies to every material and batch in the transaction.</p>
        <p className="text-sm text-slate-600">If there is insufficient stock to undo the movement, nothing will be deleted. Sales and payment records stay unchanged.</p>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" disabled={submitting} onClick={onClose} className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold disabled:opacity-50">Cancel</button>
          <button type="button" disabled={submitting} onClick={() => void confirmDelete()} className="rounded-full bg-rose-700 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50">
            {submitting ? "Deleting…" : "Delete & Undo Stock"}
          </button>
        </div>
      </div>
    </InventoryModal>
  );
}
