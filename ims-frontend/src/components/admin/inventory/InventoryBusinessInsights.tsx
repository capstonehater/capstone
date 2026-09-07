"use client";

import type {
  InventoryHealthReport,
  StockRunSpendReport,
  WasteSummaryReport,
} from "@/lib/reports";

type InventoryBusinessInsightsProps = {
  inventoryHealth: InventoryHealthReport | null;
  stockRunSpend: StockRunSpendReport | null;
  wasteSummary: WasteSummaryReport | null;
  loading: boolean;
  formatMoney: (value: string) => string;
  formatQuantity: (value: string) => string;
  formatDate: (value: string | null | undefined) => string;
};

function InsightCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/95 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function InsightPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-black/5 bg-white/95 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default function InventoryBusinessInsights({
  inventoryHealth,
  stockRunSpend,
  wasteSummary,
  loading,
  formatMoney,
  formatQuantity,
  formatDate,
}: InventoryBusinessInsightsProps) {
  if (loading) {
    return (
      <section className="rounded-[28px] border border-black/5 bg-white/95 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
        <p className="text-sm text-slate-500">Loading business monitoring data...</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InsightCard
          label="Low Stock"
          value={String(inventoryHealth?.summary.lowStockCount ?? 0)}
          description="Materials at or below reorder point."
        />
        <InsightCard
          label="Out of Stock"
          value={String(inventoryHealth?.summary.outOfStockCount ?? 0)}
          description="Materials that need replenishment now."
        />
        <InsightCard
          label="Near Expiry"
          value={String(inventoryHealth?.summary.nearExpiryBatchCount ?? 0)}
          description="Batches expiring within the next two weeks."
        />
        <InsightCard
          label="Stock-Run Spend"
          value={formatMoney(stockRunSpend?.totals.totalSpend ?? "0")}
          description="Posted purchasing spend for the selected period."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <InsightPanel
          title="High-Value Materials"
          description="Focus attention on the most expensive inventory positions."
        >
          <div className="space-y-3">
            {(inventoryHealth?.highValueMaterials ?? []).slice(0, 5).map((material) => (
              <div key={material.rawMaterialId} className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{material.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{material.sku}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">
                      {formatMoney(material.inventoryValue)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatQuantity(material.summary.usableQuantity)} usable
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </InsightPanel>

        <InsightPanel
          title="Waste Cost Watch"
          description="Highest-cost waste reasons for the selected period."
        >
          <div className="space-y-3">
            {(wasteSummary?.byReason ?? []).slice(0, 5).map((reason) => (
              <div key={reason.reasonCode} className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{reason.reasonCode}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {reason.eventCount} event{reason.eventCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">
                      {formatMoney(reason.cost)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatQuantity(reason.quantity)} wasted
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </InsightPanel>

        <InsightPanel
          title="Supplier Spend"
          description="Supplier concentration based on posted stock runs."
        >
          <div className="space-y-3">
            {(stockRunSpend?.bySupplier ?? []).slice(0, 5).map((supplier) => (
              <div
                key={supplier.supplierId ?? supplier.supplierName}
                className="rounded-2xl bg-slate-50 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{supplier.supplierName}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {supplier.lineCount} line{supplier.lineCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="font-semibold text-slate-900">
                    {formatMoney(supplier.totalSpend)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </InsightPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <InsightPanel
          title="Near Expiry Batches"
          description="Use FEFO and stock-run timing to prevent avoidable waste."
        >
          <div className="space-y-3">
            {(inventoryHealth?.nearExpiryBatches ?? []).slice(0, 5).map((batch) => (
              <div key={batch.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {batch.rawMaterial.name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Batch {batch.id.slice(0, 8)} • {batch.supplier?.name ?? "No supplier"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">
                      {formatDate(batch.expirationDate)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatQuantity(batch.remainingQuantity)} left
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </InsightPanel>

        <InsightPanel
          title="Low-Stock Materials"
          description="Operational watchlist for replenishment planning."
        >
          <div className="space-y-3">
            {(inventoryHealth?.lowStockMaterials ?? []).slice(0, 5).map((material) => (
              <div key={material.rawMaterialId} className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{material.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{material.sku}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">
                      {formatQuantity(material.summary.usableQuantity)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      reorder at {formatQuantity(material.reorderPoint)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </InsightPanel>
      </div>
    </div>
  );
}
