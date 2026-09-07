"use client";

import type { ProductDetail } from "@/lib/products";
import {
  effectiveStatusBadgeClasses,
  manualAvailabilityBadgeClasses,
  stockAvailabilityBadgeClasses,
  summarizeAvailabilityLabel,
} from "./product-ui";

type Props = {
  product: ProductDetail;
};

export default function ProductAvailabilitySummary({ product }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Effective POS
        </p>
        <span
          className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${effectiveStatusBadgeClasses(product.effectiveStatus)}`}
        >
          {product.effectiveStatusLabel}
        </span>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Manual availability
        </p>
        <span
          className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${manualAvailabilityBadgeClasses(product.manualAvailability)}`}
        >
          {summarizeAvailabilityLabel(product.manualAvailability)}
        </span>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Stock availability
        </p>
        <span
          className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${stockAvailabilityBadgeClasses(product.stockAvailability.status)}`}
        >
          {product.stockAvailability.status}
        </span>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Top blocker
        </p>
        <p className="mt-3 text-sm font-semibold text-slate-900">
          {product.topBlockingReason ?? "None"}
        </p>
      </div>
    </div>
  );
}

