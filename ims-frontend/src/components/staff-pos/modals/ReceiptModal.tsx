"use client";
import { PermissionAction } from "@/components/auth/PermissionGuard";
import { ArrowLeft, Receipt } from "lucide-react";
import { useState } from "react";
import { getReceiptPaymentSummary, openReceipt } from "@/lib/receipt";
import type { PosOrder } from "@/lib/pos";
import { formatDateTime, formatName, formatOrderReference, formatPeso } from "@/lib/pos-utils";
import Modal from "./Modal";
import styles from "./ReceiptModal.module.css";

type Props = {
  receipt: PosOrder;
  onRefund?: (order: PosOrder) => void;
  reversalSubmitting?: boolean;
  onClose: () => void;
  onBackToPayment?: () => void;
};

function statusTone(status: PosOrder["status"]) {
  switch (status) {
    case "REFUNDED":
      return "bg-[#dce2eb] text-[#34445f]";
    default:
      return "bg-emerald-100 text-emerald-700";
  }
}

export default function ReceiptModal({
  receipt,
  onRefund,
  reversalSubmitting = false,
  onClose,
  onBackToPayment,
}: Props) {
  const [printError, setPrintError] = useState("");
  const { change } = getReceiptPaymentSummary(receipt);
  function handlePrint() {
    setPrintError("");
    try { openReceipt(receipt); }
    catch (error) { setPrintError(error instanceof Error ? error.message : "Unable to open receipt."); }
  }
  return (
    <Modal title="Receipt" onClose={onClose} panelClassName={styles.modal} footer={
        <div className={styles.actions}>
          {onBackToPayment && receipt.status === "COMPLETED" && <PermissionAction permission="pos.checkout"><button type="button" onClick={onBackToPayment} className="mr-auto inline-flex items-center gap-2 rounded-2xl border border-slate-200 text-[#34445f] hover:bg-slate-50"><ArrowLeft size={17} aria-hidden="true" />Back to Payment</button></PermissionAction>}
          {receipt.status === "COMPLETED" ? (
            <>

              <PermissionAction permission={"pos.refund"}><button
                type="button"
                disabled={reversalSubmitting || !onRefund}
                onClick={() => onRefund?.(receipt)}
                className="rounded-2xl border border-[#cbd5e1] px-4 py-2 text-sm font-medium text-[#34445f] hover:bg-[#edf2f8] disabled:opacity-60"
              >
                Refund Order
              </button></PermissionAction>
            </>
          ) : null}
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium"
          >
            Print Receipt
          </button>
          <button
            onClick={onClose}
            type="button"
            className="rounded-2xl bg-[#232d46] px-4 py-2 text-sm font-medium text-white hover:bg-[#34445f]"
          >
            Done
          </button>
        </div>
      }>
      {printError && <p role="alert" className="mt-2 text-sm text-red-700">{printError}</p>}
      <div className={styles.receipt}>
        <div className={styles.heading}>
          <Receipt className="h-5 w-5 text-[#232d46]" />
          <div>
            <h3 className="font-semibold">{formatOrderReference(receipt)}</h3>
            <p className={styles.reference}>Order ID: {receipt.id}</p>
            <p className="text-sm text-slate-500">{formatDateTime(receipt.completedAt)}</p>
          </div>
          <span className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${statusTone(receipt.status)}`}>
            {receipt.status}
          </span>
        </div>

        <div className={styles.items}>
          {receipt.items.map((item) => (
            <div key={item.id} className="rounded-xl bg-white px-3 py-2">
              <div className="flex justify-between gap-3">
                <span>
                  {item.quantity}x {item.productNameSnapshot} ({item.variantNameSnapshot})
                </span>
                <span>{formatPeso(item.lineSubtotal)}</span>
              </div>
              {item.modifiers.length > 0 ? (
                <div className="mt-1 text-xs text-slate-500">
                  {item.modifiers
                    .map(
                      (modifier) =>
                        `${modifier.modifierNameSnapshot} x${modifier.quantity}`
                    )
                    .join(", ")}
                </div>
              ) : null}
              {item.note ? (
                <div className="mt-1 text-xs text-[#34445f]">Note: {item.note}</div>
              ) : null}
            </div>
          ))}
        </div>

        <div className={styles.totals}>
          <div className="flex justify-between">
            <span>Subtotal (VAT Inclusive)</span>
            <span>{formatPeso(receipt.subtotalAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span>Discount</span>
            <span>- {formatPeso(receipt.discountAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT Included (12%)</span>
            <span>{formatPeso(receipt.taxAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span>COGS</span>
            <span>{formatPeso(receipt.totalCogsAmount)}</span>
          </div>
          <div className={styles.total}>
            <span>Total</span>
            <span>{formatPeso(receipt.totalAmount)}</span>
          </div>
        </div>

        <div className={styles.details}>
          <p>
            <span className="font-medium">Payment:</span>{" "}
            {receipt.payments
              .map((payment) => `${payment.method} ${formatPeso(payment.amount)}`)
              .join(" + ")}
          </p>
          <p>
            <span className="font-medium">Change:</span> {formatPeso(change)}
          </p>
          <p>
            <span className="font-medium">Staff Name:</span> {formatName(receipt.createdBy)}
          </p>
          <p>
            <span className="font-medium">Date & Time:</span>{" "}
            {formatDateTime(receipt.completedAt)}
          </p>
          {receipt.discountCode && <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-3">
            <p className="font-medium">Discount: {receipt.discountCode}</p>
            <p className="break-words">Name: {receipt.discountCustomerName || "Not recorded"}</p>
            <p className="break-words">{/senior/i.test(receipt.discountCode) ? "Senior Citizen ID No." : "ID No."}: {receipt.discountIdNumber || "Not recorded"}</p>
          </div>}
          {receipt.notes ? (
            <p>
              <span className="font-medium">Notes:</span> {receipt.notes}
            </p>
          ) : null}
          {receipt.reversal ? (
            <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-3">
              <p className="font-medium text-slate-900">
                Refunded by{" "}
                {formatName(receipt.reversal.actorUser)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {formatDateTime(receipt.reversal.occurredAt)} • {receipt.reversal.reasonCode}
              </p>
              {receipt.reversal.note ? (
                <p className="mt-2 text-xs text-slate-600">{receipt.reversal.note}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
