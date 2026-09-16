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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
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
          <div className="flex items-center gap-3"><h2 className="text-xl font-bold text-slate-900">{product.name}</h2><span className="rounded bg-green-100 px-2 py-1 text-[10px] font-bold uppercase text-green-700">{isArchived ? "Archived" : "Enabled"}</span></div>
          <p className="mt-1 text-xs text-slate-600">Category: <span className="text-blue-600">{product.category.name}</span></p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <span
              className={`font-medium ${archiveStateBadgeClasses(product.archive.state)}`}
            >
              {isArchived ? "Archived" : "Active"}
            </span>
            <span
              className={`font-medium ${manualAvailabilityBadgeClasses(product.manualAvailability)}`}
            >
              {summarizeAvailabilityLabel(product.manualAvailability)}
            </span>
            <span
              className={`font-medium ${effectiveStatusBadgeClasses(product.effectiveStatus)}`}
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
            className="rounded border border-blue-300 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 disabled:opacity-50"
          >
            Edit Product
          </button>
          <button
            type="button"
            onClick={onToggleManualAvailability}
            disabled={Boolean(submittingAction)}
            className="rounded border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 disabled:opacity-50"
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
              className="rounded border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              {submittingAction === "restore-product" ? "Restoring..." : "Restore Product"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onArchive}
              disabled={Boolean(submittingAction)}
              className="rounded border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
            >
              {submittingAction === "archive-product" ? "Archiving..." : "Archive Product"}
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            disabled={Boolean(submittingAction)}
            className="rounded border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
