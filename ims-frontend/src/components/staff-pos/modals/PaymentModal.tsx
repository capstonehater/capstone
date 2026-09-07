import type { Dispatch, SetStateAction } from "react";
import { CreditCard, Wallet } from "lucide-react";
import { formatPeso } from "@/lib/pos-utils";
import Modal from "./Modal";

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
};

export default function PaymentModal({
  total,
  cartCount,
  payments,
  setPayments,
  onClose,
  onConfirm,
}: Props) {
  const totalPaid =
    Number(payments.cash || 0) +
    Number(payments.gcash || 0) +
    Number(payments.maya || 0) +
    Number(payments.card || 0);
  const remaining = Math.max(total - totalPaid, 0);
  const change = Math.max(totalPaid - total, 0);

  return (
    <Modal title="Payment Confirmation" onClose={onClose}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total Due
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{formatPeso(total)}</p>
            <p className="mt-1 text-sm text-slate-500">
              Split payments are supported. Final totals will still be confirmed by the backend.
            </p>
          </div>

          <label className="block">
            <span className="mb-1 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <CreditCard className="h-4 w-4" />
              Cash
            </span>
            <input
              type="number"
              min="0"
              value={payments.cash}
              onChange={(e) =>
                setPayments((prev) => ({ ...prev, cash: e.target.value }))
              }
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              placeholder="0.00"
            />
          </label>

          <label className="block">
            <span className="mb-1 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <Wallet className="h-4 w-4" />
              GCash
            </span>
            <input
              type="number"
              min="0"
              value={payments.gcash}
              onChange={(e) =>
                setPayments((prev) => ({ ...prev, gcash: e.target.value }))
              }
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              placeholder="0.00"
            />
          </label>

          <label className="block">
            <span className="mb-1 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <Wallet className="h-4 w-4" />
              Maya
            </span>
            <input
              type="number"
              min="0"
              value={payments.maya}
              onChange={(e) =>
                setPayments((prev) => ({ ...prev, maya: e.target.value }))
              }
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              placeholder="0.00"
            />
          </label>

          <label className="block">
            <span className="mb-1 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <CreditCard className="h-4 w-4" />
              Card
            </span>
            <input
              type="number"
              min="0"
              value={payments.card}
              onChange={(e) =>
                setPayments((prev) => ({ ...prev, card: e.target.value }))
              }
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              placeholder="0.00"
            />
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Settlement Summary
          </h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Amount Paid</span>
              <span>{formatPeso(totalPaid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Remaining</span>
              <span
                className={
                  remaining > 0 ? "font-semibold text-rose-600" : "text-[#f45a1f]"
                }
              >
                {formatPeso(remaining)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Change</span>
              <span>{formatPeso(change)}</span>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
            You can combine cash and e-wallet payments for a single checkout.
          </div>

          <button
            onClick={onConfirm}
            type="button"
            disabled={cartCount === 0 || totalPaid < total}
            className="mt-4 w-full rounded-2xl bg-[#f45a1f] px-4 py-3 text-sm font-semibold text-white hover:bg-[#d94f1a] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Confirm Payment
          </button>
        </div>
      </div>
    </Modal>
  );
}
