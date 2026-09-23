"use client";

import PosReportEmpty from "./PosReportEmpty";

import { useEffect, useMemo, useState } from "react";
import SummaryCard from "./PosReportMetric";
import WidgetCard from "@/components/dashboard/WidgetCard";
import {
  fetchPosDashboard,
  type PosDashboardReport,
} from "@/lib/reports";
import {
  getGrowthLabel,
  getSameWeekGrowthLabel,
  type QuickDatePreset,
} from "@/lib/report-date-range";
import { formatDateTime, formatPeso } from "@/lib/pos-utils";
import { formatGrowthRate, growthTone } from "./pos-report-shared";
import ReportLineChart from "./PosSalesChart";
import styles from "./PosReports.module.css";

type Props = {
  active: boolean;
  fromIso: string;
  toIso: string;
  preset: QuickDatePreset;
  refreshToken: number;
};

function describePresetValue(preset: QuickDatePreset) {
  switch (preset) {
    case "today":
      return {
        salesTitle: "Net Sales Today",
        transactionsTitle: "Transactions Today",
        averageOrderValueTitle: "Average Order Value Today",
      };
    case "yesterday":
      return {
        salesTitle: "Net Sales Yesterday",
        transactionsTitle: "Transactions Yesterday",
        averageOrderValueTitle: "Average Order Value Yesterday",
      };
    case "this-week":
      return {
        salesTitle: "Net Sales This Week",
        transactionsTitle: "Transactions This Week",
        averageOrderValueTitle: "Average Order Value This Week",
      };
    default:
      return {
        salesTitle: "Net Sales",
        transactionsTitle: "Transactions",
        averageOrderValueTitle: "Average Order Value",
      };
  }
}

export default function PosDashboardSection({
  active,
  fromIso,
  toIso,
  preset,
  refreshToken,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PosDashboardReport | null>(null);
  const labels = useMemo(() => describePresetValue(preset), [preset]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const nextDashboard = await fetchPosDashboard({
        from: fromIso,
        to: toIso,
        limit: 5,
      });
      setReport(nextDashboard);
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to load POS dashboard",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!active) {
      return;
    }

    void loadDashboard();
  }, [active, fromIso, toIso, refreshToken]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const handleFocus = () => {
      void loadDashboard();
    };
    const interval = window.setInterval(() => {
      void loadDashboard();
    }, 60000);

    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [active, fromIso, toIso]);

  if (!active) {
    return null;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title={labels.salesTitle}
          value={loading ? "..." : formatPeso(report?.summary.netSales ?? "0")}
        />
        <SummaryCard
          title={labels.transactionsTitle}
          value={loading ? "..." : report?.summary.transactionCount ?? 0}
        />
        <SummaryCard
          title={labels.averageOrderValueTitle}
          value={loading ? "..." : formatPeso(report?.summary.averageOrderValue ?? "0")}
        />
        <SummaryCard
          title={getGrowthLabel(preset)}
          value={
            loading
              ? "..."
              : formatGrowthRate(report?.comparisons.previousPeriod.growthRate ?? null)
          }
        />
        <SummaryCard
          title={getSameWeekGrowthLabel(preset)}
          value={
            loading
              ? "..."
              : formatGrowthRate(report?.comparisons.samePeriodLastWeek.growthRate ?? null)
          }
        />
      </section>

        <WidgetCard title="Daily Sales Snapshot">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Gross Sales
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {loading ? "..." : formatPeso(report?.summary.grossSales ?? "0")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Discounts
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {loading ? "..." : formatPeso(report?.summary.discounts ?? "0")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Top Product
              </p>
              <p className="mt-2 text-lg font-bold text-slate-900">
                {loading
                  ? "..."
                  : report?.topProduct?.productName ?? "No completed sales yet"}
              </p>
              {report?.topProduct ? (
                <p className="mt-2 text-sm text-slate-500">
                  {report.topProduct.quantitySold} sold | {formatPeso(report.topProduct.revenue)}
                </p>
              ) : null}
            </div>
          </div>

        </WidgetCard>
        <WidgetCard title="Hourly Net Sales">
          <p className="mb-4 text-xs text-slate-500">Sales from 1 PM through 10:59 PM, Manila time.</p>
            <ReportLineChart
              points={(report?.trend.points ?? []).map((point) => ({
                key: point.bucketKey,
                label: point.label,
                value: Number(point.netSales),
                detail: `${point.transactionCount} tx`,
              }))}
              valueFormatter={(value) => formatPeso(value.toFixed(2))}
              emptyLabel="No completed sales were recorded for the current dashboard range."
            />
        </WidgetCard>
        <div className={styles.dashboardBottom}>
        <WidgetCard title="Sales Growth">
          <div className={styles.growth}>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {getGrowthLabel(preset)}
              </p>
              <p
                className={`mt-2 text-2xl font-bold ${growthTone(
                  report?.comparisons.previousPeriod.growthRate ?? null,
                )}`}
              >
                {loading
                  ? "..."
                  : formatGrowthRate(report?.comparisons.previousPeriod.growthRate ?? null)}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Previous period net sales:{" "}
                {formatPeso(report?.comparisons.previousPeriod.netSales ?? "0")}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {getSameWeekGrowthLabel(preset)}
              </p>
              <p
                className={`mt-2 text-2xl font-bold ${growthTone(
                  report?.comparisons.samePeriodLastWeek.growthRate ?? null,
                )}`}
              >
                {loading
                  ? "..."
                  : formatGrowthRate(
                      report?.comparisons.samePeriodLastWeek.growthRate ?? null,
                    )}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Last-week net sales:{" "}
                {formatPeso(report?.comparisons.samePeriodLastWeek.netSales ?? "0")}
              </p>
            </div>
          </div>
        </WidgetCard>

      <WidgetCard title="Recent Orders">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="grid grid-cols-[1.1fr_1fr_1fr_0.9fr_0.8fr] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Order</span>
            <span>Date & Time</span>
            <span>Staff</span>
            <span>Payments</span>
            <span className="text-right">Total</span>
          </div>
          <div className="max-h-[24rem] overflow-y-auto">
            {(report?.recentOrders ?? []).length === 0 ? (
              <PosReportEmpty message="No recent orders for the selected range." />
            ) : (
              report?.recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="grid grid-cols-[1.1fr_1fr_1fr_0.9fr_0.8fr] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      {order.displayOrderNumber}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">{order.id}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {order.itemCount} item{order.itemCount === 1 ? "" : "s"} |{" "}
                      {order.quantitySold} qty
                    </div>
                  </div>
                  <div>{formatDateTime(order.completedAt)}</div>
                  <div>
                    {order.createdBy.firstName} {order.createdBy.lastName}
                  </div>
                  <div>{order.paymentMethods.join(" + ")}</div>
                  <div className="text-right font-semibold text-slate-900">
                    {formatPeso(order.totalAmount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </WidgetCard>
      </div>
    </div>
  );
}
