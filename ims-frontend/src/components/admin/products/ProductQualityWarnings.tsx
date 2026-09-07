"use client";

import type { ProductQualityWarning } from "@/lib/products";
import { warningToneClasses } from "./product-ui";

type Props = {
  warnings: ProductQualityWarning[];
};

export default function ProductQualityWarnings({ warnings }: Props) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {warnings.map((warning) => (
        <div
          key={warning.code}
          className={`rounded-3xl border px-4 py-3 text-sm ${warningToneClasses(warning.tone)}`}
        >
          {warning.message}
        </div>
      ))}
    </div>
  );
}

