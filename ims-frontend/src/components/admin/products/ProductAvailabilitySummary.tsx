"use client";

import styles from "./ProductAvailabilitySummary.module.css";
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
  const readableStatus = (value: string) => {
    const text = value.toLowerCase().replaceAll("_", " ");
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  return (
    <div className={styles.summary}><div className={styles.grid}>
      <div className={styles.card}>
        <p className={styles.label}>
          POS availability
        </p>
        <span
          className={`${styles.badge} inline-flex rounded-full px-3 py-1 text-sm font-semibold ${effectiveStatusBadgeClasses(product.effectiveStatus)}`}
        >
          {product.effectiveStatusLabel}
        </span>
      </div>
      <div className={styles.card}>
        <p className={styles.label}>
          Manual availability
        </p>
        <span
          className={`${styles.badge} inline-flex rounded-full px-3 py-1 text-sm font-semibold ${manualAvailabilityBadgeClasses(product.manualAvailability)}`}
        >
          {summarizeAvailabilityLabel(product.manualAvailability)}
        </span>
      </div>
      <div className={styles.card}>
        <p className={styles.label}>
          Stock availability
        </p>
        <span
          className={`${styles.badge} inline-flex rounded-full px-3 py-1 text-sm font-semibold ${stockAvailabilityBadgeClasses(product.stockAvailability.status)}`}
        >
          {readableStatus(product.stockAvailability.status)}
        </span>
      </div>
      <div className={styles.card}>
        <p className={styles.label}>
          Main issue
        </p>
        <p className={styles.value}>
          {product.topBlockingReason ? readableStatus(product.topBlockingReason) : "None"}
        </p>
      </div>
    </div></div>
  );
}

