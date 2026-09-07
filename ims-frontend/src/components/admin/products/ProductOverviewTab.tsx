"use client";

import type { ProductDetail } from "@/lib/products";
import ProductAvailabilitySummary from "./ProductAvailabilitySummary";
import ProductQualityWarnings from "./ProductQualityWarnings";
import { formatDateTime } from "./product-ui";

type Props = {
  product: ProductDetail;
};

export default function ProductOverviewTab({ product }: Props) {
  return (
    <div className="space-y-5">
      <ProductAvailabilitySummary product={product} />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Variants
          </p>
          <p className="mt-3 text-2xl font-bold text-slate-900">{product.variantCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Distinct ingredients
          </p>
          <p className="mt-3 text-2xl font-bold text-slate-900">{product.ingredientCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Updated
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-900">
            {formatDateTime(product.updatedAt)}
          </p>
        </div>
      </div>

      <ProductQualityWarnings warnings={product.qualityWarnings} />

      {product.archive.state === "ARCHIVED" ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
          Archived on {formatDateTime(product.archive.archivedAt)} by{" "}
          {product.archive.archivedBy
            ? `${product.archive.archivedBy.firstName} ${product.archive.archivedBy.lastName}`
            : "unknown user"}
          . Reason: {product.archive.archiveReason ?? "No reason provided"}.
        </div>
      ) : null}

      {!product.deleteEligibility.eligible ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Permanent delete is currently blocked.</p>
          <ul className="mt-2 space-y-1">
            {product.deleteEligibility.blockingReasons.map((reason) => (
              <li key={reason.code}>
                {reason.message} ({reason.count})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

