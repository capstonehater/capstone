"use client";

import PosReportEmpty from "./PosReportEmpty";

import { useEffect, useMemo, useState } from "react";
import SummaryCard from "./PosReportMetric";
import WidgetCard from "@/components/dashboard/WidgetCard";
import {
  exportPosProductPerformanceCsv,
  exportPosProductPerformancePdf,
} from "@/lib/report-exports";
import {
  fetchPosProductPerformance,
  fetchReportCategories,
  type PosProductPerformanceReport,
  type ReportCategory,
} from "@/lib/reports";
import { formatPeso } from "@/lib/pos-utils";

type Props = {
  active: boolean;
  from: string;
  to: string;
  fromIso: string;
  toIso: string;
  refreshToken: number;
};

function formatRate(value: number | null) {
  if (value === null) {
    return "N/A";
  }

  return `${(value * 100).toFixed(1)}%`;
}

export default function PosProductPerformanceSection({
  active,
  from,
  to,
  fromIso,
  toIso,
  refreshToken,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PosProductPerformanceReport | null>(null);
  const [categories, setCategories] = useState<ReportCategory[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [exportingFormat, setExportingFormat] = useState<"csv" | "pdf" | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;

    const loadCategories = async () => {
      try {
        const nextCategories = await fetchReportCategories();
        if (!cancelled) {
          setCategories(nextCategories);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Failed to load report categories",
          );
        }
      }
    };

    void loadCategories();

    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;

    const loadReport = async () => {
      setLoading(true);
      try {
        const nextReport = await fetchPosProductPerformance({
          from: fromIso,
          to: toIso,
          categoryId: categoryId || undefined,
        });

        if (!cancelled) {
          setReport(nextReport);
          setError(null);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Failed to load product performance",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadReport();

    return () => {
      cancelled = true;
    };
  }, [active, fromIso, toIso, categoryId, refreshToken]);

  const activeCategory = useMemo(
    () => categories.find((category) => category.id === categoryId) ?? null,
    [categories, categoryId],
  );

  if (!active) {
    return null;
  }

  const handleExport = async (format: "csv" | "pdf") => {
    if (!report) {
      return;
    }

    setExportingFormat(format);
    setExportNotice(null);
    setExportError(null);

    try {
      const snapshot = {
        filters: {
          from,
          to,
          categoryId: categoryId || undefined,
          categoryName: activeCategory?.name,
        },
        report,
      };

      if (format === "csv") {
        const filename = exportPosProductPerformanceCsv(snapshot);
        setExportNotice(`CSV export downloaded as ${filename}.`);
      } else {
        const filename = exportPosProductPerformancePdf(snapshot);
        setExportNotice(
          `Printable product performance report opened as ${filename}. Use your browser's Save as PDF option to finish the export.`,
        );
      }
    } catch (nextError) {
      setExportError(
        nextError instanceof Error ? nextError.message : "Failed to export product performance",
      );
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className="space-y-6" data-pos-products>
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {exportError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {exportError}
        </div>
      ) : null}

      {exportNotice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {exportNotice}
        </div>
      ) : null}

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-neutral-900">Product Performance</h3>
            <p className="mt-2 text-sm text-neutral-600">
              Best sellers, gross margin leaders, slow movers, and top categories using current
              catalog relationships for category attribution.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-[minmax(0,1.1fr)_repeat(2,minmax(0,0.8fr))]">
            <label className="text-sm font-medium text-neutral-700">
              <span className="mb-1 block">Category</span>
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f45a1f]"
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={loading || exportingFormat !== null}
              onClick={() => void handleExport("csv")}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportingFormat === "csv" ? "Exporting..." : "Export CSV"}
            </button>
            <button
              type="button"
              disabled={loading || exportingFormat !== null}
              onClick={() => void handleExport("pdf")}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportingFormat === "pdf" ? "Preparing..." : "Export PDF"}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Category reporting uses current product-to-category relationships. Historical category
          snapshots are not part of this phase.
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Products Considered"
          value={loading ? "..." : report?.summary.totalProductsConsidered ?? 0}
        />
        <SummaryCard
          title="Selling Products"
          value={loading ? "..." : report?.summary.sellingProductsCount ?? 0}
        />
        <SummaryCard
          title="Quantity Sold"
          value={loading ? "..." : report?.summary.totalQuantitySold ?? 0}
        />
        <SummaryCard
          title="Revenue"
          value={loading ? "..." : formatPeso(report?.summary.totalRevenue ?? "0")}
        />
        <SummaryCard
          title="Gross Margin"
          value={loading ? "..." : formatPeso(report?.summary.totalGrossMargin ?? "0")}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <WidgetCard title="Product Comparison" className="pos-comparison">
          <div className="overflow-x-auto">
            <div className="min-w-[76rem] overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1.3fr_0.9fr_0.7fr_0.7fr_0.8fr_0.9fr_0.9fr_0.8fr_0.8fr] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Product</span>
                <span>Category</span>
                <span>Variants</span>
                <span>Orders</span>
                <span>Qty Sold</span>
                <span>Revenue</span>
                <span>COGS</span>
                <span>Gross Margin</span>
                <span>Contribution</span>
              </div>
              <div className="max-h-[32rem] overflow-y-auto">
                {loading ? (
                  <div className="px-4 py-6 text-sm text-slate-500">
                    Loading product performance...
                  </div>
                ) : (report?.products ?? []).length === 0 ? (
                  <PosReportEmpty message="No products matched the selected range and category filter." />
                ) : (
                  report?.products.map((row) => (
                    <div
                      key={row.productId}
                      className="grid grid-cols-[1.3fr_0.9fr_0.7fr_0.7fr_0.8fr_0.9fr_0.9fr_0.8fr_0.8fr] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{row.productName}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Margin rate {formatRate(row.marginRate)}
                        </div>
                      </div>
                      <div>{row.category.name}</div>
                      <div>{row.variantCount}</div>
                      <div>{row.orderCount}</div>
                      <div>{row.quantitySold}</div>
                      <div>{formatPeso(row.revenue)}</div>
                      <div>{formatPeso(row.cogs)}</div>
                      <div className="font-semibold text-slate-900">
                        {formatPeso(row.grossMargin)}
                      </div>
                      <div>{formatRate(row.contributionPercentage)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </WidgetCard>

        <div className="space-y-6">
          <WidgetCard title="Top Categories" className="pos-categories">
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1.1fr_0.8fr_1fr_1fr_0.8fr] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Category</span>
                <span>Qty Sold</span>
                <span>Revenue</span>
                <span>Gross Margin</span>
                <span>Share</span>
              </div>
              <div className="max-h-[18rem] overflow-y-auto">
                {loading ? (
                  <div className="px-4 py-6 text-sm text-slate-500">Loading categories...</div>
                ) : (report?.topCategories ?? []).length === 0 ? (
                  <PosReportEmpty message="No category totals matched the current view." />
                ) : (
                  report?.topCategories.map((row) => (
                    <div
                      key={row.categoryId}
                      className="grid grid-cols-[1.1fr_0.8fr_1fr_1fr_0.8fr] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                    >
                      <div className="font-semibold text-slate-900">{row.categoryName}</div>
                      <div>{row.quantitySold}</div>
                      <div>{formatPeso(row.revenue)}</div>
                      <div>{formatPeso(row.grossMargin)}</div>
                      <div>{formatRate(row.contributionPercentage)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </WidgetCard>

          <WidgetCard title="Top 10 Views" className="pos-top-products">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Best Sellers by Quantity
                </p>
                <div className="mt-3 space-y-3">
                  {(report?.topSellersByQuantity ?? []).slice(0, 10).map((row) => (
                    <div
                      key={`qty-${row.productId}`}
                      className="flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{row.productName}</div>
                        <div className="text-xs text-slate-500">{row.category.name}</div>
                      </div>
                      <div className="text-sm font-semibold text-slate-900">{row.quantitySold}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Top Products by Gross Margin
                </p>
                <div className="mt-3 space-y-3">
                  {(report?.topProductsByGrossMargin ?? []).slice(0, 10).map((row) => (
                    <div
                      key={`margin-${row.productId}`}
                      className="flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{row.productName}</div>
                        <div className="text-xs text-slate-500">{row.category.name}</div>
                      </div>
                      <div className="text-sm font-semibold text-slate-900">
                        {formatPeso(row.grossMargin)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </WidgetCard>
        </div>
      </section>

      <WidgetCard title="Slow-Moving Products" className="pos-slow-products">
        <div className="overflow-x-auto">
          <div className="min-w-[60rem] overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1.2fr_0.9fr_0.8fr_1fr_1fr_0.8fr] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Product</span>
              <span>Category</span>
              <span>Qty Sold</span>
              <span>Revenue</span>
              <span>Gross Margin</span>
              <span>Orders</span>
            </div>
            <div className="max-h-[24rem] overflow-y-auto">
              {loading ? (
                <div className="px-4 py-6 text-sm text-slate-500">
                  Loading slow-moving products...
                </div>
              ) : (report?.slowMovingProducts ?? []).length === 0 ? (
                <PosReportEmpty message="No slow-moving products matched the current view." />
              ) : (
                report?.slowMovingProducts.map((row) => (
                  <div
                    key={`slow-${row.productId}`}
                    className="grid grid-cols-[1.2fr_0.9fr_0.8fr_1fr_1fr_0.8fr] gap-3 border-b px-4 py-4 text-sm last:border-b-0"
                  >
                    <div className="font-semibold text-slate-900">{row.productName}</div>
                    <div>{row.category.name}</div>
                    <div>{row.quantitySold}</div>
                    <div>{formatPeso(row.revenue)}</div>
                    <div>{formatPeso(row.grossMargin)}</div>
                    <div>{row.orderCount}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </WidgetCard>
    </div>
  );
}
