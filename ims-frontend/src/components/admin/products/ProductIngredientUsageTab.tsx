"use client";

import { inventoryInputClasses } from "@/components/admin/inventory/InventoryField";
import type { ProductIngredientUsage, ProductUsageScope } from "@/lib/products";
import { formatDateTime, formatPeso } from "./product-ui";

type Props = {
  usage: ProductIngredientUsage | null;
  usageDate: string;
  usageScope: ProductUsageScope;
  loading: boolean;
  error?: string | null;
  onDateChange: (value: string) => void;
  onScopeChange: (scope: ProductUsageScope) => void;
  onRefresh: () => void;
};

const scopeOptions: Array<{ value: ProductUsageScope; label: string }> = [
  { value: "ONE_DAY", label: "1 Day" },
  { value: "LAST_7_DAYS", label: "7 Days" },
  { value: "LAST_30_DAYS", label: "30 Days" },
];

export default function ProductIngredientUsageTab({
  usage,
  usageDate,
  usageScope,
  loading,
  error,
  onDateChange,
  onScopeChange,
  onRefresh,
}: Props) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>Usage window</span>
            <select
              value={usageScope}
              onChange={(event) => onScopeChange(event.target.value as ProductUsageScope)}
              className={inventoryInputClasses}
            >
              {scopeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>{usageScope === "ONE_DAY" ? "Business date" : "Window end date"}</span>
            <input
              type="date"
              value={usageDate}
              onChange={(event) => onDateChange(event.target.value)}
              className={inventoryInputClasses}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh Usage"}
        </button>
      </div>

      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!usage ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
          No ingredient-usage data is loaded for this selection yet.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            Covered range: {formatDateTime(usage.startAt)} to {formatDateTime(usage.endAt)}.
            Reversed values reflect deductions reversed by refund or void flows, and net values are
            the remaining authoritative usage.
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Orders covered
              </p>
              <p className="mt-3 text-2xl font-bold text-slate-900">
                {usage.distinctOrderCount}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Product units sold
              </p>
              <p className="mt-3 text-2xl font-bold text-slate-900">
                {usage.productUnitsSold}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Covered dates
              </p>
              <p className="mt-3 text-sm font-semibold text-slate-900">
                {usage.coveredDates.length}
              </p>
            </div>
          </div>

          {usage.ingredients.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              No ingredient deductions were found for this date window.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-500">
                    <th className="px-4 py-3 font-semibold">Ingredient</th>
                    <th className="px-4 py-3 font-semibold">Unit</th>
                    <th className="px-4 py-3 font-semibold">Gross deducted</th>
                    <th className="px-4 py-3 font-semibold">Reversed</th>
                    <th className="px-4 py-3 font-semibold">Net deducted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {usage.ingredients.map((ingredient) => (
                    <tr key={ingredient.rawMaterialId}>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {ingredient.rawMaterialName}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{ingredient.unit.code}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {ingredient.grossQuantity} · {formatPeso(ingredient.grossCost)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {ingredient.reversedQuantity} · {formatPeso(ingredient.reversedCost)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {ingredient.netQuantity} · {formatPeso(ingredient.netCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
