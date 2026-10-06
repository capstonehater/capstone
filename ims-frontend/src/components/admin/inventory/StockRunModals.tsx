"use client";

import { formatUnit } from "@/lib/units";
import StockRunDateField from "./StockRunDateField";
import AdminSelect from "@/components/admin/AdminSelect";
import styles from "./InventoryModal.module.css";
import { PermissionAction } from "@/components/auth/PermissionGuard";

import { useEffect, type FormEvent } from "react";
import { currentManilaReceivingDateTime } from "@/lib/stock-run-receiving";
import { Loader2, Trash2 } from "lucide-react";
import {
  InventoryField,
  inventoryInputClasses,
  inventoryTextareaClasses,
} from "@/components/admin/inventory/InventoryField";
import InventoryModal from "@/components/admin/inventory/InventoryModal";
import type { InventorySummaryItem, StockRun, Supplier } from "@/lib/inventory";
import { defaultStockRunPriceBasis, priceQuantityInInventoryUnits, stockRunPriceUnitOptions } from "@/lib/stock-run-pricing";

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
  costQuantity: string;
  costUnitCode: string;
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
  useEffect(() => {
    if (activePanel === "stock-run-manage") {
      onStockRunItemFormChange(current => current.receivedAt ? current : ({ ...current, receivedAt: currentManilaReceivingDateTime() }));
    }
  }, [activePanel, onStockRunItemFormChange]);
  const selectedSummary =
    summaries.find((summary) => summary.rawMaterialId === stockRunItemForm.rawMaterialId) ??
    null;
  const selectedUnitCode = selectedSummary?.unit.code ?? null;
  const price = Number(stockRunItemForm.costPerUnit);
  const receivedQuantity = Number(stockRunItemForm.quantity);
  const useKilogramPrice = selectedUnitCode?.trim().toUpperCase() === "G";
  const useLitrePrice = selectedUnitCode?.trim().toUpperCase() === "ML";
  const priceQuantity = priceQuantityInInventoryUnits(Number(stockRunItemForm.costQuantity), stockRunItemForm.costUnitCode, selectedUnitCode);
  const calculatedUnitCost = price > 0 && priceQuantity > 0 && Number.isFinite(price / priceQuantity)
    ? Number((price / priceQuantity).toFixed(8)) : null;
  const unitCostFormatter = new Intl.NumberFormat("en-PH", {
    style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 4,
  });

  return (
    <>
      {activePanel === "stock-run-create" ? (
        <InventoryModal
          professional
          title="Create Stock-Run Draft"
          description="Step 1 of 2. Create the draft first, then add incoming line items in the next modal."
          onClose={onClose}
        >
          <PermissionAction permission={"stockRuns.create"}><form className="space-y-4" onSubmit={onCreateStockRun}>
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
              <button type="submit" disabled={submitting} className="rounded-full bg-[#f45a1f] px-5 py-2 text-sm font-semibold text-white">
                Create Draft
              </button>
            </div>
          </form></PermissionAction>
        </InventoryModal>
      ) : null}

      {activePanel === "stock-run-manage" ? (
        <InventoryModal
          professional
          panelClassName="stockRunManageDialog"
          title="Manage Stock-Run Draft"
          description="Step 2 of 2. Add batch lines, remove draft items, then post when the receiving list is complete."
          onClose={onClose}
          wide
        >
          {activeStockRunId && stockRunLoading ? (
            <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-500">
              <Loader2 size={18} className="mr-2 animate-spin" />
              Loading draft details...
            </div>
          ) : activeStockRun ? (
            <div className={styles.stockRunManageLayout}>
              <section className={styles.stockRunManageContainer}>
                <div className={`${styles.stockRunSummary} bg-white`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-500">{activeStockRun.status}</div>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">{activeStockRun.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{activeStockRun.notes || "No notes yet."}</p>
                    </div>
                    <PermissionAction permission={"stockRuns.delete"}><button type="button" onClick={onOpenDeleteDraft} className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"><Trash2 size={15} />Delete Draft</button></PermissionAction>
                  </div>
                </div>

                <PermissionAction permission={"stockRuns.edit"}><form className={`${styles.stockRunItemForm} grid bg-white`} onSubmit={onAddStockRunItem}>
                  <AdminSelect label="Raw material" value={stockRunItemForm.rawMaterialId} onChange={(rawMaterialId) => {
                    const code = summaries.find(summary => summary.rawMaterialId === rawMaterialId)?.unit.code;
                    onStockRunItemFormChange((current) => ({ ...current, rawMaterialId, costPerUnit: "", ...defaultStockRunPriceBasis(code) }));
                    onSelectRawMaterial(rawMaterialId);
                  }} options={[{ value: "", label: "Select raw material" }, ...summaries.map((summary) => ({ value: summary.rawMaterialId, label: summary.name }))]} />
                  <AdminSelect label="Supplier" value={stockRunItemForm.supplierId} onChange={(supplierId) => onStockRunItemFormChange((current) => ({ ...current, supplierId }))} options={[{ value: "", label: "Optional supplier" }, ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))]} />
                  <InventoryField htmlFor="stock-run-item-quantity" label="Quantity received">
                    <input
                      id="stock-run-item-quantity"
                      type="number"
                      required
                      min="0.0001"
                      step="0.0001"
                      value={stockRunItemForm.quantity}
                      onChange={(event) =>
                        onStockRunItemFormChange((current) => ({
                          ...current,
                          quantity: event.target.value,
                        }))
                      }
                      placeholder={useKilogramPrice || useLitrePrice ? "1000" : "4"}
                      className={inventoryInputClasses}
                    />
                    {selectedUnitCode ? (
                      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                        Unit: {selectedUnitCode}
                      </p>
                    ) : null}
                  </InventoryField>
                  <InventoryField htmlFor="stock-run-item-cost" label="Purchase price (PHP)">
                    <input
                      id="stock-run-item-cost"
                      type="number"
                      required
                      min="0.0001"
                      step="0.0001"
                      value={stockRunItemForm.costPerUnit}
                      onChange={(event) =>
                        onStockRunItemFormChange((current) => ({
                          ...current,
                          costPerUnit: event.target.value,
                        }))
                      }
                      placeholder="120"
                      className={inventoryInputClasses}
                    />
                  </InventoryField>
                  <InventoryField htmlFor="stock-run-item-price-quantity" label="Price covers">
                    <div className={styles.priceCoverageRow}>
                    <div className={styles.priceCoverageControl}>
                    <input
                      id="stock-run-item-price-quantity"
                      type="number"
                      required
                      min="0.0001"
                      step="0.0001"
                      value={stockRunItemForm.costQuantity}
                      onChange={event => onStockRunItemFormChange(current => ({ ...current, costQuantity: event.target.value }))}
                      placeholder="250"
                      className={inventoryInputClasses}
                      aria-describedby="stock-run-price-coverage-hint"
                    />
                    <AdminSelect
                      label="Price unit"
                      hideLabel
                      describedBy="stock-run-price-coverage-hint"
                      value={stockRunItemForm.costUnitCode}
                      onChange={costUnitCode => onStockRunItemFormChange(current => ({ ...current, costUnitCode }))}
                      options={stockRunPriceUnitOptions(selectedUnitCode)}
                    />
                    </div>
                    <div className={`${styles.stockRunCostPreview} text-sm text-slate-600`} aria-live="polite">
                      {calculatedUnitCost !== null ? (
                        <>
                          <p>Cost per {formatUnit(selectedUnitCode || "unit")}: <strong>{unitCostFormatter.format(calculatedUnitCost)}</strong></p>
                          {receivedQuantity > 0 && Number.isFinite(receivedQuantity * calculatedUnitCost) ? <p className="mt-1">Line total: <strong>{formatMoney(String(receivedQuantity * calculatedUnitCost))}</strong></p> : null}
                        </>
                      ) : <p>Enter a price and the quantity it covers to calculate the unit cost.</p>}
                    </div>
                    </div>
                    <p id="stock-run-price-coverage-hint" className="mt-2 text-xs text-slate-500">Quantity covered by the price, separate from total stock received.</p>
                  </InventoryField>
                  <div className={styles.stockRunExpirationFields}>
                  <StockRunDateField
                    id="stock-run-item-expiration"
                    label="Expiration date"
                    value={stockRunItemForm.expirationDate}
                      onChange={(value) =>
                        onStockRunItemFormChange((current) => ({
                          ...current,
                          expirationDate: value,
                      }))
                    }
                  />
                  </div>
                  <div className={styles.stockRunReceivedFields}>
                  <div className={styles.stockRunTimeField}>
                  <StockRunDateField
                    id="stock-run-item-received-time"
                    label="Received time (Manila)"
                    type="time"
                    required
                    value={stockRunItemForm.receivedAt.split("T")[1] || ""}
                    onChange={value => onStockRunItemFormChange(current => ({ ...current, receivedAt: `${current.receivedAt.split("T")[0]}T${value}` }))}
                  />
                  </div>
                    <StockRunDateField id="stock-run-item-received-date" label="Received date" required value={stockRunItemForm.receivedAt.split("T")[0]}
                      onChange={value => onStockRunItemFormChange(current => ({ ...current, receivedAt: `${value}T${current.receivedAt.split("T")[1] || currentManilaReceivingDateTime().split("T")[1]}` }))} />
                  </div>
                  <div className={styles.stockRunNoteField}>
                    <InventoryField htmlFor="stock-run-item-note" label="Line note">
                      <textarea
                        id="stock-run-item-note"
                        value={stockRunItemForm.note}
                        onChange={(event) => onStockRunItemFormChange((current) => ({ ...current, note: event.target.value }))}
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
                </form></PermissionAction>
              </section>

              <div className={`${styles.stockRunDraftItems} flex min-w-0 flex-col overflow-hidden bg-white`}>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Draft Items</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Review received materials, then post the run when everything is ready.
                    </p>
                  </div>
                  <PermissionAction permission={"stockRuns.post"}>
                    <button
                      type="button"
                      onClick={onPostStockRun}
                      disabled={submitting || activeStockRun.items.length === 0 || activeStockRun.status !== "DRAFT"}
                      className={styles.stockRunPostButton}
                    >
                      {submitting ? "Please wait..." : "Post Run"}
                    </button>
                  </PermissionAction>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-white text-left text-xs uppercase tracking-[0.18em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Material</th>
                        <th className="px-4 py-3">Qty</th>
                        <th className="px-4 py-3">Unit cost / Total</th>
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
                                {[formatUnit(item.rawMaterial?.unit?.code || ""), item.supplier?.name || "No supplier"]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {formatQuantity(item.quantity)}
                              {item.rawMaterial?.unit?.code
                                ? ` ${formatUnit(item.rawMaterial.unit.code)}`
                                : ""}
                            </td>
                            <td className="px-4 py-3">
                              {item.purchaseCost && item.priceQuantity && item.priceUnitCode ? <div className="mb-1 text-xs text-slate-500">{formatMoney(item.purchaseCost)} per {formatQuantity(item.priceQuantity)} {formatUnit(item.priceUnitCode)}</div> : null}
                              <div>{unitCostFormatter.format(Number(item.costPerUnit))}{item.rawMaterial?.unit?.code ? ` / ${formatUnit(item.rawMaterial.unit.code)}` : ""}</div>
                              <div className="mt-1 text-xs text-slate-500">Total: {formatMoney(String(Number(item.quantity) * Number(item.costPerUnit)))}</div>
                            </td>
                            <td className="px-4 py-3">{formatDate(item.expirationDate)}</td>
                            <td className="px-4 py-3 text-right">
                              <PermissionAction permission={"stockRuns.edit"}><button
                                type="button"
                                onClick={() => onDeleteStockRunItem(item.id)}
                                className="text-xs font-semibold text-rose-600"
                              >
                                Remove
                              </button></PermissionAction>
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
              <PermissionAction permission={"stockRuns.delete"}><button type="button" onClick={onDeleteStockRunDraft} disabled={submitting} className="rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white">
                Delete Draft
              </button></PermissionAction>
            </div>
          </div>
        </InventoryModal>
      ) : null}
    </>
  );
}
