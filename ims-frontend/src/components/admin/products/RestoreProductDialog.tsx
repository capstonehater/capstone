"use client";

import InventoryModal from "@/components/admin/inventory/InventoryModal";
import type { ProductDetail } from "@/lib/products";

type Props = {
  open: boolean;
  product: ProductDetail | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export default function RestoreProductDialog({
  open,
  product,
  submitting,
  onClose,
  onConfirm,
}: Props) {
  if (!open || !product) {
    return null;
  }

  return (
    <InventoryModal
      title="Restore Product"
      description="This moves the product back into the active product workspace."
      onClose={onClose}
    >
      <div className="space-y-5">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
          Restore <span className="font-semibold">{product.name}</span> to the active view.
        </div>
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
            onClick={() => void onConfirm()}
            disabled={submitting}
            className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Restoring..." : "Restore Product"}
          </button>
        </div>
      </div>
    </InventoryModal>
  );
}

