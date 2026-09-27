"use client";

import type { ProductListItem as ProductListItemModel } from "@/lib/products";
import ProductListEmptyState from "./ProductListEmptyState";
import ProductListItem from "./ProductListItem";
import ProductListSkeleton from "./ProductListSkeleton";

type Props = {
  items: ProductListItemModel[];
  loading: boolean;
  selectedId: string | null;
  hasFilters: boolean;
  archivedView: boolean;
  onSelect: (productId: string) => void;
};

export default function ProductList({
  items,
  loading,
  selectedId,
  hasFilters,
  archivedView,
  onSelect,
}: Props) {
  if (loading) {
    return <ProductListSkeleton />;
  }

  if (items.length === 0) {
    return <ProductListEmptyState hasFilters={hasFilters} archivedView={archivedView} />;
  }

  return (
    <div className="h-full overflow-auto rounded-lg border border-slate-300">
      <table className="w-full table-fixed border-collapse text-xs"><thead className="sticky top-0 bg-slate-100 text-left text-[11px] font-bold text-slate-500"><tr><th className="w-[52%] px-3 py-2">Product</th><th className="w-[22%] px-2 py-2 text-center">Variants</th><th className="w-[26%] px-2 py-2 text-center">Ingredients</th></tr></thead><tbody className="divide-y divide-slate-200">
      {items.map((item, index) => (
        <ProductListItem
          key={item.id}
          item={item}
          selected={item.id === selectedId}
          onSelect={() => onSelect(item.id)}
          onSelectRelative={(direction) => {
            const next = items[index + direction];
            if (next) {
              onSelect(next.id);
            }
          }}
        />
      ))}
      </tbody></table>
    </div>
  );
}
