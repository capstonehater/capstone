"use client";
import AdminSelect from "@/components/admin/AdminSelect";

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
  | "stock-run-create"
  | "stock-run-manage"
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
          professional
      title="Record Waste"
      description="Log waste against a specific batch so the audit trail stays clear and batch balances stay accurate."
      onClose={onClose}
    >
      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmitWaste}>
        <AdminSelect label="Raw material" value={wasteForm.rawMaterialId} onChange={(rawMaterialId) => { onWasteFormChange((current) => ({ ...current, rawMaterialId, batchId: "" })); onSelectRawMaterial(rawMaterialId); }} options={[{ value: "", label: "Select raw material" }, ...summaries.map((summary) => ({ value: summary.rawMaterialId, label: summary.name }))]} />
        <AdminSelect label="Batch" value={wasteForm.batchId} onChange={(batchId) => onWasteFormChange((current) => ({ ...current, batchId }))} options={[{ value: "", label: "Select batch" }, ...batches.map((batch) => ({ value: batch.id, label: `${batch.id.slice(0, 8)} · remaining ${formatQuantity(batch.remainingQuantity)}` }))]} />
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
        <AdminSelect label="Reason code" value={wasteForm.reasonCode} onChange={(reasonCode) => onWasteFormChange((current) => ({ ...current, reasonCode }))} options={[...INVENTORY_WASTE_REASON_OPTIONS.map((option) => ({ value: option.value, label: option.label }))]} />
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
          <button type="submit" disabled={submitting} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white">
            Record Waste
          </button>
        </ModalActions>
      </form>
    </InventoryModal>
  );
}
