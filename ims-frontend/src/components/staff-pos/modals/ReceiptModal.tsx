import { Receipt } from "lucide-react";
import type { PosOrder } from "@/lib/pos";
import { formatDateTime, formatName, formatPeso } from "@/lib/pos-utils";
import Modal from "./Modal";

type Props = {
  receipt: PosOrder;
  onRefund?: (order: PosOrder) => void;
  reversalSubmitting?: boolean;
  onClose: () => void;
};

function statusTone(status: PosOrder["status"]) {
  switch (status) {
    case "REFUNDED":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-emerald-100 text-emerald-700";
  }
}

export default function ReceiptModal({
  receipt,
  onRefund,
  reversalSubmitting = false,
  onClose,
}: Props) {
  return (
    <Modal title="Receipt" onClose={onClose}>
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Receipt className="h-5 w-5 text-[#f45a1f]" />
          <div>
            <h3 className="font-semibold">Receipt #{receipt.id}</h3>
            <p className="text-sm text-slate-500">{formatDateTime(receipt.completedAt)}</p>
          </div>
          <span className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${statusTone(receipt.status)}`}>
            {receipt.status}
          </span>
        </div>

        <div className="space-y-3 text-sm">
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
                <div className="mt-1 text-xs text-amber-700">Note: {item.note}</div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2 border-t border-dashed border-slate-300 pt-4 text-sm">
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
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{formatPeso(receipt.totalAmount)}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-1 text-sm text-slate-600">
          <p>
            <span className="font-medium">Payment:</span>{" "}
            {receipt.payments
              .map((payment) => `${payment.method} ${formatPeso(payment.amount)}`)
              .join(" + ")}
          </p>
          <p>
            <span className="font-medium">Staff Name:</span> {formatName(receipt.createdBy)}
          </p>
          <p>
            <span className="font-medium">Date & Time:</span>{" "}
            {formatDateTime(receipt.completedAt)}
          </p>
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

        <div className="mt-5 flex justify-end gap-2">
          {receipt.status === "COMPLETED" ? (
            <>

              <button
                type="button"
                disabled={reversalSubmitting}
                onClick={() => onRefund?.(receipt)}
                className="rounded-2xl border border-amber-200 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60"
              >
                Refund Order
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium"
          >
            Print Receipt
          </button>
          <button
            onClick={onClose}
            type="button"
            className="rounded-2xl bg-[#f45a1f] px-4 py-2 text-sm font-medium text-white hover:bg-[#d94f1a]"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
