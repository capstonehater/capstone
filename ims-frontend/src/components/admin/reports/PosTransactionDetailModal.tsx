"use client";

import type { PosOrder } from "@/lib/pos";
import { formatDateTime, formatPeso } from "@/lib/pos-utils";

type Props = {
  order: PosOrder | null;
  loading: boolean;
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

export default function PosTransactionDetailModal({
  order,
  loading,
  onClose,
}: Props) {
  if (!loading && !order) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-8">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Transaction Detail</h2>
            <p className="mt-1 text-sm text-slate-500">
              Review the full receipt-level data returned by the existing order detail endpoint.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading || !order ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              Loading transaction detail...
            </div>
          ) : (
            <div className="space-y-6">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Order
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {order.displayOrderNumber}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{order.id}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Completed
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {formatDateTime(order.completedAt)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Staff
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {order.createdBy.firstName} {order.createdBy.lastName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{order.createdBy.email}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </p>
                  <div className="mt-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(order.status)}`}
                    >
                      {order.status}
                    </span>
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-[1.6fr_0.7fr_0.8fr_0.8fr_0.8fr] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>Item</span>
                  <span>Qty</span>
                  <span>Unit Price</span>
                  <span>Modifiers</span>
                  <span>Subtotal</span>
                </div>
                <div className="max-h-[24rem] overflow-y-auto">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[1.6fr_0.7fr_0.8fr_0.8fr_0.8fr] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">
                          {item.productNameSnapshot} • {item.variantNameSnapshot}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{item.skuSnapshot}</div>
                        {item.note ? (
                          <div className="mt-2 text-xs text-amber-700">Note: {item.note}</div>
                        ) : null}
                      </div>
                      <div>{item.quantity}</div>
                      <div>{formatPeso(item.unitFinalPrice)}</div>
                      <div className="text-xs text-slate-600">
                        {item.modifiers.length === 0
                          ? "No modifiers"
                          : item.modifiers
                              .map(
                                (modifier) =>
                                  `${modifier.modifierNameSnapshot} x${modifier.quantity}`,
                              )
                              .join(", ")}
                      </div>
                      <div className="font-semibold text-slate-900">
                        {formatPeso(item.lineSubtotal)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Payment & Audit
                  </h3>
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Payments
                      </p>
                      <p className="mt-1">
                        {order.payments
                          .map((payment) => `${payment.method} ${formatPeso(payment.amount)}`)
                          .join(" + ")}
                      </p>
                    </div>
                    {order.notes ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Notes
                        </p>
                        <p className="mt-1">{order.notes}</p>
                      </div>
                    ) : null}
                    {order.reversal ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="font-semibold text-slate-900">
                          Refunded by{" "}
                          {order.reversal.actorUser.firstName} {order.reversal.actorUser.lastName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDateTime(order.reversal.occurredAt)} • {order.reversal.reasonCode}
                        </p>
                        {order.reversal.note ? (
                          <p className="mt-2 text-sm text-slate-700">{order.reversal.note}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Totals
                  </h3>
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{formatPeso(order.subtotalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Discount</span>
                      <span>- {formatPeso(order.discountAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span>{formatPeso(order.taxAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>COGS</span>
                      <span>{formatPeso(order.totalCogsAmount)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
                      <span>Total</span>
                      <span>{formatPeso(order.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
