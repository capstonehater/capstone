"use client";

import { useState } from "react";
import type { InventoryItem } from "../../types/inventory";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  onSubmit: (updatedItem: InventoryItem) => void;
};

export default function RestockItemModal({
  isOpen,
  onClose,
  item,
  onSubmit,
}: Props) {
  const [expirationDate, setExpirationDate] = useState(
    item ? item.expirationDate : ""
  );
  const [stock, setStock] = useState(item ? String(item.stock) : "");
  const [unitPrice, setUnitPrice] = useState(
    item ? String(item.unitPrice) : ""
  );
  const [supplier, setSupplier] = useState(item ? item.supplier : "");

  if (!isOpen || !item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedStock = Number(stock);
    const parsedUnitPrice = Number(unitPrice);

    if (Number.isNaN(parsedStock) || Number.isNaN(parsedUnitPrice)) {
      alert("Please enter valid values.");
      return;
    }

    let status: InventoryItem["status"] = "In Stock";
    if (parsedStock === 0) status = "Out of Stock";
    else if (parsedStock <= item.reorderPoint) status = "Low Stock";

    onSubmit({
      ...item,
      expirationDate,
      stock: parsedStock,
      unitPrice: parsedUnitPrice,
      supplier,
      totalValue: `₱${parsedStock * parsedUnitPrice}`,
      status,
      lastRestocked: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    });
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Restock Item</h2>
            <p className="text-sm text-neutral-500">
              Update expiration date, stock, unit price, and current supplier.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-2 text-sm text-neutral-700"
          >
            Close
          </button>
        </div>

        <div className="mb-5 rounded-xl bg-[#f9f7f2] p-4">
          <p className="text-sm text-neutral-500">Item</p>
          <p className="text-lg font-semibold">{item.name}</p>
          <p className="mt-1 text-sm text-neutral-500">
            Category: {item.category}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Type: {item.type} • Unit: {item.unit}
          </p>
          <p className="mt-1 text-sm text-neutral-500">SKU: {item.sku}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">
                Expiration Date
              </label>
              <input
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full rounded-lg border p-3"
                placeholder="Enter expiration date"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">
                Current Stock
              </label>
              <input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full rounded-lg border p-3"
                placeholder="Enter updated stock"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">
                Unit Price
              </label>
              <input
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full rounded-lg border p-3"
                placeholder="Enter updated unit price"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-800">
                Current Supplier
              </label>
              <input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full rounded-lg border p-3"
                placeholder="Enter supplier name"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-neutral-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="rounded-lg bg-[#f45a1f] px-4 py-2 text-white"
            >
              Save Restock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}