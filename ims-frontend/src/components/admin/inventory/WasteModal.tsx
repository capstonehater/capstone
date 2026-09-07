"use client";

import type { FormEvent } from "react";
import {
  InventoryField,
  inventoryInputClasses,
  inventoryTextareaClasses,
} from "@/components/admin/inventory/InventoryField";
import InventoryModal from "@/components/admin/inventory/InventoryModal";
import type { InventorySummaryItem, StockBatch } from "@/lib/inventory";
import { INVENTORY_WASTE_REASON_OPTIONS } from "@/lib/inventory-reason-options";

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

type WasteFormState = {
  rawMaterialId: string;
  batchId: string;
  quantity: string;
  reasonCode: string;
  note: string;
};

function ModalActions({ children }: { children: React.ReactNode }) {
  return <div className="md:col-span-2 flex justify-end gap-3 pt-2">{children}</div>;
}

type WasteModalProps = {
  activePanel: PanelMode;
  submitting: boolean;
  summaries: InventorySummaryItem[];
  batches: StockBatch[];
  wasteForm: WasteFormState;
  onClose: () => void;
  onWasteFormChange: (next: WasteFormState | ((current: WasteFormState) => WasteFormState)) => void;
  onSubmitWaste: (event: FormEvent<HTMLFormElement>) => void;
  onSelectRawMaterial: (rawMaterialId: string) => void;
  formatQuantity: (value: string) => string;
};

export default function WasteModal({
  activePanel,
  submitting,
  summaries,
  batches,
  wasteForm,
  onClose,
  onWasteFormChange,
  onSubmitWaste,
  onSelectRawMaterial,
  formatQuantity,
}: WasteModalProps) {
  if (activePanel !== "waste") return null;

  return (
    <InventoryModal
      title="Record Waste"
      description="Log waste against a specific batch so the audit trail stays clear and batch balances stay accurate."
      onClose={onClose}
    >
      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmitWaste}>
        <InventoryField htmlFor="waste-material" label="Raw material">
          <select
            id="waste-material"
            value={wasteForm.rawMaterialId}
            onChange={(event) => {
              const nextId = event.target.value;
              onWasteFormChange((current) => ({
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
        <InventoryField htmlFor="waste-batch" label="Batch">
          <select
            id="waste-batch"
            value={wasteForm.batchId}
            onChange={(event) =>
              onWasteFormChange((current) => ({
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
        <InventoryField htmlFor="waste-quantity" label="Quantity">
          <input
            id="waste-quantity"
            type="number"
            min="0.0001"
            step="0.0001"
            value={wasteForm.quantity}
            onChange={(event) =>
              onWasteFormChange((current) => ({
                ...current,
                quantity: event.target.value,
              }))
            }
            placeholder="1"
            className={inventoryInputClasses}
          />
        </InventoryField>
        <InventoryField htmlFor="waste-reason" label="Reason code">
          <select
            id="waste-reason"
            value={wasteForm.reasonCode}
            onChange={(event) =>
              onWasteFormChange((current) => ({
                ...current,
                reasonCode: event.target.value,
              }))
            }
            className={inventoryInputClasses}
          >
            {INVENTORY_WASTE_REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </InventoryField>
        <div className="md:col-span-2">
          <InventoryField htmlFor="waste-note" label="Note">
            <textarea
              id="waste-note"
              value={wasteForm.note}
              onChange={(event) =>
                onWasteFormChange((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              placeholder="Optional note for the waste entry."
              className={inventoryTextareaClasses}
            />
          </InventoryField>
        </div>
        <ModalActions>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white">
            Record Waste
          </button>
        </ModalActions>
      </form>
    </InventoryModal>
  );
}
