"use client";

import type { ProductDetail } from "@/lib/products";
import {
  archiveStateBadgeClasses,
  effectiveStatusBadgeClasses,
  manualAvailabilityBadgeClasses,
  summarizeAvailabilityLabel,
} from "./product-ui";

type Props = {
  product: ProductDetail;
  mobileBackVisible: boolean;
  submittingAction: string | null;
  onBackToList: () => void;
  onEdit: () => void;
  onToggleManualAvailability: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
};

export default function ProductDetailHeader({
  product,
  mobileBackVisible,
  submittingAction,
  onBackToList,
  onEdit,
  onToggleManualAvailability,
  onArchive,
  onRestore,
  onDelete,
}: Props) {
  const isArchived = product.archive.state === "ARCHIVED";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-4">
        <div>
          {mobileBackVisible ? (
            <button
              type="button"
              onClick={onBackToList}
              className="mb-3 inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 xl:hidden"
            >
              Back to products
            </button>
          ) : null}
          <h2 className="text-xl font-bold text-slate-900">{product.name}</h2>
          <p className="mt-1 text-xs text-slate-600">Category: <span className="text-slate-700">{product.category.name}</span></p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${archiveStateBadgeClasses(product.archive.state)}`}
            >
              {isArchived ? "Archived" : "Active"}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${manualAvailabilityBadgeClasses(product.manualAvailability)}`}
            >
              {summarizeAvailabilityLabel(product.manualAvailability)}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${effectiveStatusBadgeClasses(product.effectiveStatus)}`}
            >
              {product.effectiveStatusLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEdit}
            disabled={Boolean(submittingAction)}
            className="rounded-md border border-[#232d46] bg-[#232d46] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#34425f] disabled:opacity-50"
          >
            Edit Product
          </button>
          <button
            type="button"
            onClick={onToggleManualAvailability}
            disabled={Boolean(submittingAction)}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            {submittingAction === "toggle-product"
              ? "Saving..."
              : product.manualAvailability === "ENABLED"
                ? "Disable Product"
                : "Enable Product"}
          </button>
          {isArchived ? (
            <button
              type="button"
              onClick={onRestore}
              disabled={Boolean(submittingAction)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              {submittingAction === "restore-product" ? "Restoring..." : "Restore Product"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onArchive}
              disabled={Boolean(submittingAction)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              {submittingAction === "archive-product" ? "Archiving..." : "Archive Product"}
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            disabled={Boolean(submittingAction)}
            className="rounded-md border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-800 transition hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
