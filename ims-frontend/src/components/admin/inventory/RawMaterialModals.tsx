"use client";

import { formatUnit } from "@/lib/units";
import AdminSelect from "@/components/admin/AdminSelect";
import modalStyles from "./InventoryModal.module.css";
import { LockKeyhole, PackagePlus, Plus } from "lucide-react";

import { useState, type FormEvent } from "react";
import {
  InventoryField,
  inventoryInputClasses,
} from "@/components/admin/inventory/InventoryField";
import InventoryModal from "@/components/admin/inventory/InventoryModal";
import type { InventoryUnit, RawMaterial } from "@/lib/inventory";

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

type MaterialFormState = {
  name: string;
  sku: string;
  unitId: string;
  reorderPoint: string;
};

function makeMaterialSku(name: string, existingSkus: string[]) {
  const words = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  const stem = words.length > 1
    ? words.map((word) => word[0]).join("")
    : (words[0] ?? "MAT").slice(0, 4);
  const prefix = `RM-${stem || "MAT"}-`;
  const used = new Set(existingSkus.map((sku) => sku.toUpperCase()));
  let sequence = 1;
  while (used.has(`${prefix}${String(sequence).padStart(3, "0")}`)) sequence += 1;
  return `${prefix}${String(sequence).padStart(3, "0")}`;
}

function ModalActions({ children }: { children: React.ReactNode }) {
  return <div className="md:col-span-2 flex justify-end gap-3 pt-2">{children}</div>;
}

type RawMaterialModalsProps = {
  activePanel: PanelMode;
  submitting: boolean;
  units: InventoryUnit[];
  selectedMaterial: RawMaterial | null;
  existingSkus: string[];
  materialForm: MaterialFormState;
  onClose: () => void;
  onMaterialFormChange: (next: MaterialFormState | ((current: MaterialFormState) => MaterialFormState)) => void;
  onCreateMaterial: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateMaterial: (event: FormEvent<HTMLFormElement>) => void;
  onArchiveMaterial: () => void;
  onDeleteMaterial: () => void;
};

export default function RawMaterialModals({
  activePanel,
  submitting,
  units,
  selectedMaterial,
  existingSkus,
  materialForm,
  onClose,
  onMaterialFormChange,
  onCreateMaterial,
  onUpdateMaterial,
  onArchiveMaterial,
  onDeleteMaterial,
}: RawMaterialModalsProps) {
  const [previousPanel, setPreviousPanel] = useState(activePanel);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [reorderInputError, setReorderInputError] = useState<string | null>(null);
  if (previousPanel !== activePanel) {
    setPreviousPanel(activePanel);
    setValidationAttempted(false);
    setReorderInputError(null);
  }
  const nameError = validationAttempted && !materialForm.name.trim() ? "Raw material name is required." : undefined;
  const unitError = validationAttempted && !units.some((unit) => unit.id === materialForm.unitId) ? "Select a base unit." : undefined;
  const reorderError = reorderInputError || (validationAttempted
    ? !materialForm.reorderPoint.trim() ? "Reorder point is required." : !/^[0-9]{1,5}$/.test(materialForm.reorderPoint) ? "Enter a whole number from 0 to 99999." : undefined
    : undefined);
  const invalidClasses = " !border-red-600 !bg-red-50 focus:!border-red-600 focus:!ring-red-600/15";
  return (
    <>
      {activePanel === "create-material" ? (
        <InventoryModal
          professional
          panelClassName="rawMaterialCreateDialog"
          bodyClassName="rawMaterialCreateBody"
          title="Add Raw Material"
          description="Set up a material for your inventory."
          onClose={onClose}
        >
          <form noValidate className={`${modalStyles.rawMaterialCreateForm} grid gap-4 md:grid-cols-2`} onSubmit={(event) => {
            event.preventDefault();
            setValidationAttempted(true);
            if (!materialForm.name.trim() || !units.some((unit) => unit.id === materialForm.unitId) || !/^[0-9]{1,5}$/.test(materialForm.reorderPoint) || reorderInputError) return;
            onCreateMaterial(event);
          }}>
            <div className={modalStyles.materialIntro}>
              <span className={modalStyles.materialIntroIcon}><PackagePlus size={22} aria-hidden="true" /></span>
              <div><strong>Material details</strong><p>Choose a name, stock unit, and reorder level.</p></div>
              <span className={modalStyles.materialRequiredNote}>* Required</span>
            </div>
            <InventoryField htmlFor="material-name" label="Raw material name" required>
              <input
                id="material-name"
                required
                aria-invalid={!!nameError}
                aria-describedby={nameError ? "material-name-error" : undefined}
                value={materialForm.name}
                onChange={(event) =>
                  onMaterialFormChange((current) => ({
                    ...current,
                    name: event.target.value,
                    sku: makeMaterialSku(event.target.value, existingSkus),
                  }))
                }
                placeholder="Ex. Evaporated Milk"
                className={`${inventoryInputClasses}${nameError ? invalidClasses : ""}`}
              />
              {nameError && <p id="material-name-error" role="alert" className="text-sm text-red-600">{nameError}</p>}
            </InventoryField>
            <InventoryField htmlFor="material-sku" label="SKU">
              <input
                id="material-sku"
                value={materialForm.sku}
                disabled
                aria-describedby="material-sku-hint"
                placeholder="Generated from material name"
                className={inventoryInputClasses}
              />
              <p id="material-sku-hint" className={modalStyles.materialSkuHint}><LockKeyhole size={13} aria-hidden="true" /> Automatically generated</p>
            </InventoryField>
            <div className={unitError ? "rounded-lg border border-red-600 bg-red-50 p-1" : undefined}>
              <AdminSelect label="Base unit" required describedBy={unitError ? "material-unit-error" : undefined} value={materialForm.unitId} onChange={(unitId) => onMaterialFormChange((current) => ({ ...current, unitId }))} options={[{ value: "", label: "Select unit" }, ...units.map((unit) => ({ value: unit.id, label: `${formatUnit(unit.name)} (${formatUnit(unit.code)})` }))]} />
              {unitError && <p id="material-unit-error" role="alert" className="mt-2 text-sm text-red-600">{unitError}</p>}
            </div>
            <InventoryField htmlFor="material-reorder" label="Reorder point" required>
              <input
                id="material-reorder"
                required
                aria-invalid={!!reorderError}
                aria-describedby={reorderError ? "material-reorder-error" : undefined}
                type="text"
                inputMode="numeric"
                pattern="[0-9]{1,5}"
                maxLength={5}
                value={materialForm.reorderPoint}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!/^[0-9]{0,5}$/.test(value)) {
                    setReorderInputError("Enter a whole number from 0 to 99999.");
                    return;
                  }
                  setReorderInputError(null);
                  onMaterialFormChange((current) => ({ ...current, reorderPoint: value }));
                }}
                placeholder="Ex. 5"
                className={`${inventoryInputClasses}${reorderError ? invalidClasses : ""}`}
              />
              {reorderError && <p id="material-reorder-error" role="alert" className="text-sm text-red-600">{reorderError}</p>}
            </InventoryField>
            <div className={modalStyles.materialFormActions}>
              <button type="submit" disabled={submitting}>
                <Plus size={16} aria-hidden="true" />{submitting ? "Creating…" : "Create Material"}
              </button>
            </div>
          </form>
        </InventoryModal>
      ) : null}

      {activePanel === "edit-material" && selectedMaterial ? (
        <InventoryModal
          professional
          title={`Edit ${selectedMaterial.name}`}
          description="Update metadata without changing the existing stock or ledger history."
          onClose={onClose}
        >
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onUpdateMaterial}>
            <InventoryField htmlFor="edit-material-name" label="Raw material name">
              <input
                id="edit-material-name"
                value={materialForm.name}
                onChange={(event) =>
                  onMaterialFormChange((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Evaporated Milk"
                className={inventoryInputClasses}
              />
            </InventoryField>
            <InventoryField htmlFor="edit-material-sku" label="SKU">
              <input
                id="edit-material-sku"
                value={materialForm.sku}
                disabled
                placeholder="RM-EVAP-001"
                className={inventoryInputClasses}
              />
            </InventoryField>
            <AdminSelect label="Base unit" value={materialForm.unitId} onChange={(unitId) => onMaterialFormChange((current) => ({ ...current, unitId }))} options={[{ value: "", label: "Select unit" }, ...units.map((unit) => ({ value: unit.id, label: `${formatUnit(unit.name)} (${formatUnit(unit.code)})` }))]} />
            <InventoryField htmlFor="edit-material-reorder" label="Reorder point">
              <input
                id="edit-material-reorder"
                type="number"
                step="0.0001"
                min="0"
                value={materialForm.reorderPoint}
                onChange={(event) =>
                  onMaterialFormChange((current) => ({
                    ...current,
                    reorderPoint: event.target.value,
                  }))
                }
                placeholder="5"
                className={inventoryInputClasses}
              />
            </InventoryField>
            <ModalActions>
              <button type="submit" disabled={submitting} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white">
                Save Changes
              </button>
            </ModalActions>
          </form>
        </InventoryModal>
      ) : null}

      {activePanel === "archive-material" && selectedMaterial ? (
        <InventoryModal
          professional
          title={selectedMaterial.isActive ? "Archive Raw Material" : "Unarchive Raw Material"}
          description={selectedMaterial.isActive ? "This hides the material from the default summary view but keeps all batches and ledger history intact." : "Restore this material to active inventory."}
          onClose={onClose}
        >
          <div className="space-y-5">
            <div className={`rounded-2xl border px-4 py-4 text-sm ${selectedMaterial.isActive ? "border-rose-200 bg-rose-50 text-rose-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
              You are {selectedMaterial.isActive ? "archiving" : "unarchiving"} <span className="font-semibold">{selectedMaterial.name}</span> (
              {selectedMaterial.sku}).
            </div>
            <p className="text-sm text-slate-600">
              {selectedMaterial.isActive ? "Use this when the raw material should stop appearing in normal admin workflows. This does not delete history or existing batches." : "The material will appear in active inventory again, with its existing batches and history."}
            </p>
            <ModalActions>
              <button type="button" onClick={onArchiveMaterial} disabled={submitting} className={selectedMaterial.isActive ? modalStyles.archiveAction : modalStyles.unarchiveAction}>
                {selectedMaterial.isActive ? "Archive Material" : "Unarchive Material"}
              </button>
            </ModalActions>
          </div>
        </InventoryModal>
      ) : null}
      {activePanel === "delete-material" && selectedMaterial ? (
        <InventoryModal professional title="Delete Raw Material" description="Permanently remove this raw material while preserving its historical records." onClose={onClose}>
          <div className="space-y-5">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
              Delete <span className="font-semibold">{selectedMaterial.name}</span> ({selectedMaterial.sku})? This cannot be undone.
            </div>
            <p className="text-sm text-slate-600">Stock runs, batches, transactions, and daily snapshots retain this material’s identity and history. Remove the material from recipes and draft stock runs first.</p>
            <ModalActions>
              <button type="button" onClick={onClose} disabled={submitting}>Cancel</button>
              <button type="button" onClick={onDeleteMaterial} disabled={submitting} className={modalStyles.archiveAction}>Delete Material</button>
            </ModalActions>
          </div>
        </InventoryModal>
      ) : null}
    </>
  );
}
