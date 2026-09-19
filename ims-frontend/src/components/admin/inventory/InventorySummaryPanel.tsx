"use client";

import { RefreshCcw } from "lucide-react";
import {
  InventoryField,
  inventoryInputClasses,
} from "@/components/admin/inventory/InventoryField";
import type { InventorySummaryItem, Supplier } from "@/lib/inventory";

function statusClasses(status: InventorySummaryItem["status"]) {
  switch (status) {
    case "IN_STOCK":
      return "bg-lime-100 text-[#28511a]";
    case "LOW_STOCK":
      return "bg-amber-100 text-amber-800";
    case "OUT_OF_STOCK":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-slate-200 text-slate-700";
  }
}

type InventorySummaryPanelProps = {
  summarySearchInput: string;
  statusFilter: string;
  supplierId: string;
  suppliers: Supplier[];
  summaries: InventorySummaryItem[];
  selectedRawMaterialId: string | null;
  loading: boolean;
  onSearchInputChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onSupplierChange: (value: string) => void;
  onSelectRawMaterial: (rawMaterialId: string) => void;
  onRefresh: () => void;
  formatQuantity: (value: string) => string;
  formatMoney: (value: string) => string;
};

export default function InventorySummaryPanel({
  summarySearchInput,
  statusFilter,
  supplierId,
  suppliers,
  summaries,
  selectedRawMaterialId,
  loading,
  onSearchInputChange,
  onStatusFilterChange,
  onSupplierChange,
  onSelectRawMaterial,
  onRefresh,
  formatQuantity,
  formatMoney,
}: InventorySummaryPanelProps) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 2xl:h-[42rem] 2xl:min-h-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#232d46]">Materials</h2>
          <p className="mt-1 text-sm text-slate-500">
            Search and filter materials by stock status or supplier.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-[#232d46] transition hover:border-slate-300 hover:bg-slate-50"
        >
          <RefreshCcw size={15} />
          Refresh
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        <InventoryField htmlFor="summary-search" label="Search">
          <input
            id="summary-search"
            value={summarySearchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
            placeholder="Search by material or SKU"
            className={inventoryInputClasses}
          />
        </InventoryField>
        <InventoryField htmlFor="summary-status" label="Status">
          <select
            id="summary-status"
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
            className={inventoryInputClasses}
          >
            <option value="">All statuses</option>
            <option value="IN_STOCK">In stock</option>
            <option value="LOW_STOCK">Low stock</option>
            <option value="OUT_OF_STOCK">Out of stock</option>
            <option value="INACTIVE">Archived</option>
          </select>
        </InventoryField>
        <InventoryField htmlFor="summary-supplier" label="Supplier">
          <select
            id="summary-supplier"
            value={supplierId}
            onChange={(event) => onSupplierChange(event.target.value)}
            className={inventoryInputClasses}
          >
            <option value="">All suppliers</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </InventoryField>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200">
        <div className="max-h-[34rem] min-h-0 flex-1 overflow-auto 2xl:max-h-none">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Usable</th>
                <th className="px-4 py-3">Value</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-8 text-slate-500" colSpan={4}>
                    Loading inventory summary...
                  </td>
                </tr>
              ) : summaries.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-slate-500" colSpan={4}>
                    No materials matched the current filters.
                  </td>
                </tr>
              ) : (
                summaries.map((item) => (
                  <tr
                    key={item.rawMaterialId}
                    onClick={() => onSelectRawMaterial(item.rawMaterialId)}
                    className={`cursor-pointer border-t border-slate-100 transition hover:bg-lime-50 ${
                      item.rawMaterialId === selectedRawMaterialId ? "bg-lime-50" : "bg-white"
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.sku} · {item.unit.name}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(item.status)}`}
                      >
                        {item.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-slate-700">{formatQuantity(item.summary.usableQuantity)}</td>
                    <td className="px-3 py-2.5 text-sm font-medium text-slate-700">{formatMoney(item.inventoryValue)}</td>
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
