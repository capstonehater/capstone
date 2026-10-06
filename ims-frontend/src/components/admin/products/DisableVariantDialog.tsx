"use client";
import InventoryReportModal from "@/components/admin/inventory/InventoryReportModal";
import type { ProductVariantDetail } from "@/lib/products";
import styles from "./ProductActionDialog.module.css";
export default function DisableVariantDialog({ variant, submitting, error, onClose, onConfirm }: {
  variant: ProductVariantDetail; submitting: boolean; error: string | null; onClose: () => void; onConfirm: () => void;
}) {
  return <InventoryReportModal className={styles.variantDialog} title="Disable Variant" description="Confirm removing this variant from selling channels." onClose={() => { if (!submitting) onClose(); }}>
    <div className={styles.body}>
      <div className={styles.notice}>Are you sure you want to disable “{variant.name}”? It will no longer be available for sale. You can re-enable it anytime.</div>
      <div className={styles.summary}><p><b>Variant:</b> {variant.name}</p><p><b>SKU:</b> {variant.sku}</p><p>Existing recipes and sales history will be preserved.</p></div>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <footer className={styles.footer}><button type="button" className={styles.confirm} disabled={submitting} onClick={onConfirm}>{submitting ? "Disabling..." : "Disable Variant"}</button></footer>
    </div>
  </InventoryReportModal>;
}
