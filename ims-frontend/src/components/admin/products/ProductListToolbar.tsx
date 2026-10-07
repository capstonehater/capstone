"use client";
import SearchInput from "@/components/ui/SearchInput";
import { PermissionAction } from "@/components/auth/PermissionGuard";

import styles from "./ProductListToolbar.module.css";
import { Plus, Search } from "lucide-react";

type Props = {
  search: string;
  view: "active" | "archived";
  onSearchChange: (value: string) => void;
  onViewChange: (view: "active" | "archived") => void;
  onAddProduct: () => void;
  onCreateCategory: () => void;
  productCounts: { active: number; archived: number };
};

export default function ProductListToolbar({
  search,
  view,
  onSearchChange,
  onViewChange,
  onAddProduct,
  onCreateCategory,
  productCounts,
}: Props) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.searchRow}>
        <div className="relative min-w-0 flex-1">
        <SearchInput
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search products..."
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 pr-9 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-500"
          aria-label="Search products"
        />
        <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
        </div>

      </div>

      <div className={styles.actions}>
        <PermissionAction permission={"products.create"}><button
          type="button"
          onClick={onAddProduct}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg! bg-[#232d46] px-4 text-xs font-semibold text-white transition hover:bg-[#34425f]"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </button></PermissionAction>
      </div>

      <div className={styles.views}>
        {(["active", "archived"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onViewChange(option)}
            className={`rounded-lg! px-4 py-2 text-xs font-semibold transition ${
              view === option
              ? "border border-slate-300 bg-slate-100 text-slate-900"
              : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            {option === "active" ? `All Products (${productCounts.active})` : `Archived Products (${productCounts.archived})`}
          </button>
        ))}
        <PermissionAction permission="products.create"><button type="button" onClick={onCreateCategory} className={styles.createCategory}><Plus className="h-4 w-4" /> Create Category</button></PermissionAction>
      </div>
    </div>
  );
}
