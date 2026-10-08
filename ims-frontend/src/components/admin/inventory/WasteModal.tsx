"use client";
import AdminSelect from "@/components/admin/AdminSelect";
import { ClipboardMinus } from "lucide-react";
import styles from "./InventoryModal.module.css";

import { useEffect, useState, type FormEvent } from "react";
import InventoryValidationField from "./InventoryValidationField";
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
  | "delete-material"
  | "delete-draft";

type WasteFormState = {
  rawMaterialId: string;
  batchId: string;
  quantity: string;
  reasonCode: string;
  note: string;
};

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
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [previousPanel, setPreviousPanel] = useState(activePanel);
  if (previousPanel !== activePanel) {
    setPreviousPanel(activePanel);
    setValidationAttempted(false);
  }
  const selectedBatch = batches.find(batch => batch.id === wasteForm.batchId && batch.rawMaterialId === wasteForm.rawMaterialId);
  const todayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const datePart = (name: string) => todayParts.find(part => part.type === name)?.value;
  const today = `${datePart("year")}-${datePart("month")}-${datePart("day")}`;
  const selectedBatchExpired = Boolean(selectedBatch?.expirationDate && selectedBatch.expirationDate.slice(0, 10) < today);
  const selectedBatchId = selectedBatch?.id;
  const remainingQuantity = selectedBatch?.remainingQuantity;

  useEffect(() => {
    if (activePanel !== "waste" || !selectedBatchExpired || !selectedBatchId || !remainingQuantity) return;
    onWasteFormChange(current => current.batchId === selectedBatchId
      ? { ...current, quantity: remainingQuantity, reasonCode: "EXPIRED" }
      : current);
  }, [activePanel, selectedBatchExpired, selectedBatchId, remainingQuantity, onWasteFormChange]);

  const invalidExpiredReason = Boolean(selectedBatch && !selectedBatchExpired && wasteForm.reasonCode === "EXPIRED");
  const expiryReasonError = selectedBatch?.expirationDate
    ? `Selected batch is not expired according to its stock-run expiration date (${selectedBatch.expirationDate.slice(0, 10)}). Choose another reason code.`
    : "Selected batch has no stock-run expiration date, so it cannot be labeled as expired. Choose another reason code.";
  const errors = {
    material: !summaries.some(summary => summary.rawMaterialId === wasteForm.rawMaterialId) ? "Select a raw material." : undefined,
    batch: !selectedBatch ? "Select a batch for this raw material." : undefined,
    quantity: !wasteForm.quantity.trim() ? "Quantity is required." : !Number.isFinite(Number(wasteForm.quantity)) || Number(wasteForm.quantity) < 0.0001
      ? "Enter a quantity of at least 0.0001."
      : selectedBatch && Number(wasteForm.quantity) > Number(selectedBatch.remainingQuantity) ? "Quantity cannot exceed the batch's remaining stock." : undefined,
    reason: invalidExpiredReason ? expiryReasonError : !INVENTORY_WASTE_REASON_OPTIONS.some(option => option.value === wasteForm.reasonCode) ? "Select a reason for the waste." : undefined,
  };
  if (activePanel !== "waste") return null;

  return (
    <InventoryModal
      professional
      panelClassName="wasteDialog"
      bodyClassName="wasteBody"
      title="Record Waste"
      description="Track wasted stock and keep batch balances accurate."
      onClose={onClose}
    >
      <form noValidate className={`${styles.wasteForm} grid md:grid-cols-2`} onSubmit={(event) => {
        event.preventDefault();
        setValidationAttempted(true);
        if (Object.values(errors).some(Boolean)) return;
        onSubmitWaste(event);
      }}>
        <div className={styles.materialIntro}>
          <span className={styles.materialIntroIcon}><ClipboardMinus size={22} aria-hidden="true" /></span>
          <div><strong>Waste details</strong><p>Select the affected batch, quantity, and reason.</p></div>
          <span className={styles.materialRequiredNote}>* Required</span>
        </div>
        <InventoryValidationField error={validationAttempted ? errors.material : undefined}>
        <AdminSelect searchable required label="Raw material" value={wasteForm.rawMaterialId} onChange={(rawMaterialId) => { onWasteFormChange((current) => ({ ...current, rawMaterialId, batchId: "", quantity: "" })); onSelectRawMaterial(rawMaterialId); }} options={[{ value: "", label: "Select raw material" }, ...summaries.map((summary) => ({ value: summary.rawMaterialId, label: summary.name }))]} />
        </InventoryValidationField>
        <InventoryValidationField error={validationAttempted ? errors.batch : undefined}>
        <AdminSelect searchable required label="Batch" value={wasteForm.batchId} onChange={(batchId) => onWasteFormChange((current) => ({ ...current, batchId, quantity: "" }))} options={[{ value: "", label: "Select batch" }, ...batches.map((batch) => ({ value: batch.id, label: `${(batch.reference ?? batch.id.slice(0, 8))} · remaining ${formatQuantity(batch.remainingQuantity)}` }))]} />
        </InventoryValidationField>
        <InventoryValidationField error={validationAttempted ? errors.quantity : undefined}>
        <InventoryField htmlFor="waste-quantity" label="Quantity" required>
          <input
            id="waste-quantity"
            disabled={selectedBatchExpired}
            aria-describedby={selectedBatchExpired ? "waste-expiry-note" : undefined}
            required
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
          {selectedBatchExpired && <p id="waste-expiry-note" className="mt-2 break-words text-xs leading-relaxed text-slate-600">This batch is expired. Its full remaining stock has been filled in for disposal.</p>}
        </InventoryField>
        </InventoryValidationField>
        <InventoryValidationField error={validationAttempted || invalidExpiredReason ? errors.reason : undefined}>
        <AdminSelect searchable required label="Reason code" value={wasteForm.reasonCode} onChange={(reasonCode) => onWasteFormChange((current) => ({ ...current, reasonCode }))} options={[...INVENTORY_WASTE_REASON_OPTIONS.map((option) => ({ value: option.value, label: option.label }))]} />
        </InventoryValidationField>
        <div className="md:col-span-2">
          <InventoryField htmlFor="waste-note" label="Note (optional)">
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
        <div className={styles.wasteActions}>
          <button type="submit" disabled={submitting}>
            <ClipboardMinus size={16} aria-hidden="true" />{submitting ? "Recording…" : "Record Waste"}
          </button>
        </div>
      </form>
    </InventoryModal>
  );
}
