"use client";

import type { FormEvent } from "react";
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
  | "supplier-management"
  | "stock-run-create"
  | "stock-run-manage"
  | "adjustment"
  | "waste"
  | "archive-material"
  | "delete-draft";

type MaterialFormState = {
  name: string;
  sku: string;
  unitId: string;
  reorderPoint: string;
};

function ModalActions({ children }: { children: React.ReactNode }) {
  return <div className="md:col-span-2 flex justify-end gap-3 pt-2">{children}</div>;
}

type RawMaterialModalsProps = {
  activePanel: PanelMode;
  submitting: boolean;
  units: InventoryUnit[];
  selectedMaterial: RawMaterial | null;
  materialForm: MaterialFormState;
  onClose: () => void;
  onMaterialFormChange: (next: MaterialFormState | ((current: MaterialFormState) => MaterialFormState)) => void;
  onCreateMaterial: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateMaterial: (event: FormEvent<HTMLFormElement>) => void;
  onArchiveMaterial: () => void;
};

export default function RawMaterialModals({
  activePanel,
  submitting,
  units,
  selectedMaterial,
  materialForm,
  onClose,
  onMaterialFormChange,
  onCreateMaterial,
  onUpdateMaterial,
  onArchiveMaterial,
}: RawMaterialModalsProps) {
  return (
    <>
      {activePanel === "create-material" ? (
        <InventoryModal
          title="Add Raw Material"
          description="Create a new raw material record with clear labels before it enters the inventory flow."
          onClose={onClose}
        >
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onCreateMaterial}>
            <InventoryField htmlFor="material-name" label="Raw material name">
              <input
                id="material-name"
                value={materialForm.name}
                onChange={(event) =>
                  onMaterialFormChange((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Evaporated Milk"
                className={inventoryInputClasses}
              />
            </InventoryField>
            <InventoryField htmlFor="material-sku" label="SKU">
              <input
                id="material-sku"
                value={materialForm.sku}
                onChange={(event) =>
                  onMaterialFormChange((current) => ({ ...current, sku: event.target.value }))
                }
                placeholder="RM-EVAP-001"
                className={inventoryInputClasses}
              />
            </InventoryField>
            <InventoryField htmlFor="material-unit" label="Base unit">
              <select
                id="material-unit"
                value={materialForm.unitId}
                onChange={(event) =>
                  onMaterialFormChange((current) => ({ ...current, unitId: event.target.value }))
                }
                className={inventoryInputClasses}
              >
                <option value="">Select unit</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.code})
                  </option>
                ))}
              </select>
            </InventoryField>
            <InventoryField htmlFor="material-reorder" label="Reorder point">
              <input
                id="material-reorder"
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
              <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white">
                Create Material
              </button>
            </ModalActions>
          </form>
        </InventoryModal>
      ) : null}

      {activePanel === "edit-material" && selectedMaterial ? (
        <InventoryModal
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
                onChange={(event) =>
                  onMaterialFormChange((current) => ({ ...current, sku: event.target.value }))
                }
                placeholder="RM-EVAP-001"
                className={inventoryInputClasses}
              />
            </InventoryField>
            <InventoryField htmlFor="edit-material-unit" label="Base unit">
              <select
                id="edit-material-unit"
                value={materialForm.unitId}
                onChange={(event) =>
                  onMaterialFormChange((current) => ({ ...current, unitId: event.target.value }))
                }
                className={inventoryInputClasses}
              >
                <option value="">Select unit</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.code})
                  </option>
                ))}
              </select>
            </InventoryField>
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
              <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white">
                Save Changes
              </button>
            </ModalActions>
          </form>
        </InventoryModal>
      ) : null}

      {activePanel === "archive-material" && selectedMaterial ? (
        <InventoryModal
          title="Archive Raw Material"
          description="This hides the material from the default summary view but keeps all batches and ledger history intact."
          onClose={onClose}
        >
          <div className="space-y-5">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
              You are archiving <span className="font-semibold">{selectedMaterial.name}</span> (
              {selectedMaterial.sku}).
            </div>
            <p className="text-sm text-slate-600">
              Use this when the raw material should stop appearing in normal admin workflows. This
              does not delete history or existing batches.
            </p>
            <ModalActions>
              <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700">
                Cancel
              </button>
              <button type="button" onClick={onArchiveMaterial} disabled={submitting} className="rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white">
                Archive Material
              </button>
            </ModalActions>
          </div>
        </InventoryModal>
      ) : null}
    </>
  );
}
