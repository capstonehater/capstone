"use client";

import type { FormEvent } from "react";
import {
  InventoryField,
  inventoryInputClasses,
  inventoryTextareaClasses,
} from "@/components/admin/inventory/InventoryField";
import InventoryModal from "@/components/admin/inventory/InventoryModal";
import type { InventorySummaryItem, StockBatch, Supplier } from "@/lib/inventory";
import {
  getDefaultAdjustmentReasonCode,
  INVENTORY_ADJUSTMENT_REASON_OPTIONS,
} from "@/lib/inventory-reason-options";

type PanelMode =
  | null
  | "create-material"
  | "edit-material"
  | "supplier-management"
  | "stock-run-create"
  | "stock-run-manage"
  | "adjustment"
  | "waste"
  | "archive-material"
  | "delete-draft";

type AdjustmentFormState = {
  direction: "INCREASE" | "DECREASE";
  rawMaterialId: string;
  batchId: string;
  quantity: string;
  reasonCode: string;
  note: string;
  costPerUnit: string;
  supplierId: string;
  expirationDate: string;
  receivedAt: string;
};

function ModalActions({ children }: { children: React.ReactNode }) {
  return <div className="md:col-span-2 flex justify-end gap-3 pt-2">{children}</div>;
}

type AdjustmentModalProps = {
  activePanel: PanelMode;
  submitting: boolean;
  summaries: InventorySummaryItem[];
  suppliers: Supplier[];
  batches: StockBatch[];
  adjustmentForm: AdjustmentFormState;
  onClose: () => void;
  onAdjustmentFormChange: (
    next:
      | AdjustmentFormState
      | ((current: AdjustmentFormState) => AdjustmentFormState)
  ) => void;
  onSubmitAdjustment: (event: FormEvent<HTMLFormElement>) => void;
  onSelectRawMaterial: (rawMaterialId: string) => void;
  formatQuantity: (value: string) => string;
};

export default function AdjustmentModal({
  activePanel,
  submitting,
  summaries,
  suppliers,
  batches,
  adjustmentForm,
  onClose,
  onAdjustmentFormChange,
  onSubmitAdjustment,
  onSelectRawMaterial,
  formatQuantity,
}: AdjustmentModalProps) {
  if (activePanel !== "adjustment") return null;

  const reasonOptions =
    INVENTORY_ADJUSTMENT_REASON_OPTIONS[adjustmentForm.direction];

  return (
    <InventoryModal
      title="Record Adjustment"
      description="Capture recount gains or losses with clear labels so the ledger reflects why stock changed."
      onClose={onClose}
    >
      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmitAdjustment}>
        <InventoryField htmlFor="adjustment-direction" label="Adjustment direction">
          <select
            id="adjustment-direction"
            value={adjustmentForm.direction}
            onChange={(event) =>
              onAdjustmentFormChange((current) => ({
              ...current,
                direction: event.target.value as "INCREASE" | "DECREASE",
                batchId: "",
                reasonCode: getDefaultAdjustmentReasonCode(
                  event.target.value as "INCREASE" | "DECREASE",
                ),
              }))
            }
            className={inventoryInputClasses}
          >
            <option value="INCREASE">Increase stock</option>
            <option value="DECREASE">Decrease stock</option>
          </select>
        </InventoryField>
        <InventoryField htmlFor="adjustment-material" label="Raw material">
          <select
            id="adjustment-material"
            value={adjustmentForm.rawMaterialId}
            onChange={(event) => {
              const nextId = event.target.value;
              onAdjustmentFormChange((current) => ({
                ...current,
                rawMaterialId: nextId,
                batchId: "",
              }));
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

        {adjustmentForm.direction === "DECREASE" ? (
          <InventoryField htmlFor="adjustment-batch" label="Batch">
            <select
              id="adjustment-batch"
              value={adjustmentForm.batchId}
              onChange={(event) =>
                onAdjustmentFormChange((current) => ({
                  ...current,
                  batchId: event.target.value,
                }))
              }
              className={inventoryInputClasses}
            >
              <option value="">Select batch</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.id.slice(0, 8)} · remaining {formatQuantity(batch.remainingQuantity)}
                </option>
              ))}
            </select>
          </InventoryField>
        ) : (
          <InventoryField htmlFor="adjustment-supplier" label="Supplier">
            <select
              id="adjustment-supplier"
              value={adjustmentForm.supplierId}
              onChange={(event) =>
                onAdjustmentFormChange((current) => ({
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
        )}

        <InventoryField htmlFor="adjustment-quantity" label="Quantity">
          <input
            id="adjustment-quantity"
            type="number"
            min="0.0001"
            step="0.0001"
            value={adjustmentForm.quantity}
            onChange={(event) =>
              onAdjustmentFormChange((current) => ({
                ...current,
                quantity: event.target.value,
              }))
            }
            placeholder="1"
            className={inventoryInputClasses}
          />
        </InventoryField>
        <InventoryField htmlFor="adjustment-reason" label="Reason code">
          <select
            id="adjustment-reason"
            value={adjustmentForm.reasonCode}
            onChange={(event) =>
              onAdjustmentFormChange((current) => ({
                ...current,
                reasonCode: event.target.value,
              }))
            }
            className={inventoryInputClasses}
          >
            {reasonOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </InventoryField>

        {adjustmentForm.direction === "INCREASE" ? (
          <>
            <InventoryField htmlFor="adjustment-cost" label="Cost per unit">
              <input
                id="adjustment-cost"
                type="number"
                min="0.0001"
                step="0.0001"
                value={adjustmentForm.costPerUnit}
                onChange={(event) =>
                  onAdjustmentFormChange((current) => ({
                    ...current,
                    costPerUnit: event.target.value,
                  }))
                }
                placeholder="88"
                className={inventoryInputClasses}
              />
            </InventoryField>
            <InventoryField htmlFor="adjustment-expiration" label="Expiration date">
              <input
                id="adjustment-expiration"
                type="date"
                value={adjustmentForm.expirationDate}
                onChange={(event) =>
                  onAdjustmentFormChange((current) => ({
                    ...current,
                    expirationDate: event.target.value,
                  }))
                }
                className={inventoryInputClasses}
              />
            </InventoryField>
            <InventoryField htmlFor="adjustment-received" label="Received at">
              <input
                id="adjustment-received"
                type="datetime-local"
                value={adjustmentForm.receivedAt}
                onChange={(event) =>
                  onAdjustmentFormChange((current) => ({
                    ...current,
                    receivedAt: event.target.value,
                  }))
                }
                className={inventoryInputClasses}
              />
            </InventoryField>
          </>
        ) : null}

        <div className="md:col-span-2">
          <InventoryField htmlFor="adjustment-note" label="Note">
            <textarea
              id="adjustment-note"
              value={adjustmentForm.note}
              onChange={(event) =>
                onAdjustmentFormChange((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              placeholder="Optional context for the recount."
              className={inventoryTextareaClasses}
            />
          </InventoryField>
        </div>

        <ModalActions>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white">
            Save Adjustment
          </button>
        </ModalActions>
      </form>
    </InventoryModal>
  );
}
