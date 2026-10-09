"use client";

import BaseUnitPicker from "./BaseUnitPicker";
import modalStyles from "./InventoryModal.module.css";
import { LockKeyhole, PackagePlus, Plus } from "lucide-react";

import { useState, type FormEvent } from "react";
import {
  InventoryField,
  inventoryInputClasses,
} from "@/components/admin/inventory/InventoryField";
import InventoryModal from "@/components/admin/inventory/InventoryModal";
import type { InventoryUnit, RawMaterial } from "@/lib/inventory";
import { makeMaterialSku } from "@/lib/sku-generation";

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
  categoryIds: string[];
};

function ModalActions({ children }: { children: React.ReactNode }) {
  return <div className="md:col-span-2 flex justify-end gap-3 pt-2">{children}</div>;
}

type RawMaterialModalsProps = {
  activePanel: PanelMode;
  submitting: boolean;
  units: InventoryUnit[];
  onUnitCreated: (unit: InventoryUnit) => void;
  categories: { id: string; name: string }[];
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
  onUnitCreated,
  categories,
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
  const [unitSaving, setUnitSaving] = useState(false);
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
  const selectedCount = categories.filter((category) => materialForm.categoryIds.includes(category.id)).length;
  const allSelected = categories.length > 0 && selectedCount === categories.length;
  const categorySelection = (
    <fieldset className={modalStyles.materialCategories} disabled={submitting}>
      <legend>Product categories</legend>
      <p id="material-categories-hint">{activePanel === "edit-material"
        ? "Saved categories are already selected. Add or remove selections to update where this ingredient can be used."
        : "Only products in the selected categories can use this ingredient. Unchecked categories cannot use it."}</p>
      <div className={modalStyles.materialCategoryToolbar}>
        <label className={modalStyles.materialCategorySelectAll}>
          <input type="checkbox" checked={allSelected}
            ref={(input) => { if (input) input.indeterminate = selectedCount > 0 && !allSelected; }}
            disabled={!categories.length}
            onChange={(event) => onMaterialFormChange((current) => ({ ...current, categoryIds: event.target.checked ? categories.map((category) => category.id) : [] }))} />
          Select all
        </label>
        <span>{selectedCount} of {categories.length} selected</span>
      </div>
      <div className={modalStyles.materialCategoryGrid} aria-describedby="material-categories-hint">
        {categories.map((category) => (
          <label key={category.id} className={`${modalStyles.materialCategoryOption} ${materialForm.categoryIds.includes(category.id) ? modalStyles.materialCategorySelected : ""}`}>
            <input type="checkbox" checked={materialForm.categoryIds.includes(category.id)}
              onChange={(event) => onMaterialFormChange((current) => ({ ...current,
                categoryIds: event.target.checked ? [...current.categoryIds, category.id] : current.categoryIds.filter((id) => id !== category.id),
              }))} />
            <span>{category.name}</span>
          </label>
        ))}
      </div>
      {!categories.length && <p>No product categories available.</p>}
    </fieldset>
  );
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
            if (unitSaving) return;
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
              <BaseUnitPicker onSavingChange={setUnitSaving} units={units} onUnitCreated={onUnitCreated} required disabled={submitting} describedBy={unitError ? "material-unit-error" : undefined} value={materialForm.unitId} onChange={(unitId) => onMaterialFormChange((current) => ({ ...current, unitId }))} />
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
            {categorySelection}
            <div className={modalStyles.materialFormActions}>
              <button type="submit" disabled={submitting || unitSaving}>
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
          <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => { if (unitSaving) { event.preventDefault(); return; } onUpdateMaterial(event); }}>
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
            <BaseUnitPicker onSavingChange={setUnitSaving} units={units} onUnitCreated={onUnitCreated} rawMaterialId={selectedMaterial.id} disabled={submitting} value={materialForm.unitId} onChange={(unitId) => onMaterialFormChange((current) => ({ ...current, unitId }))} />
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
            {categorySelection}
            <ModalActions>
              <button type="submit" disabled={submitting || unitSaving} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white">
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
              <button type="button" onClick={onArchiveMaterial} disabled={submitting} className={selectedMaterial.isActive ? modalStyles.archiveBlackAction : modalStyles.unarchiveAction}>
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
