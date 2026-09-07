"use client";

import type { InventoryItem } from "../../types/inventory";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
};

export default function ViewItemModal({ isOpen, onClose, item }: Props) {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Item Details</h2>
            <p className="text-sm text-neutral-500">
              View complete inventory information.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg border px-3 py-2 text-sm text-neutral-700"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-[#f9f7f2] p-4">
            <p className="text-sm text-neutral-500">Item Name</p>
            <p className="text-lg font-semibold">{item.name}</p>
          </div>

          <div className="rounded-xl bg-[#f9f7f2] p-4">
            <p className="text-sm text-neutral-500">Category</p>
            <p className="text-lg font-semibold">{item.category}</p>
          </div>

          <div className="rounded-xl bg-[#f9f7f2] p-4">
            <p className="text-sm text-neutral-500">Type</p>
            <p className="text-lg font-semibold">{item.type}</p>
          </div>

          <div className="rounded-xl bg-[#f9f7f2] p-4">
            <p className="text-sm text-neutral-500">Unit</p>
            <p className="text-lg font-semibold">{item.unit}</p>
          </div>

          <div className="rounded-xl bg-[#f9f7f2] p-4">
            <p className="text-sm text-neutral-500">Expiration Date</p>
            <p className="text-lg font-semibold">{item.expirationDate}</p>
          </div>

          <div className="rounded-xl bg-[#f9f7f2] p-4">
            <p className="text-sm text-neutral-500">SKU</p>
            <p className="text-lg font-semibold">{item.sku}</p>
          </div>

          <div className="rounded-xl bg-[#f9f7f2] p-4">
            <p className="text-sm text-neutral-500">Current Stock</p>
            <p className="text-lg font-semibold">{item.stock}</p>
          </div>

          <div className="rounded-xl bg-[#f9f7f2] p-4">
            <p className="text-sm text-neutral-500">Supplier</p>
            <p className="text-lg font-semibold">{item.supplier}</p>
          </div>

          <div className="rounded-xl bg-[#f9f7f2] p-4">
            <p className="text-sm text-neutral-500">Unit Price</p>
            <p className="text-lg font-semibold">₱{item.unitPrice}</p>
          </div>

          <div className="rounded-xl bg-[#f9f7f2] p-4">
            <p className="text-sm text-neutral-500">Status</p>
            <p className="text-lg font-semibold">{item.status}</p>
          </div>

          <div className="rounded-xl bg-[#f9f7f2] p-4 md:col-span-2">
            <p className="text-sm text-neutral-500">Last Restocked</p>
            <p className="text-lg font-semibold">{item.lastRestocked}</p>
          </div>
        </div>
      </div>
    </div>
  );
}