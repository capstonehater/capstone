"use client";

import InventoryReportModal from "@/components/admin/inventory/InventoryReportModal";
import type { ProductVariantDetail } from "@/lib/products";
import styles from "./ProductActionDialog.module.css";

export default function DeleteVariantDialog({ variant, submitting, error, onClose, onConfirm }: {
  variant: ProductVariantDetail;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return <InventoryReportModal className={styles.variantDialog} title="Delete Variant" description="Confirm permanent deletion of this variant." onClose={() => { if (!submitting) onClose(); }}>
    <div className={styles.body}>
      <div className={styles.dangerNotice}>Are you sure you want to delete “{variant.name}”? This action cannot be undone.</div>
      <div className={styles.summary}>
        <p><b>Variant:</b> {variant.name}</p>
        <p><b>SKU:</b> {variant.sku}</p>
        <p>Variants with protected sales history or dependencies cannot be deleted.</p>
      </div>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <footer className={styles.footer}>
        <button type="button" className={styles.danger} disabled={submitting} onClick={onConfirm}>{submitting ? "Deleting..." : "Delete Variant"}</button>
      </footer>
    </div>
  </InventoryReportModal>;
}
