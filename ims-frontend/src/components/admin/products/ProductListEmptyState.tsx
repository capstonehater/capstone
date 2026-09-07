"use client";

type Props = {
  hasFilters: boolean;
  archivedView: boolean;
};

export default function ProductListEmptyState({
  hasFilters,
  archivedView,
}: Props) {
  const title = hasFilters
    ? "No products matched the current filters."
    : archivedView
      ? "No archived products yet."
      : "No products available yet.";

  const description = hasFilters
    ? "Try clearing one or more filters or broadening your search terms."
    : archivedView
      ? "Archived products will appear here once they are restored out of the active workspace."
      : "Create a product to start managing menu items, variants, and recipes.";

  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

