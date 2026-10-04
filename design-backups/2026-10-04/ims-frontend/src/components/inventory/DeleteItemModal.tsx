"use client";

import type { InventoryItem } from "../../types/inventory";
import ModalCloseButton from "@/components/ModalCloseButton";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  onConfirm: (id: number) => void;
};

export default function DeleteItemModal({
  isOpen,
  onClose,
  item,
  onConfirm,
}: Props) {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-[5px] p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <header className="mb-3 flex items-center justify-between border-b border-neutral-200 pb-3">
          <h2 className="text-xl font-bold text-red-600">Delete Item</h2>
          <ModalCloseButton onClose={onClose} />
        </header>
        <p className="mt-3 text-sm text-neutral-600">
          Are you sure you want to delete <span className="font-semibold">{item.name}</span>?
          This action cannot be undone.
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => onConfirm(item.id)}
            className="rounded-lg bg-red-600 px-4 py-2 text-white"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
