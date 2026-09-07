"use client";

import { useState } from "react";
import { inventoryTextareaClasses } from "@/components/admin/inventory/InventoryField";
import InventoryModal from "@/components/admin/inventory/InventoryModal";
import type { ProductDetail } from "@/lib/products";

type Props = {
  open: boolean;
  product: ProductDetail | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
};

export default function ArchiveProductDialog({
  open,
  product,
  submitting,
  onClose,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState("Archived from admin product workspace");

  if (!open || !product) {
    return null;
  }

  return (
    <InventoryModal
      title="Archive Product"
      description="This removes the product from the active list while preserving all related history."
      onClose={onClose}
    >
      <div className="space-y-5">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
          You are archiving <span className="font-semibold">{product.name}</span>.
        </div>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className={inventoryTextareaClasses}
          placeholder="Reason for archiving"
        />
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm(reason)}
            disabled={submitting}
            className="rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Archiving..." : "Archive Product"}
          </button>
        </div>
      </div>
    </InventoryModal>
  );
}

