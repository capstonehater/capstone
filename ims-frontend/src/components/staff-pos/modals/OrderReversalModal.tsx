import { AlertTriangle } from "lucide-react";
import { useRef, useState } from "react";
import styles from "./OrderReversalModal.module.css";
import type { PosOrder } from "@/lib/pos";
import { formatDateTime, formatName, formatOrderReference, formatPeso } from "@/lib/pos-utils";
import Modal from "./Modal";

type Props = {
  order: PosOrder;
  type: "REFUND";
  approverEmail: string;
  approverPassword: string;
  reasonCode: string;
  note: string;
  paymentReference: string;
  submitting: boolean;
  onApproverEmailChange: (value: string) => void;
  onApproverPasswordChange: (value: string) => void;
  onReasonCodeChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onPaymentReferenceChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export default function OrderReversalModal({
  order,
  approverEmail,
  approverPassword,
  reasonCode,
  note,
  paymentReference,
  submitting,
  onApproverEmailChange,
  onApproverPasswordChange,
  onReasonCodeChange,
  onNoteChange,
  onPaymentReferenceChange,
  onClose,
  onConfirm,
}: Props) {
  const title = "Refund Completed Order";
  const [validationAttempted, setValidationAttempted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = {
    email: !approverEmail.trim() ? "Admin email is required." : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(approverEmail.trim()) ? "Enter a valid admin email." : undefined,
    password: !approverPassword.trim() ? "Admin password is required." : undefined,
    reason: !reasonCode.trim() ? "Reason code is required." : undefined,
  };

  return (
    <Modal title={title} onClose={onClose} showCloseButton={false} panelClassName={styles.panel} bodyClassName={styles.body} footer={
      <div className={styles.footer}>
        <button type="button" onClick={onClose} disabled={submitting} className={styles.keep}>Keep Order</button>
        <button type="submit" form="order-refund-form" disabled={submitting} className={styles.refund}>{submitting ? "Submitting…" : "Refund Order"}</button>
      </div>
    }>
      <form id="order-refund-form" ref={formRef} noValidate className={styles.form} onSubmit={(event) => {
        event.preventDefault();
        if (submitting) return;
        setValidationAttempted(true);
        if (Object.values(errors).some(Boolean)) {
          const fieldId = errors.email ? "refund-admin-email" : errors.password ? "refund-admin-password" : "refund-reason";
          formRef.current?.querySelector<HTMLInputElement>(`#${fieldId}`)?.focus();
          return;
        }
        onConfirm();
      }}>
        <div className={styles.notice}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-semibold">
                Admin approval is required to refund this order.
              </p>
              <p className="mt-1">
                The full order amount will be refunded and inventory restored. The order and refund remain in the audit history.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.summary}>
          <p className="font-semibold text-slate-900">Order {formatOrderReference(order)}</p>
          <p className="mt-1">Completed {formatDateTime(order.completedAt)}</p>
          <p className="mt-1">Processed by {formatName(order.createdBy)}</p>
          <div className={styles.total}><span>Refund amount</span><strong>{formatPeso(order.totalAmount)}</strong></div>
        </div>
        <div className={styles.sectionHeading}><strong>Approval details</strong><span><span className={styles.required} aria-hidden="true">*</span> Required fields</span></div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            <span className="mb-1 block">Admin Email <span className={styles.required} aria-hidden="true">*</span></span>
            <input
              id="refund-admin-email"
              required
              aria-invalid={validationAttempted && !!errors.email}
              aria-describedby={validationAttempted && errors.email ? "refund-email-error" : undefined}
              type="email"
              value={approverEmail}
              onChange={(event) => onApproverEmailChange(event.target.value)}
              placeholder="admin@stockscout.com"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#232d46]"
            />
            {validationAttempted && errors.email && <p id="refund-email-error" role="alert" className={styles.error}>{errors.email}</p>}
          </label>

          <label className="text-sm font-medium text-slate-700">
            <span className="mb-1 block">Admin Password <span className={styles.required} aria-hidden="true">*</span></span>
            <input
              id="refund-admin-password"
              required
              aria-invalid={validationAttempted && !!errors.password}
              aria-describedby={validationAttempted && errors.password ? "refund-password-error" : undefined}
              type="password"
              value={approverPassword}
              onChange={(event) => onApproverPasswordChange(event.target.value)}
              placeholder="Enter approving admin password"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#232d46]"
            />
            {validationAttempted && errors.password && <p id="refund-password-error" role="alert" className={styles.error}>{errors.password}</p>}
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            <span className="mb-1 block">Reason Code <span className={styles.required} aria-hidden="true">*</span></span>
            <input
              id="refund-reason"
              required
              aria-invalid={validationAttempted && !!errors.reason}
              aria-describedby={validationAttempted && errors.reason ? "refund-reason-error" : undefined}
              value={reasonCode}
              onChange={(event) => onReasonCodeChange(event.target.value)}
              placeholder="CUSTOMER_REFUND"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#232d46]"
            />
            {validationAttempted && errors.reason && <p id="refund-reason-error" role="alert" className={styles.error}>{errors.reason}</p>}
          </label>

          <label className="text-sm font-medium text-slate-700">
            <span className="mb-1 block">Payment Reference (optional)</span>
            <input
              value={paymentReference}
              onChange={(event) => onPaymentReferenceChange(event.target.value)}
              placeholder="Optional reference"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#232d46]"
            />
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-1 block">Note (optional)</span>
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={3}
            placeholder="Optional staff note for the audit trail"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#232d46]"
          />
        </label>

      </form>
    </Modal>
  );
}
