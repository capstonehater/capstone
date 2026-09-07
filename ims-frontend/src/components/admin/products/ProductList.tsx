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
    <div className="space-y-3">
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
    </div>
  );
}

