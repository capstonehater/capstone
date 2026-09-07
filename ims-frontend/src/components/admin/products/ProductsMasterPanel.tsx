"use client";

import type {
  ProductCategory,
  ProductEffectiveStatus,
  ProductListResponse,
} from "@/lib/products";
import ProductFilters from "./ProductFilters";
import ProductList from "./ProductList";
import ProductListToolbar from "./ProductListToolbar";
import ProductPagination from "./ProductPagination";

type Props = {
  categories: ProductCategory[];
  search: string;
  view: "active" | "archived";
  categoryId: string;
  manualAvailability: "" | "enabled" | "disabled";
  effectiveAvailability: "" | ProductEffectiveStatus;
  loading: boolean;
  listResponse: ProductListResponse | null;
  selectedId: string | null;
  onSearchChange: (value: string) => void;
  onViewChange: (view: "active" | "archived") => void;
  onCategoryChange: (value: string) => void;
  onManualAvailabilityChange: (value: "" | "enabled" | "disabled") => void;
  onEffectiveAvailabilityChange: (value: "" | ProductEffectiveStatus) => void;
  onClearFilters: () => void;
  onAddProduct: () => void;
  onSelectProduct: (productId: string) => void;
  onPageChange: (page: number) => void;
};

export default function ProductsMasterPanel({
  categories,
  search,
  view,
  categoryId,
  manualAvailability,
  effectiveAvailability,
  loading,
  listResponse,
  selectedId,
  onSearchChange,
  onViewChange,
  onCategoryChange,
  onManualAvailabilityChange,
  onEffectiveAvailabilityChange,
  onClearFilters,
  onAddProduct,
  onSelectProduct,
  onPageChange,
}: Props) {
  const items = listResponse?.items ?? [];
  const pagination = listResponse?.pagination;

  return (
    <section className="flex h-full min-h-[65vh] flex-col rounded-[28px] bg-white p-5 shadow-sm">
      <ProductListToolbar
        search={search}
        view={view}
        onSearchChange={onSearchChange}
        onViewChange={onViewChange}
        onAddProduct={onAddProduct}
      />

      <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
        <ProductFilters
          categories={categories}
          categoryId={categoryId}
          manualAvailability={manualAvailability}
          effectiveAvailability={effectiveAvailability}
          onCategoryChange={onCategoryChange}
          onManualAvailabilityChange={onManualAvailabilityChange}
          onEffectiveAvailabilityChange={onEffectiveAvailabilityChange}
          onClearFilters={onClearFilters}
        />
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        <ProductList
          items={items}
          loading={loading}
          selectedId={selectedId}
          hasFilters={Boolean(search || categoryId || manualAvailability || effectiveAvailability)}
          archivedView={view === "archived"}
          onSelect={onSelectProduct}
        />
      </div>

      <div className="mt-4 border-t border-slate-200 pt-4">
        <ProductPagination
          page={pagination?.page ?? 1}
          totalPages={pagination?.totalPages ?? 1}
          totalItems={pagination?.totalItems ?? items.length}
          onPageChange={onPageChange}
        />
      </div>
    </section>
  );
}

