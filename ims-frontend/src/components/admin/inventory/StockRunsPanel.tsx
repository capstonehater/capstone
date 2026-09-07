"use client";

import type { StockRun } from "@/lib/inventory";

type StockRunsPanelProps = {
  stockRuns: StockRun[];
  activeDraftCount: number;
  onOpenDraft: (stockRunId: string) => void;
  onDeleteDraft: (stockRun: StockRun) => void;
  formatMoney: (value: string) => string;
  formatDateTime: (value: string | null | undefined) => string;
};

export default function StockRunsPanel({
  stockRuns,
  activeDraftCount,
  onOpenDraft,
  onDeleteDraft,
  formatMoney,
  formatDateTime,
}: StockRunsPanelProps) {
  return (
    <section className="flex min-h-[24rem] flex-col rounded-[28px] border border-black/5 bg-white/95 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)] xl:h-[28rem] xl:overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Recent Stock Runs</h2>
          <p className="mt-1 text-sm text-slate-500">
            Drafts reopen in a modal workspace. Posted runs stay visible as receipts.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {activeDraftCount} draft{activeDraftCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-5 flex min-h-[12rem] flex-1 overflow-hidden rounded-2xl border border-slate-200 xl:min-h-0">
        <div className="min-h-[12rem] flex-1 overflow-y-auto overflow-x-hidden xl:min-h-0">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Run</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total Cost</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stockRuns.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    No stock runs yet.
                  </td>
                </tr>
              ) : (
                stockRuns.map((stockRun) => (
                  <tr key={stockRun.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{stockRun.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {stockRun.notes || "No notes"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          stockRun.status === "POSTED"
                            ? "bg-emerald-100 text-emerald-700"
                            : stockRun.status === "DRAFT"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {stockRun.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{stockRun.items.length}</td>
                    <td className="px-4 py-3">{formatMoney(stockRun.totalCost)}</td>
                    <td className="px-4 py-3">{formatDateTime(stockRun.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {stockRun.status === "DRAFT" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onOpenDraft(stockRun.id)}
                              className="rounded-full border border-orange-200 px-3 py-1.5 text-xs font-semibold text-[#f45a1f] transition hover:border-orange-300 hover:bg-orange-50"
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteDraft(stockRun)}
                              className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">Posted</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-dashed border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
        Supplier recommendation remains mock-only and is intentionally excluded from this UX pass.
      </div>
    </section>
  );
}
