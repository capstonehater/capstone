import { AlertTriangle } from "lucide-react";
import type { PosOrder } from "@/lib/pos";
import { formatDateTime, formatName, formatPeso } from "@/lib/pos-utils";
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

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-semibold">
                This is a backend-authoritative full-order reversal that requires admin approval.
              </p>
              <p className="mt-1">
                Inventory is restored with compensating ledger entries and the order stays auditable.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Order {order.id}</p>
          <p className="mt-1">Completed {formatDateTime(order.completedAt)}</p>
          <p className="mt-1">Processed by {formatName(order.createdBy)}</p>
          <p className="mt-2 font-semibold text-slate-900">{formatPeso(order.totalAmount)}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            <span className="mb-1 block">Admin Email</span>
            <input
              type="email"
              value={approverEmail}
              onChange={(event) => onApproverEmailChange(event.target.value)}
              placeholder="admin@stockscout.com"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            <span className="mb-1 block">Admin Password</span>
            <input
              type="password"
              value={approverPassword}
              onChange={(event) => onApproverPasswordChange(event.target.value)}
              placeholder="Enter approving admin password"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            <span className="mb-1 block">Reason Code</span>
            <input
              value={reasonCode}
              onChange={(event) => onReasonCodeChange(event.target.value)}
              placeholder="CUSTOMER_REFUND"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            <span className="mb-1 block">Payment Reference</span>
            <input
              value={paymentReference}
              onChange={(event) => onPaymentReferenceChange(event.target.value)}
              placeholder="Optional reference"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
            />
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-1 block">Note</span>
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={3}
            placeholder="Optional staff note for the audit trail"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium"
          >
            Keep Order
          </button>
          <button
            type="button"
            disabled={
              submitting ||
              !approverEmail.trim() ||
              !approverPassword.trim() ||
              !reasonCode.trim()
            }
            onClick={onConfirm}
            className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
          >
            {submitting ? "Submitting..." : "Refund Order"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
