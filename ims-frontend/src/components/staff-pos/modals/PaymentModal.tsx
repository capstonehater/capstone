import type { Dispatch, SetStateAction } from "react";
import { Banknote, Check, CreditCard, Wallet } from "lucide-react";
import { formatPeso } from "@/lib/pos-utils";
import Modal from "./Modal";
import styles from "./PaymentModal.module.css";

export type PaymentState = {
  cash: string;
  gcash: string;
  maya: string;
  card: string;
};

type Props = {
  total: number;
  cartCount: number;
  payments: PaymentState;
  setPayments: Dispatch<SetStateAction<PaymentState>>;
  onClose: () => void;
  onConfirm: () => void;
  cashCorrection?: boolean;
  submitting?: boolean;
  error?: string | null;
};

export default function PaymentModal({
  total,
  cartCount,
  payments,
  setPayments,
  onClose,
  onConfirm,
  cashCorrection = false,
  submitting = false,
  error,
}: Props) {
  const totalPaid =
    Number(payments.cash || 0) +
    Number(payments.gcash || 0) +
    Number(payments.maya || 0) +
    Number(payments.card || 0);
  const remaining = Math.max(total - totalPaid, 0);
  const change = Math.max(totalPaid - total, 0);

  const methods = [
    { key: "cash", label: "Cash", icon: Banknote },
    { key: "gcash", label: "GCash", icon: Wallet },
    { key: "maya", label: "Maya", icon: Wallet },
    { key: "card", label: "Card", icon: CreditCard },
  ] as const;

  return (
    <Modal title="Payment Confirmation" onClose={submitting ? () => {} : onClose} panelClassName={styles.modal} bodyClassName={styles.body} footer={
      <footer className={styles.footer}>
        <button onClick={onConfirm} type="button" disabled={submitting || cartCount === 0 || totalPaid < total} className={styles.confirm}>
          <Check size={18} aria-hidden="true" />{submitting ? "Saving..." : cashCorrection ? "Update Payment" : "Confirm Payment"}
        </button>
      </footer>
    }>
      {error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className={styles.totalCard}>
        <div><p className={styles.eyebrow}>Total due</p><p className={styles.total}>{formatPeso(total)}</p></div>
        <span className={styles.itemCount}>{cartCount} {cartCount === 1 ? "item" : "items"}</span>
      </div>
      <div className={styles.grid}>
        <section className={styles.methods} aria-label="Payment methods">
          <h3 className={styles.sectionTitle}>Payment methods</h3>
          <p className={styles.description}>{cashCorrection ? "Update the cash received for this order." : "Enter the amount received for each method."}</p>
          <div className={styles.fields}>
            {methods.map(({ key, label, icon: Icon }) => <label key={key} className={styles.field}>
              <span className={styles.label}><Icon size={17} aria-hidden="true" />{label}</span>
              <span className={styles.inputWrap}><span className={styles.currency} aria-hidden="true">PHP</span>
                <input
                  disabled={submitting || (cashCorrection && key !== "cash")}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{0,5}"
                  maxLength={5}
                  value={payments[key]}
                  onKeyDown={event => {
                    if (!event.ctrlKey && !event.metaKey && event.key.length === 1 && !/^[0-9]$/.test(event.key)) event.preventDefault();
                  }}
                  onChange={event => {
                    const amount = event.target.value;
                    if (/^[0-9]{0,5}$/.test(amount)) setPayments(prev => ({ ...prev, [key]: amount }));
                  }}
                  placeholder="0"
                />
              </span>
            </label>)}
          </div>
          <p className={styles.hint}>{cashCorrection ? "Items, total, and other payment methods stay the same." : "You can split a payment across multiple methods."}</p>
        </section>
        <section className={styles.summary} aria-label="Settlement summary">
          <h3 className={styles.sectionTitle}>Settlement summary</h3>
          <dl className={styles.breakdown}>
            <div><dt>Amount paid</dt><dd>{formatPeso(totalPaid)}</dd></div>
            <div><dt>Remaining balance</dt><dd className={remaining > 0 ? styles.remaining : undefined}>{formatPeso(remaining)}</dd></div>
            <div className={styles.change}><dt>Change to return</dt><dd>{formatPeso(change)}</dd></div>
          </dl>
          <p className={`${styles.status} ${remaining > 0 ? styles.pending : styles.ready}`}>
            {remaining > 0 ? `Receive ${formatPeso(remaining)} more to complete payment.` : "Payment covered. Ready to confirm."}
          </p>
        </section>
      </div>
    </Modal>
  );
}
