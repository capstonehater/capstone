"use client";

import SearchInput from "@/components/ui/SearchInput";
import { formatUnit } from "@/lib/units";
import AdminSelect from "@/components/admin/AdminSelect";

import { Plus, RefreshCcw } from "lucide-react";
import { PermissionAction } from "@/components/auth/PermissionGuard";
import styles from "./InventorySummaryPanel.module.css";
import {
  InventoryField,
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
  onAddMaterial: () => void;
  creatingDisabled: boolean;
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
  onAddMaterial,
  creatingDisabled,
  formatQuantity,
  formatMoney,
}: InventorySummaryPanelProps) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 2xl:h-[42rem] 2xl:min-h-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-[#232d46]">Materials</h2>
          <p className="mt-1 truncate text-sm text-slate-500" title="Search and filter materials by stock status or supplier.">
            Search and filter materials by stock status or supplier.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <PermissionAction permission="inventory.create">
          <button type="button" onClick={onAddMaterial} disabled={creatingDisabled} className="inline-flex items-center gap-2 rounded-lg border border-[#232d46] bg-[#232d46] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#34425f] disabled:cursor-not-allowed disabled:opacity-50">
            <Plus size={16} aria-hidden="true" />
            Add Raw Material
          </button>
        </PermissionAction>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-[#232d46] transition hover:border-slate-300 hover:bg-slate-50"
        >
          <RefreshCcw size={15} />
          Refresh
        </button>
        </div>
      </div>

      <div className={styles.filters}>
        <div className="min-w-0">
        <InventoryField htmlFor="summary-search" label="Search">
          <SearchInput
            id="summary-search"
            value={summarySearchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
            placeholder="Ex. Bacon"
            className={styles.control}
          />
        </InventoryField>
        </div>
        <AdminSelect label="Status" value={statusFilter} onChange={onStatusFilterChange} options={[{ value: "", label: "All statuses" }, { value: "IN_STOCK", label: "In stock" }, { value: "LOW_STOCK", label: "Low stock" }, { value: "OUT_OF_STOCK", label: "Out of stock" }, { value: "INACTIVE", label: "Archived" }]} />
        <AdminSelect label="Supplier" value={supplierId} onChange={onSupplierChange} options={[{ value: "", label: "All suppliers" }, ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))]} />
      </div>

      <div className="mt-4 flex min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200">
        <div className="max-h-[34rem] min-h-0 min-w-0 flex-1 overflow-auto 2xl:max-h-none">
          <table className={`${styles.materialTable} w-full table-fixed text-sm [&_td]:[overflow-wrap:anywhere]`}>
            <colgroup>
              <col className="w-[32%]" />
              <col className="w-[24%]" />
              <col className="w-[16%]" />
              <col className="w-[28%]" />
            </colgroup>
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
                        {item.sku} · {formatUnit(item.unit.name)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex w-[92px] max-w-full items-center justify-center rounded-xl px-2 py-1 text-center text-xs font-semibold ${statusClasses(item.status)}`}
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
