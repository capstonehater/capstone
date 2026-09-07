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
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          {mobileBackVisible ? (
            <button
              type="button"
              onClick={onBackToList}
              className="mb-3 inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 lg:hidden"
            >
              Back to products
            </button>
          ) : null}
          <h2 className="text-2xl font-bold text-slate-900">{product.name}</h2>
          <p className="mt-2 text-sm text-slate-500">{product.category.name}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${archiveStateBadgeClasses(product.archive.state)}`}
            >
              {isArchived ? "Archived" : "Active"}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${manualAvailabilityBadgeClasses(product.manualAvailability)}`}
            >
              {summarizeAvailabilityLabel(product.manualAvailability)}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${effectiveStatusBadgeClasses(product.effectiveStatus)}`}
            >
              {product.effectiveStatusLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <button
            type="button"
            onClick={onEdit}
            disabled={Boolean(submittingAction)}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Edit Product
          </button>
          <button
            type="button"
            onClick={onToggleManualAvailability}
            disabled={Boolean(submittingAction)}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
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
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              {submittingAction === "restore-product" ? "Restoring..." : "Restore Product"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onArchive}
              disabled={Boolean(submittingAction)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              {submittingAction === "archive-product" ? "Archiving..." : "Archive Product"}
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            disabled={Boolean(submittingAction)}
            className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

