import type { PosOrder } from "@/lib/pos";
import type { OfflineCheckoutEntry } from "@/lib/pos-offline";
import { formatDateTime, formatName, formatPeso } from "@/lib/pos-utils";

type Props = {
  history: PosOrder[];
  queuedCheckouts?: OfflineCheckoutEntry[];
  loading: boolean;
  onSelectOrder: (order: PosOrder) => void;
  onReverseOrder?: (order: PosOrder, type: "REFUND") => void;
};

function statusTone(status: PosOrder["status"]) {
  switch (status) {
    case "REFUNDED":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-emerald-100 text-emerald-700";
  }
}

export default function TransactionHistoryPanel({
  history,
  queuedCheckouts = [],
  loading,
  onSelectOrder,
  onReverseOrder,
}: Props) {
  return (
    <div>
      {queuedCheckouts.length > 0 ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">Pending Sync Queue</p>
          <div className="mt-3 space-y-3">
            {queuedCheckouts.map((entry) => (
              <div
                key={entry.operationId}
                className="rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{entry.operationId}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDateTime(entry.createdAt)} • {entry.preview.cartCount} item
                      {entry.preview.cartCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    {entry.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  Estimated total: {formatPeso(entry.preview.totalAmount)}
                </p>
                {entry.error ? (
                  <p className="mt-1 text-xs text-rose-600">{entry.error}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="max-h-[65dvh] overflow-auto rounded-xl border border-slate-200 bg-white">
        <div className="grid min-w-[960px] grid-cols-[1.2fr_1fr_1fr_0.8fr_1fr_180px] sticky top-0 z-10 gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Transaction</span>
          <span>Date & Time</span>
          <span>Staff</span>
          <span>Status</span>
          <span className="text-right">Total</span>
          <span className="text-right">Action</span>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading transactions...</div>
        ) : history.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No transactions yet.</div>
        ) : (
          history.map((txn) => (
            <div
              key={txn.id}
              className="grid min-w-[960px] grid-cols-[1.2fr_1fr_1fr_0.8fr_1fr_180px] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
            >
              <div>
                <p className="font-semibold">{txn.id}</p>
                <p className="text-xs text-slate-500">
                  {txn.items.length} item{txn.items.length === 1 ? "" : "s"} •{" "}
                  {txn.payments.map((payment) => payment.method).join(", ")}
                </p>
              </div>
              <p>{formatDateTime(txn.completedAt)}</p>
              <p>{formatName(txn.createdBy)}</p>
              <div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(txn.status)}`}>
                  {txn.status}
                </span>
              </div>
              <p className="text-right font-semibold">{formatPeso(txn.totalAmount)}</p>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onSelectOrder(txn)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  View
                </button>
                {txn.status === "COMPLETED" ? (
                  <>

                    <button
                      type="button"
                      onClick={() => onReverseOrder?.(txn, "REFUND")}
                      className="rounded-xl border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
                    >
                      Refund
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
