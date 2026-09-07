"use client";

import InventoryModal from "@/components/admin/inventory/InventoryModal";
import type { DeleteEligibility, ProductDetail } from "@/lib/products";

type Props = {
  open: boolean;
  product: ProductDetail | null;
  submitting: boolean;
  eligibility: DeleteEligibility | null;
  loadingEligibility: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export default function DeleteProductDialog({
  open,
  product,
  submitting,
  eligibility,
  loadingEligibility,
  errorMessage,
  onClose,
  onConfirm,
}: Props) {
  if (!open || !product) {
    return null;
  }

  const resolvedEligibility = eligibility ?? product.deleteEligibility;

  return (
    <InventoryModal
      title="Delete Product Permanently"
      description="Use this only when delete eligibility confirms there is no protected history."
      onClose={onClose}
    >
      <div className="space-y-5">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
          {resolvedEligibility.eligible
            ? `You are permanently deleting ${product.name}. This cannot be undone.`
            : `Permanent delete is blocked for ${product.name}.`}
        </div>

        {loadingEligibility ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            Checking delete eligibility...
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        {!loadingEligibility && !resolvedEligibility.eligible ? (
          <ul className="space-y-2 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            {resolvedEligibility.blockingReasons.map((reason) => (
              <li key={reason.code}>
                {reason.message} ({reason.count})
              </li>
            ))}
          </ul>
        ) : null}

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
            disabled={submitting || loadingEligibility || !resolvedEligibility.eligible}
            className="rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Deleting..." : "Delete Product"}
          </button>
        </div>
      </div>
    </InventoryModal>
  );
}
