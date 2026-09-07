"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  Clock3,
  PackageX,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import SummaryCard from "@/components/dashboard/SummaryCard";
import WidgetCard from "@/components/dashboard/WidgetCard";
import { fetchAlerts, type AlertRecord } from "@/lib/alerts";
import {
  fetchInventoryHealth,
  fetchSalesOverview,
  fetchStockRunSpend,
  fetchWasteSummary,
  type InventoryHealthReport,
  type SalesOverviewReport,
  type StockRunSpendReport,
  type WasteSummaryReport,
} from "@/lib/reports";
import { formatDateTime, formatPeso } from "@/lib/pos-utils";

function formatDate(value: string | null | undefined) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function defaultReportRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 30);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salesOverview, setSalesOverview] = useState<SalesOverviewReport | null>(null);
  const [inventoryHealth, setInventoryHealth] = useState<InventoryHealthReport | null>(null);
  const [stockRunSpend, setStockRunSpend] = useState<StockRunSpendReport | null>(null);
  const [wasteSummary, setWasteSummary] = useState<WasteSummaryReport | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<AlertRecord[]>([]);

  useEffect(() => {
    const range = defaultReportRange();

    void (async () => {
      setLoading(true);
      try {
        const [nextSalesOverview, nextInventoryHealth, nextStockRunSpend, nextWasteSummary] =
          await Promise.all([
            fetchSalesOverview({ ...range, limit: 5 }),
            fetchInventoryHealth({ limit: 5 }),
            fetchStockRunSpend({ ...range, limit: 5 }),
            fetchWasteSummary({ ...range, limit: 5 }),
          ]);
        const nextAlerts = await fetchAlerts({ state: "ACTIVE", limit: 5 });

        setSalesOverview(nextSalesOverview);
        setInventoryHealth(nextInventoryHealth);
        setStockRunSpend(nextStockRunSpend);
        setWasteSummary(nextWasteSummary);
        setActiveAlerts(nextAlerts);
        setError(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const summaryCards = useMemo(
    () => [
      {
        title: "Total Sales",
        value: formatPeso(salesOverview?.summary.totalSales ?? "0"),
        icon: <CircleDollarSign size={20} />,
      },
      {
        title: "Gross Margin",
        value: formatPeso(salesOverview?.summary.grossMargin ?? "0"),
        icon: <TrendingUp size={20} />,
      },
      {
        title: "Low Stock Items",
        value: inventoryHealth?.summary.lowStockCount ?? 0,
        icon: <AlertTriangle size={20} />,
      },
      {
        title: "Inventory Value",
        value: formatPeso(inventoryHealth?.summary.totalInventoryValue ?? "0"),
        icon: <Boxes size={20} />,
      },
    ],
    [inventoryHealth, salesOverview]
  );

  return (
    <AdminDashboardLayout>
      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <SummaryCard
            key={card.title}
            title={card.title}
            value={loading ? "..." : card.value}
            icon={card.icon}
          />
        ))}
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-3">
        <WidgetCard title="Top-Selling Variants" className="xl:col-span-2">
          <div className="space-y-3">
            {(salesOverview?.topVariants ?? []).map((variant) => (
              <div
                key={variant.productVariantId}
                className="rounded-xl border border-neutral-200 bg-[#f7f7f7] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-neutral-900">
                      {variant.productName} • {variant.variantName}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500">{variant.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-neutral-900">
                      {formatPeso(variant.revenue)}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {variant.quantitySold} sold •{" "}
                      {(variant.marginRate * 100).toFixed(1)}% margin
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </WidgetCard>

        <WidgetCard title="Stock-Run Spend">
          <div className="space-y-3">
            <div className="rounded-xl bg-[#f7f7f7] p-3">
              <p className="text-sm font-medium text-neutral-800">Posted Spend</p>
              <p className="mt-2 text-2xl font-bold text-[#f45a1f]">
                {formatPeso(stockRunSpend?.totals.totalSpend ?? "0")}
              </p>
            </div>

            <div className="rounded-xl bg-[#f7f7f7] p-3">
              <p className="text-sm font-medium text-neutral-800">Average Run Cost</p>
              <p className="mt-2 text-2xl font-bold text-[#f45a1f]">
                {formatPeso(stockRunSpend?.totals.averageRunCost ?? "0")}
              </p>
            </div>

            <div className="rounded-xl bg-[#f7f7f7] p-3">
              <p className="text-sm font-medium text-neutral-800">Posted Runs</p>
              <p className="mt-2 text-2xl font-bold text-[#f45a1f]">
                {stockRunSpend?.totals.runCount ?? 0}
              </p>
            </div>
          </div>
        </WidgetCard>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-3"> 

        <WidgetCard title="Near Expiry Watchlist">
          <div className="space-y-3">
            {(inventoryHealth?.nearExpiryBatches ?? []).map((batch) => (
              <div
                key={batch.id}
                className="rounded-xl border border-neutral-200 bg-[#fffaf7] p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold text-neutral-900">{batch.rawMaterial.name}</p>
                  <Clock3 size={18} className="text-[#f45a1f]" />
                </div>
                <p className="text-sm text-neutral-600">
                  Expiry: {formatDate(batch.expirationDate)}
                </p>
                <p className="text-sm text-neutral-600">
                  Remaining: {batch.remainingQuantity}
                </p>
              </div>
            ))}
          </div>
        </WidgetCard>

        <WidgetCard title="Waste Reasons">
          <div className="space-y-3">
            {(wasteSummary?.byReason ?? []).map((reason) => (
              <div
                key={reason.reasonCode}
                className="rounded-xl border border-neutral-200 bg-[#f7f7f7] p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold text-neutral-900">{reason.reasonCode}</p>
                  <PackageX size={18} className="text-[#f45a1f]" />
                </div>
                <p className="text-sm text-neutral-600">
                  Waste Cost: {formatPeso(reason.cost)}
                </p>
                <p className="text-sm text-neutral-600">
                  Events: {reason.eventCount}
                </p>
              </div>
            ))}
          </div>
        </WidgetCard>

        <WidgetCard title="Recent Orders">
          <div className="space-y-3">
            {(salesOverview?.recentOrders ?? []).map((order) => (
              <div
                key={order.id}
                className="rounded-xl border border-neutral-200 bg-[#f7f7f7] p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold text-neutral-900">{order.id}</p>
                  <ShoppingCart size={18} className="text-[#f45a1f]" />
                </div>
                <p className="text-sm text-neutral-600">
                  {formatDateTime(order.completedAt)}
                </p>
                <p className="text-sm text-neutral-600">
                  {order.createdBy.firstName} {order.createdBy.lastName}
                </p>
                <p className="mt-2 text-sm font-semibold text-neutral-900">
                  {formatPeso(order.totalAmount)}
                </p>
              </div>
            ))}
          </div>
        </WidgetCard>
      </section>
    </AdminDashboardLayout>
  );
}
