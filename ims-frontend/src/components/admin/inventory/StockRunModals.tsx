"use client";

import type { FormEvent } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  InventoryField,
  inventoryInputClasses,
  inventoryTextareaClasses,
} from "@/components/admin/inventory/InventoryField";
import InventoryModal from "@/components/admin/inventory/InventoryModal";
import type { InventorySummaryItem, StockRun, Supplier } from "@/lib/inventory";

type PanelMode =
  | null
  | "create-material"
  | "edit-material"
  | "stock-run-create"
  | "stock-run-manage"
  | "waste"
  | "archive-material"
  | "delete-draft";

type StockRunFormState = {
  name: string;
  notes: string;
};

type StockRunItemFormState = {
  rawMaterialId: string;
  supplierId: string;
  quantity: string;
  costPerUnit: string;
  expirationDate: string;
  receivedAt: string;
  note: string;
};

function ModalActions({ children }: { children: React.ReactNode }) {
  return <div className="xl:col-span-2 flex justify-end gap-3 pt-2">{children}</div>;
}

type StockRunModalsProps = {
  activePanel: PanelMode;
  submitting: boolean;
  summaries: InventorySummaryItem[];
  suppliers: Supplier[];
  activeStockRun: StockRun | null;
  activeStockRunId: string | null;
  stockRunLoading: boolean;
  stockRunForm: StockRunFormState;
  stockRunItemForm: StockRunItemFormState;
  onClose: () => void;
  onOpenDeleteDraft: () => void;
  onBackToManage: () => void;
  onStockRunFormChange: (
    next: StockRunFormState | ((current: StockRunFormState) => StockRunFormState)
  ) => void;
  onStockRunItemFormChange: (
    next:
      | StockRunItemFormState
      | ((current: StockRunItemFormState) => StockRunItemFormState)
  ) => void;
  onCreateStockRun: (event: FormEvent<HTMLFormElement>) => void;
  onAddStockRunItem: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteStockRunItem: (stockRunItemId: string) => void;
  onDeleteStockRunDraft: () => void;
  onPostStockRun: () => void;
  onSelectRawMaterial: (rawMaterialId: string) => void;
  formatQuantity: (value: string) => string;
  formatMoney: (value: string) => string;
  formatDate: (value: string | null | undefined) => string;
};

export default function StockRunModals({
  activePanel,
  submitting,
  summaries,
  suppliers,
  activeStockRun,
  activeStockRunId,
  stockRunLoading,
  stockRunForm,
  stockRunItemForm,
  onClose,
  onOpenDeleteDraft,
  onBackToManage,
  onStockRunFormChange,
  onStockRunItemFormChange,
  onCreateStockRun,
  onAddStockRunItem,
  onDeleteStockRunItem,
  onDeleteStockRunDraft,
  onPostStockRun,
  onSelectRawMaterial,
  formatQuantity,
  formatMoney,
  formatDate,
}: StockRunModalsProps) {
  const selectedSummary =
    summaries.find((summary) => summary.rawMaterialId === stockRunItemForm.rawMaterialId) ??
    null;
  const selectedUnitCode = selectedSummary?.unit.code ?? null;

  return (
    <>
      {activePanel === "stock-run-create" ? (
        <InventoryModal
          title="Create Stock-Run Draft"
          description="Step 1 of 2. Create the draft first, then add incoming line items in the next modal."
          onClose={onClose}
        >
          <form className="space-y-4" onSubmit={onCreateStockRun}>
            <InventoryField htmlFor="stock-run-name" label="Draft name">
              <input
                id="stock-run-name"
                value={stockRunForm.name}
                onChange={(event) =>
                  onStockRunFormChange((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Monday Produce Run"
                className={inventoryInputClasses}
              />
            </InventoryField>
            <InventoryField htmlFor="stock-run-notes" label="Notes">
              <textarea
                id="stock-run-notes"
                value={stockRunForm.notes}
                onChange={(event) =>
                  onStockRunFormChange((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Weekly dairy and syrup restock."
                className={inventoryTextareaClasses}
              />
            </InventoryField>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="rounded-full bg-[#f45a1f] px-5 py-2 text-sm font-semibold text-white">
                Create Draft
              </button>
            </div>
          </form>
        </InventoryModal>
      ) : null}

      {activePanel === "stock-run-manage" ? (
        <InventoryModal
          title="Manage Stock-Run Draft"
          description="Step 2 of 2. Add batch lines, remove draft items, then post when the receiving list is complete."
          onClose={onClose}
          wide
          bodyClassName="flex-1 overflow-y-auto p-6 xl:overflow-hidden"
        >
          {activeStockRunId && stockRunLoading ? (
            <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-500">
              <Loader2 size={18} className="mr-2 animate-spin" />
              Loading draft details...
            </div>
          ) : activeStockRun ? (
            <div className="grid h-full min-h-0 gap-6 xl:grid-cols-[0.95fr_1.25fr]">
              <div className="min-h-0 space-y-4 xl:overflow-y-auto xl:pr-1">
                <div className="rounded-[26px] border border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-500">
                        {activeStockRun.status}
                      </div>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">
                        {activeStockRun.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {activeStockRun.notes || "No notes yet."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenDeleteDraft}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                    >
                      <Trash2 size={15} />
                      Delete Draft
                    </button>
                  </div>
                </div>

                <form className="grid gap-4 rounded-[26px] border border-slate-200 bg-white p-5" onSubmit={onAddStockRunItem}>
                  <InventoryField htmlFor="stock-run-item-material" label="Raw material">
                    <select
                      id="stock-run-item-material"
                      value={stockRunItemForm.rawMaterialId}
                      onChange={(event) => {
                        const nextId = event.target.value;
                        onStockRunItemFormChange((current) => ({ ...current, rawMaterialId: nextId }));
                        onSelectRawMaterial(nextId);
                      }}
                      className={inventoryInputClasses}
                    >
                      <option value="">Select raw material</option>
                      {summaries.map((summary) => (
                        <option key={summary.rawMaterialId} value={summary.rawMaterialId}>
                          {summary.name}
                        </option>
                      ))}
                    </select>
                  </InventoryField>
                  <InventoryField htmlFor="stock-run-item-supplier" label="Supplier">
                    <select
                      id="stock-run-item-supplier"
                      value={stockRunItemForm.supplierId}
                      onChange={(event) =>
                        onStockRunItemFormChange((current) => ({
                          ...current,
                          supplierId: event.target.value,
                        }))
                      }
                      className={inventoryInputClasses}
                    >
                      <option value="">Optional supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </InventoryField>
                  <InventoryField htmlFor="stock-run-item-quantity" label="Quantity">
                    <input
                      id="stock-run-item-quantity"
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={stockRunItemForm.quantity}
                      onChange={(event) =>
                        onStockRunItemFormChange((current) => ({
                          ...current,
                          quantity: event.target.value,
                        }))
                      }
                      placeholder="4"
                      className={inventoryInputClasses}
                    />
                    {selectedUnitCode ? (
                      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                        Unit: {selectedUnitCode}
                      </p>
                    ) : null}
                  </InventoryField>
                  <InventoryField htmlFor="stock-run-item-cost" label="Cost per unit">
                    <input
                      id="stock-run-item-cost"
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={stockRunItemForm.costPerUnit}
                      onChange={(event) =>
                        onStockRunItemFormChange((current) => ({
                          ...current,
                          costPerUnit: event.target.value,
                        }))
                      }
                      placeholder="72"
                      className={inventoryInputClasses}
                    />
                  </InventoryField>
                  <InventoryField htmlFor="stock-run-item-expiry" label="Expiration date">
                    <input
                      id="stock-run-item-expiry"
                      type="date"
                      value={stockRunItemForm.expirationDate}
                      onChange={(event) =>
                        onStockRunItemFormChange((current) => ({
                          ...current,
                          expirationDate: event.target.value,
                        }))
                      }
                      className={inventoryInputClasses}
                    />
                  </InventoryField>
                  <InventoryField htmlFor="stock-run-item-received" label="Received at">
                    <input
                      id="stock-run-item-received"
                      type="datetime-local"
                      value={stockRunItemForm.receivedAt}
                      onChange={(event) =>
                        onStockRunItemFormChange((current) => ({
                          ...current,
                          receivedAt: event.target.value,
                        }))
                      }
                      className={inventoryInputClasses}
                    />
                  </InventoryField>
                  <div className="xl:col-span-2">
                    <InventoryField htmlFor="stock-run-item-note" label="Line note">
                      <textarea
                        id="stock-run-item-note"
                        value={stockRunItemForm.note}
                        onChange={(event) =>
                          onStockRunItemFormChange((current) => ({
                            ...current,
                            note: event.target.value,
                          }))
                        }
                        placeholder="Optional note for this receiving line."
                        className={inventoryTextareaClasses}
                      />
                    </InventoryField>
                  </div>
                  <ModalActions>
                    <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">
                      Done
                    </button>
                    <button type="submit" disabled={submitting} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white">
                      Add Item
                    </button>
                  </ModalActions>
                </form>
              </div>

              <div className="flex min-h-[480px] min-w-0 flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white xl:min-h-0">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Draft Items</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Remove lines here or post the run when everything is ready.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onPostStockRun}
                    disabled={submitting || activeStockRun.items.length === 0}
                    className="rounded-full bg-[#f45a1f] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Post Run
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-white text-left text-xs uppercase tracking-[0.18em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Material</th>
                        <th className="px-4 py-3">Qty</th>
                        <th className="px-4 py-3">Cost</th>
                        <th className="px-4 py-3">Expiry</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeStockRun.items.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-slate-500" colSpan={5}>
                            No draft items yet.
                          </td>
                        </tr>
                      ) : (
                        activeStockRun.items.map((item) => (
                          <tr key={item.id} className="border-t border-slate-100">
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">
                                {item.rawMaterial?.name || item.rawMaterialId}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {[item.rawMaterial?.unit?.code, item.supplier?.name || "No supplier"]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {formatQuantity(item.quantity)}
                              {item.rawMaterial?.unit?.code
                                ? ` ${item.rawMaterial.unit.code}`
                                : ""}
                            </td>
                            <td className="px-4 py-3">{formatMoney(item.costPerUnit)}</td>
                            <td className="px-4 py-3">{formatDate(item.expirationDate)}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => onDeleteStockRunItem(item.id)}
                                className="text-xs font-semibold text-rose-600"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
              Create a stock-run draft first, then return here to add receiving lines.
            </div>
          )}
        </InventoryModal>
      ) : null}

      {activePanel === "delete-draft" && activeStockRun ? (
        <InventoryModal
          title="Delete Stock-Run Draft"
          description="Draft deletion is only available before posting. The draft and its unposted line items will be removed."
          onClose={onBackToManage}
        >
          <div className="space-y-5">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
              You are deleting draft <span className="font-semibold">{activeStockRun.name}</span>{" "}
              with{" "}
              <span className="font-semibold">
                {activeStockRun.items.length} line{activeStockRun.items.length === 1 ? "" : "s"}
              </span>
              .
            </div>
            <p className="text-sm text-slate-600">
              Use this when the draft was created by mistake or is no longer needed.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onBackToManage} className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">
                Keep Draft
              </button>
              <button type="button" onClick={onDeleteStockRunDraft} disabled={submitting} className="rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white">
                Delete Draft
              </button>
            </div>
          </div>
        </InventoryModal>
      ) : null}
    </>
  );
}
