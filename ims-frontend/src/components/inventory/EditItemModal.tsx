"use client";

import { useEffect, useState } from "react";
import type { InventoryItem } from "../../types/inventory";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  onSubmit: (updatedItem: InventoryItem) => void;
};

export default function EditItemModal({
  isOpen,
  onClose,
  item,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<InventoryItem | null>(item);

  useEffect(() => {
    setForm(item);
  }, [item]);

  if (!isOpen || !item || !form) return null;

  const updateField = (key: keyof InventoryItem, value: string | number | boolean | undefined) => {
    setForm((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: value };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const stock = Number(form.stock);
    const unitPrice = Number(form.unitPrice);
    const reorderPoint = Number(form.reorderPoint);

    let status: InventoryItem["status"] = "In Stock";
    if (stock === 0) status = "Out of Stock";
    else if (stock <= reorderPoint) status = "Low Stock";

    onSubmit({
      ...form,
      stock,
      unitPrice,
      reorderPoint,
      totalValue: `₱${stock * unitPrice}`,
      status,
    });
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Edit Item</h2>
            <p className="text-sm text-neutral-500">
              Update the selected inventory item.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg border px-3 py-2 text-sm text-neutral-700"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Item Name"
              className="rounded-lg border p-3"
            />

            <input
              value={form.category}
              onChange={(e) => updateField("category", e.target.value)}
              placeholder="Category"
              className="rounded-lg border p-3"
            />

            <select
              value={form.type}
              onChange={(e) =>
                updateField("type", e.target.value as "manufactured" | "retail")
              }
              className="rounded-lg border p-3"
            >
              <option value="retail">Retail</option>
              <option value="manufactured">Manufactured</option>
            </select>

            <input
              value={form.unit}
              onChange={(e) => updateField("unit", e.target.value)}
              placeholder="Unit"
              className="rounded-lg border p-3"
            />

            <input
              value={form.expirationDate}
              onChange={(e) => updateField("expirationDate", e.target.value)}
              placeholder="Expiration Date"
              className="rounded-lg border p-3"
            />

            <input
              value={form.sku}
              onChange={(e) => updateField("sku", e.target.value)}
              placeholder="SKU"
              className="rounded-lg border p-3"
            />

            <input
              type="number"
              value={form.stock}
              onChange={(e) => updateField("stock", Number(e.target.value))}
              placeholder="Current Stock"
              className="rounded-lg border p-3"
            />

            <input
              type="number"
              value={form.reorderPoint}
              onChange={(e) => updateField("reorderPoint", Number(e.target.value))}
              placeholder="Reorder Point"
              className="rounded-lg border p-3"
            />

            <input
              type="number"
              value={form.unitPrice}
              onChange={(e) => updateField("unitPrice", Number(e.target.value))}
              placeholder="Unit Price"
              className="rounded-lg border p-3"
            />

            <input
              value={form.supplier}
              onChange={(e) => updateField("supplier", e.target.value)}
              placeholder="Supplier"
              className="rounded-lg border p-3"
            />

            <input
              value={form.lastRestocked}
              onChange={(e) => updateField("lastRestocked", e.target.value)}
              placeholder="Last Restocked"
              className="rounded-lg border p-3 md:col-span-2"
            />
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
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}