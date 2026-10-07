import { useEffect, useRef } from "react";
import { AlertTriangle, ShoppingBag, Trash2 } from "lucide-react";
import type { PosCartItem } from "@/lib/pos";
import { formatPeso } from "@/lib/pos-utils";
import Modal from "./Modal";
import styles from "./CancelTransactionModal.module.css";

type Props = {
  items: PosCartItem[];
  total: number;
  onClose: () => void;
  onConfirm: () => void;
};

export default function CancelTransactionModal({ items, total, onClose, onConfirm }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    keepRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  const quantity = items.reduce((count, item) => count + item.quantity, 0);
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Cancel transaction" aria-describedby="cancel-transaction-description" onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); onClose(); }
      if (event.key !== "Tab") return;
      const controls = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
      <Modal title="Cancel transaction" onClose={onClose} panelClassName={styles.panel} bodyClassName={styles.body} footer={
        <div className={styles.footer}>
          <button ref={keepRef} type="button" onClick={onClose} className={styles.keep}>Keep transaction</button>
          <button type="button" onClick={onConfirm} className={styles.cancel}><Trash2 size={16} aria-hidden="true" />Cancel transaction</button>
        </div>
      }>
        <div className={styles.intro}>
          <span className={styles.icon}><AlertTriangle size={24} aria-hidden="true" /></span>
          <div><h3>Discard this current order?</h3><p id="cancel-transaction-description">Review the order below before cancelling. This action cannot be undone.</p></div>
        </div>
        <section className={styles.summary} aria-label="Current order summary">
          <div className={styles.summaryHeader}><span><ShoppingBag size={16} aria-hidden="true" />Current order</span><span>{quantity} {quantity === 1 ? "item" : "items"}</span></div>
          <ul className={styles.items}>{items.map(item => <li key={item.cartId}>
            <span className={styles.quantity}>{item.quantity}×</span>
            <div><p>{item.productName}</p><small>{item.variantName}{item.modifierSelections.length > 0 ? ` · ${item.modifierSelections.map(modifier => `${modifier.name} ×${modifier.quantity}`).join(", ")}` : ""}</small></div>
            <strong>{formatPeso(item.lineSubtotal)}</strong>
          </li>)}</ul>
          <div className={styles.total}><span>Total after discount</span><strong>{formatPeso(total)}</strong></div>
        </section>
        <div className={styles.warning}><AlertTriangle size={17} aria-hidden="true" /><div><strong>What happens when you cancel</strong><p>All cart items, discounts, transaction notes, and entered payment amounts will be cleared. You can then start a new order.</p></div></div>
        <p className={styles.hint}>This cancels the unsubmitted order only. Completed sales must be refunded through the receipt.</p>
      </Modal>
    </div>
  );
}
