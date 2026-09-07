"use client";

import { useState } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (item: {
    name: string;
    categoryId?: number;
    category: string;
    type: "manufactured" | "retail";
    unit: string;
    expirationDate: string;
    sku: string;
    barcode: string;
    stock: number;
    supplierId?: number;
    supplier: string;
    unitPrice: number;
    lastRestocked: string;
  }) => void;
};

export default function AddItemModal({ isOpen, onClose, onSubmit }: Props) {
  const [form, setForm] = useState({
    name: "",
    categoryId: "",
    category: "",
    type: "retail" as "manufactured" | "retail",
    unit: "",
    expirationDate: "",
    sku: "",
    barcode: "",
    stock: "",
    supplierId: "",
    supplier: "",
    unitPrice: "",
    lastRestocked: "",
  });

  if (!isOpen) return null;

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !form.name ||
      !form.category ||
      !form.type ||
      !form.unit ||
      !form.expirationDate ||
      !form.sku ||
      !form.stock ||
      !form.supplier ||
      !form.unitPrice
    ) {
      alert("Please complete all required fields.");
      return;
    }

    onSubmit({
      name: form.name,
      categoryId: form.categoryId ? Number(form.categoryId) : undefined,
      category: form.category,
      type: form.type,
      unit: form.unit,
      expirationDate: form.expirationDate,
      sku: form.sku,
      barcode: form.barcode,
      stock: Number(form.stock),
      supplierId: form.supplierId ? Number(form.supplierId) : undefined,
      supplier: form.supplier,
      unitPrice: Number(form.unitPrice),
      lastRestocked: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    });

    setForm({
      name: "",
      categoryId: "",
      category: "",
      type: "retail",
      unit: "",
      expirationDate: "",
      sku: "",
      barcode: "",
      stock: "",
      supplierId: "",
      supplier: "",
      unitPrice: "",
      lastRestocked: "",
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-lg">
        <div className="p-6">
          <div className="mb-5">
            <h2 className="text-4xl font-bold text-neutral-900">Add New Item</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Fill in the details below to add a new item to your inventory
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="border-t border-neutral-400 pt-4">
              <h3 className="mb-4 text-2xl font-semibold text-neutral-900">
                Basic Information
              </h3>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-800">
                    Item Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="e.g. Milk"
                    className="w-full rounded-lg bg-[#d9d9d9] px-3 py-2 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-800">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.category}
                    onChange={(e) => updateField("category", e.target.value)}
                    placeholder="e.g. Beverage"
                    className="w-full rounded-lg bg-[#d9d9d9] px-3 py-2 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-800">
                    Product Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => updateField("type", e.target.value)}
                    className="w-full rounded-lg bg-[#d9d9d9] px-3 py-2 text-sm outline-none"
                  >
                    <option value="retail">Retail</option>
                    <option value="manufactured">Manufactured</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-800">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.unit}
                    onChange={(e) => updateField("unit", e.target.value)}
                    placeholder="e.g. pcs, 16oz, 22oz"
                    className="w-full rounded-lg bg-[#d9d9d9] px-3 py-2 text-sm outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-neutral-800">
                    Expiration Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.expirationDate}
                    onChange={(e) => updateField("expirationDate", e.target.value)}
                    placeholder="e.g. 3/20/2031"
                    className="w-full rounded-lg bg-[#d9d9d9] px-3 py-2 text-sm outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-neutral-400 pt-4">
              <h3 className="mb-4 text-2xl font-semibold text-neutral-900">
                Product Codes
              </h3>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-800">
                    SKU / Stock Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.sku}
                    onChange={(e) => updateField("sku", e.target.value)}
                    className="w-full rounded-lg bg-[#d9d9d9] px-3 py-2 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-800">
                    Barcode
                  </label>
                  <input
                    value={form.barcode}
                    onChange={(e) => updateField("barcode", e.target.value)}
                    placeholder="e.g. 6767676767"
                    className="w-full rounded-lg bg-[#d9d9d9] px-3 py-2 text-sm outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-neutral-400 pt-4">
              <h3 className="mb-4 text-2xl font-semibold text-neutral-900">
                Stock Information
              </h3>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-800">
                    Current Stock <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={(e) => updateField("stock", e.target.value)}
                    className="w-full rounded-lg bg-[#d9d9d9] px-3 py-2 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-800">
                    Unit Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.unitPrice}
                    onChange={(e) => updateField("unitPrice", e.target.value)}
                    className="w-full rounded-lg bg-[#d9d9d9] px-3 py-2 text-sm outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-neutral-400 pt-4">
              <h3 className="mb-4 text-2xl font-semibold text-neutral-900">
                Supplier
              </h3>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-800">
                    Supplier <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.supplier}
                    onChange={(e) => updateField("supplier", e.target.value)}
                    className="w-full rounded-lg bg-[#d9d9d9] px-3 py-2 text-sm outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-neutral-400 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-neutral-300 px-6 py-2 text-sm text-neutral-700"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="rounded-lg bg-[#f45a1f] px-6 py-2 text-sm font-medium text-white"
              >
                Add Item to Inventory
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}