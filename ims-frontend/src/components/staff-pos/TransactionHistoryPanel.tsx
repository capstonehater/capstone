"use client";
import { PermissionAction } from "@/components/auth/PermissionGuard";
import styles from "./TransactionHistory.module.css";
import type { PosOrder } from "@/lib/pos";
import type { OfflineCheckoutEntry } from "@/lib/pos-offline";
import { formatDateTime, formatName, formatOrderReference, formatPeso } from "@/lib/pos-utils";

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
      return "bg-[#dce2eb] text-[#34445f]";
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
        <div className="mb-5 rounded-2xl border border-[#cbd5e1] bg-[#edf2f8] p-4">
          <p className="text-sm font-semibold text-[#232d46]">Pending Sync Queue</p>
          <div className="mt-3 space-y-3">
            {queuedCheckouts.map((entry) => (
              <div
                key={entry.operationId}
                className="rounded-2xl border border-[#cbd5e1] bg-white px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{entry.operationId}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDateTime(entry.createdAt)} • {entry.preview.cartCount} item
                      {entry.preview.cartCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#dce2eb] px-3 py-1 text-xs font-semibold text-[#34445f]">
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

      <div className={styles.tableScroll}>
        <table className={styles.table} aria-label="Transaction history"><thead><tr>
          <th scope="col">Transaction</th>
          <th scope="col">Date & Time</th>
          <th scope="col">Staff</th>
          <th scope="col">Status</th>
          <th scope="col" className={styles.amount}>Total</th>
          <th scope="col" className={styles.actionHeading}>Actions</th>
        </tr></thead><tbody>

        {loading ? (
          <tr><td colSpan={6} className={styles.empty} role="status">Loading transactions...</td></tr>
        ) : history.length === 0 ? (
          <tr><td colSpan={6} className={styles.empty}>No transactions found.</td></tr>
        ) : (
          history.map((txn) => (
            <tr key={txn.id}>
              <td className={styles.transaction}>
                <p className="font-semibold">{formatOrderReference(txn)}</p>
                <p className="text-xs text-slate-500">
                  {txn.items.length} item{txn.items.length === 1 ? "" : "s"} •{" "}
                  {txn.payments.map((payment) => payment.method).join(", ")}
                </p>
              </td>
              <td>{formatDateTime(txn.completedAt)}</td>
              <td>{formatName(txn.createdBy)}</td>
              <td>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(txn.status)}`}>
                  {txn.status}
                </span>
              </td>
              <td className={styles.amount}>{formatPeso(txn.totalAmount)}</td>
              <td><div className={styles.actions}>
                <button
                  type="button"
                  onClick={() => onSelectOrder(txn)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  View
                </button>
                {txn.status === "COMPLETED" ? (
                  <>

                    <PermissionAction permission="pos.refund"><button
                      type="button"
                      onClick={() => onReverseOrder?.(txn, "REFUND")}
                      className="rounded-xl border border-[#cbd5e1] px-3 py-1.5 text-xs font-semibold text-[#34445f] transition hover:bg-[#edf2f8]"
                    >
                      Refund
                    </button></PermissionAction>
                  </>
                ) : null}
              </div></td>
            </tr>
          ))
        )}
        </tbody></table>
      </div>
    </div>
  );
}
