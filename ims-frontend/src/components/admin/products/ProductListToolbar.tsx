"use client";

import { Plus } from "lucide-react";
import { inventoryInputClasses } from "@/components/admin/inventory/InventoryField";

type Props = {
  search: string;
  view: "active" | "archived";
  onSearchChange: (value: string) => void;
  onViewChange: (view: "active" | "archived") => void;
  onAddProduct: () => void;
};

export default function ProductListToolbar({
  search,
  view,
  onSearchChange,
  onViewChange,
  onAddProduct,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by product, variant, or SKU"
          className={inventoryInputClasses}
          aria-label="Search products"
        />
        <button
          type="button"
          onClick={onAddProduct}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f45a1f] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#d94f1a]"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
        {(["active", "archived"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onViewChange(option)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              view === option
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {option === "active" ? "Active" : "Archived"}
          </button>
        ))}
      </div>
    </div>
  );
}

