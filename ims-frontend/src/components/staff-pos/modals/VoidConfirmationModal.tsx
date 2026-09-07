import type { PosCartItem } from "@/lib/pos";
import { formatPeso } from "@/lib/pos-utils";
import Modal from "./Modal";

type Props = {
  item: PosCartItem;
  onClose: () => void;
  onConfirm: () => void;
};

export default function VoidConfirmationModal({
  item,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Modal title="Void Item Confirmation" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
          You are about to remove this item from the current transaction.
        </div>

        <div className="rounded-2xl border border-slate-200 p-4 text-sm">
          <p className="font-semibold text-slate-900">{item.productName}</p>
          <p className="mt-1 text-slate-500">
            {item.quantity}x • {item.variantName}
          </p>
          {item.modifierSelections.length > 0 ? (
            <p className="mt-1 text-slate-500">
              {item.modifierSelections
                .map((modifier) => `${modifier.name} x${modifier.quantity}`)
                .join(", ")}
            </p>
          ) : null}
          <p className="mt-2 font-medium text-slate-900">{formatPeso(item.lineSubtotal)}</p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            type="button"
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium"
          >
            Keep Item
          </button>
          <button
            onClick={onConfirm}
            type="button"
            className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white"
          >
            Confirm Void
          </button>
        </div>
      </div>
    </Modal>
  );
}
