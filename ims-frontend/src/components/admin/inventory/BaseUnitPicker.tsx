"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import AdminSelect from "@/components/admin/AdminSelect";
import { formatUnit } from "@/lib/units";
import { createInventoryUnit, type InventoryUnit } from "@/lib/inventory";
import { InventoryField, inventoryInputClasses } from "./InventoryField";
import styles from "./InventoryModal.module.css";

type Props = {
  units: InventoryUnit[];
  value: string;
  required?: boolean;
  disabled?: boolean;
  describedBy?: string;
  rawMaterialId?: string;
  onChange: (id: string) => void;
  onUnitCreated: (unit: InventoryUnit) => void;
  onSavingChange: (saving: boolean) => void;
};

export default function BaseUnitPicker({ units, value, required, disabled, describedBy, rawMaterialId, onChange, onUnitCreated, onSavingChange }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [dimension, setDimension] = useState<InventoryUnit["dimension"]>("COUNT");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveUnit() {
    if (saving) return;
    if (!name.trim() || !/^[A-Za-z][A-Za-z0-9_-]{0,19}$/.test(code.trim())) {
      setError("Enter a unit name and an abbreviation starting with a letter (letters, numbers, hyphens, or underscores only).");
      return;
    }
    setSaving(true);
    onSavingChange(true);
    setError(null);
    try {
      const unit = await createInventoryUnit({ name: name.trim(), code: code.trim(), dimension }, rawMaterialId);
      onUnitCreated(unit);
      onChange(unit.id);
      setOpen(false);
      setName("");
      setCode("");
      setDimension("COUNT");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not create the unit.");
    } finally { setSaving(false); onSavingChange(false); }
  }

  return <div>
    <AdminSelect label="Base unit" required={required} disabled={disabled || saving} describedBy={describedBy} value={value} onChange={onChange}
      options={[{ value: "", label: "Select unit" }, ...units.map((unit) => ({ value: unit.id, label: `${formatUnit(unit.name)} (${formatUnit(unit.code)})` }))]} />
    <button type="button" className={styles.customUnitToggle} disabled={disabled || saving} aria-expanded={open}
      onClick={() => { setOpen(!open); setError(null); }}><Plus size={14} aria-hidden="true" />Create custom unit</button>
    {open && <fieldset className={styles.customUnitFields} disabled={disabled || saving} onKeyDown={(event) => {
      if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
        event.preventDefault();
        void saveUnit();
      }
    }}>
      <legend>New unit</legend>
      <p>Save a unit for your store and select it for this material.</p>
      <InventoryField htmlFor="custom-unit-name" label="Unit name">
        <input id="custom-unit-name" autoFocus maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. Sachet" className={inventoryInputClasses} />
      </InventoryField>
      <InventoryField htmlFor="custom-unit-code" label="Abbreviation">
        <input id="custom-unit-code" maxLength={20} value={code} onChange={(event) => setCode(event.target.value)} placeholder="Ex. SACHET" className={inventoryInputClasses} />
      </InventoryField>
      <AdminSelect label="Unit type" value={dimension} disabled={disabled || saving} onChange={(value) => setDimension(value as InventoryUnit["dimension"])} options={[
        { value: "COUNT", label: "Count" }, { value: "PACKAGE", label: "Package" }, { value: "MASS", label: "Weight" }, { value: "VOLUME", label: "Volume" },
      ]} />
      {error && <p role="alert" className={styles.customUnitError}>{error}</p>}
      <div className={styles.customUnitActions}>
        <button type="button" disabled={saving} onClick={() => { setOpen(false); setError(null); }}>Cancel</button>
        <button type="button" disabled={saving} onClick={() => void saveUnit()}>{saving ? "Saving..." : "Save unit"}</button>
      </div>
    </fieldset>}
  </div>;
}
