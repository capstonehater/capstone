"use client";
import InventoryReportModal from "@/components/admin/inventory/InventoryReportModal";
import type { ProductDetail } from "@/lib/products";
import styles from "./ProductActionDialog.module.css";
type Props = { open: boolean; product: ProductDetail | null; submitting: boolean; onClose: () => void; onConfirm: () => Promise<void> };
export default function RestoreProductDialog({ open, product, submitting, onClose, onConfirm }: Props) {
  if (!open || !product) return null;
  return <InventoryReportModal className={styles.variantDialog} title="Restore Product" description="Return this archived product to the active product workspace." onClose={() => { if (!submitting) onClose(); }}>
    <div className={styles.body}>
      <div className={styles.notice}>This product will appear in active product lists again. Existing history and configuration will be preserved.</div>
      <div className={styles.summary}>
        <p><b>Product:</b> {product.name}</p><p><b>Category:</b> {product.category.name}</p>
        <p><b>Current lifecycle:</b> Archived</p><p><b>Variants:</b> {product.variantCount} &nbsp; <b>Ingredients:</b> {product.ingredientCount}</p>
      </div>
      <footer className={styles.footer}><button type="button" className={styles.confirm} disabled={submitting} onClick={() => void onConfirm()}>{submitting ? "Restoring..." : "Restore Product"}</button></footer>
    </div>
  </InventoryReportModal>;
}
