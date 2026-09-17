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
    <section className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#232d46]">Recent Stock Runs</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review posted receipts or continue a draft stock run.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {activeDraftCount} draft{activeDraftCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
        <div className="max-h-[26rem] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
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
                              className="rounded-md border border-[#232d46] bg-[#232d46] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#303d5c]"
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

    </section>
  );
}
