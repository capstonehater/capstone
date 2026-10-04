"use client";

import StyledSelect from "@/components/admin/StyledSelect";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, PackagePlus, ClipboardList, Trash2 } from "lucide-react";
import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import { createRawMaterial, createStockRun, createInventoryWaste, fetchUnits, fetchInventorySummary, fetchRawMaterialBatches, type InventoryUnit, type InventorySummaryItem, type StockBatch } from "@/lib/inventory";
import { getDefaultWasteReasonCode, INVENTORY_WASTE_REASON_OPTIONS } from "@/lib/inventory-reason-options";
import { useInventoryStore } from "@/store/inventoryStore";
import styles from "./MaterialActionPage.module.css";

type Action = "add" | "stock-run" | "waste";
const details = {
  add: { icon: PackagePlus, heading: "Material details", description: "Give your material a clear name and a unique stock code.", help: "Set up your material", note: "The base unit is used to measure stock and record movements. The reorder point helps identify when stock needs replenishing.", button: "Create Material" },
  "stock-run": { icon: ClipboardList, heading: "Draft details", description: "Start a receiving draft for your next stock delivery.", help: "Plan, then receive", note: "Creating a draft does not change inventory. After saving, open the draft in Stock Runs to add incoming items and post the delivery.", button: "Create Draft" },
  waste: { icon: Trash2, heading: "Waste details", description: "Choose a material and batch, then record what was lost.", help: "Keep stock accurate", note: "Waste is deducted from the selected batch. Check the quantity and reason before saving. Add a note to give your team more context.", button: "Record Waste" },
};

export default function MaterialActionPage({ action }: { action: Action }) {
  const info = details[action];
  const Icon = info.icon;
  const selectedMaterial = useInventoryStore(state => state.selectedRawMaterialId);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [materials, setMaterials] = useState<InventorySummaryItem[]>([]);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(action !== "stock-run");
  const [batchLoading, setBatchLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [success, setSuccess] = useState("");
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unitId, setUnitId] = useState("");
  const [reorderPoint, setReorderPoint] = useState("0");
  const [note, setNote] = useState("");
  const [materialId, setMaterialId] = useState(action === "waste" ? selectedMaterial ?? "" : "");
  const [batchId, setBatchId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<string>(getDefaultWasteReasonCode());
  const [draftId, setDraftId] = useState("");

  useEffect(() => {
    let active = true;
    if (action === "stock-run") return;
    async function load() {
      setLoading(true); setLoadError("");
      try {
        if (action === "add") { const rows = await fetchUnits(); if (active) setUnits(rows); }
        else { const rows = await fetchInventorySummary({}); if (active) setMaterials(rows.filter(row => row.isActive)); }
      } catch (e) { if (active) setLoadError(e instanceof Error ? e.message : "Unable to load form options."); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [action, revision]);

  useEffect(() => {
    if (action !== "waste" || !materialId) return;
    let active = true;
    setBatchLoading(true); setBatches([]); setBatchId(""); setError("");
    fetchRawMaterialBatches(materialId).then(rows => { if (active) setBatches(rows.filter(row => Number(row.remainingQuantity) > 0)); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load batches."); })
      .finally(() => { if (active) setBatchLoading(false); });
    return () => { active = false; };
  }, [action, materialId, revision]);

  const batch = batches.find(row => row.id === batchId);
  const material = materials.find(row => row.rawMaterialId === materialId);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || success) return;
    setError("");
    if (action !== "waste" && !name.trim()) { setError("Enter a name before saving."); return; }
    if (action === "add" && (!sku.trim() || !unitId || !Number.isFinite(Number(reorderPoint)) || Number(reorderPoint) < 0)) { setError("Enter a SKU, select a base unit, and provide a valid reorder point."); return; }
    if (action === "waste" && (!material || !batch || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0 || Number(quantity) > Number(batch.remainingQuantity))) { setError("Select a batch and enter a quantity within its remaining stock."); return; }
    busy.current = true; setSaving(true);
    try {
      if (action === "add") {
        const created = await createRawMaterial({ name: name.trim(), sku: sku.trim(), unitId, reorderPoint: Number(reorderPoint) });
        useInventoryStore.getState().setSelectedRawMaterialId(created.id);
        setSuccess(`${created.name} was added to your materials.`);
      } else if (action === "stock-run") {
        const created = await createStockRun({ name: name.trim(), notes: note.trim() || undefined });
        setDraftId(created.id); setSuccess(`${created.name} is ready. Continue to add items to your draft.`);
      } else {
        await createInventoryWaste({ rawMaterialId: materialId, batchId, quantity: Number(quantity), reasonCode: reason, note: note.trim() || undefined });
        setSuccess("Waste recorded. The selected batch balance has been updated.");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save. Please try again."); }
    finally { busy.current = false; setSaving(false); }
  }

  return <AdminDashboardLayout>
    <div className={styles.page}>
      <Link className={styles.back} href="/admin/inventory/materials"><ArrowLeft size={16} />Back to Materials</Link>
      {success ? <section className={styles.success} role="status"><CheckCircle2 size={32} /><h2>{action === "waste" ? "Waste recorded" : action === "add" ? "Material created" : "Draft created"}</h2><p>{success}</p><Link className={styles.primary} href={draftId ? `/admin/inventory/stock-runs?draft=${encodeURIComponent(draftId)}` : "/admin/inventory/materials"}>{draftId ? "Continue to Draft" : "Return to Materials"}</Link></section> : <div className={styles.layout}>
        <section className={styles.card}>
          <div className={styles.cardHeading}><span className={styles.icon}><Icon size={22} /></span><div><h2>{info.heading}</h2><p>{info.description}</p></div></div>
          <form onSubmit={submit}>
            {loadError && <div className={styles.error} role="alert">{loadError}<button type="button" onClick={() => setRevision(value => value + 1)}>Retry loading</button></div>}
            {error && <div className={styles.error} role="alert">{error}<button type="button" onClick={() => setRevision(value => value + 1)}>Reload options</button></div>}
            {loading && <p role="status" className={styles.loading}>Loading form options...</p>}
            <fieldset disabled={loading || saving || !!loadError} className={styles.fields}>
              {action !== "waste" && <label className={action === "stock-run" ? styles.full : undefined}>{action === "add" ? "Raw material name" : "Draft name"}<input required value={name} onChange={e => setName(e.target.value)} placeholder={action === "add" ? "e.g. Evaporated Milk" : "e.g. Monday Produce Run"} /></label>}
              {action === "add" && <>
                <label>SKU<input required value={sku} onChange={e => setSku(e.target.value)} placeholder="e.g. RM-EVAP-001" /><small>Use a unique code for this material.</small></label>
                <label>Base unit<StyledSelect aria-label="Base unit" required value={unitId} onValueChange={value => setUnitId(value)}><option value="">Select a unit</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.name} ({unit.code})</option>)}</StyledSelect></label>
                <label>Reorder point<input required type="number" min="0" step="0.0001" value={reorderPoint} onChange={e => setReorderPoint(e.target.value)} /><small>Measured in the selected base unit.</small></label>
              </>}
              {action === "waste" && <>
                <label>Raw material<StyledSelect aria-label="Raw material" required value={materialId} onValueChange={value => { setMaterialId(value); setBatchId(""); setBatches([]); }}><option value="">Select a material</option>{materials.map(row => <option key={row.rawMaterialId} value={row.rawMaterialId}>{row.name} ({row.unit.code})</option>)}</StyledSelect></label>
                <label>Batch<StyledSelect aria-label="Batch" required disabled={!materialId || batchLoading} value={batchId} onValueChange={value => setBatchId(value)}><option value="">{batchLoading ? "Loading batches..." : "Select a batch"}</option>{batches.map(row => <option key={row.id} value={row.id}>{row.id.slice(0, 8)} - {Number(row.remainingQuantity).toLocaleString()} remaining</option>)}</StyledSelect>{materialId && !batchLoading && !batches.length && <small>No batches with remaining stock. Choose another material.</small>}</label>
                <label>Quantity{material && ` (${material.unit.code})`}<input required type="number" min="0.0001" step="0.0001" max={batch ? Number(batch.remainingQuantity) : undefined} value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Enter waste quantity" />{batch && <small>Available: {Number(batch.remainingQuantity).toLocaleString()} {material?.unit.code}</small>}</label>
                <label>Reason<StyledSelect aria-label="Reason" required value={reason} onValueChange={value => setReason(value)}>{INVENTORY_WASTE_REASON_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</StyledSelect></label>
              </>}
              {action !== "add" && <label className={styles.full}>Notes <span className={styles.optional}>Optional</span><textarea rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder={action === "waste" ? "Add context for this waste entry." : "Describe the delivery or items you plan to receive."} /></label>}
            </fieldset>
            <div className={styles.actions}><Link className={styles.cancel} href="/admin/inventory/materials">Cancel</Link><button className={styles.primary} type="submit" disabled={saving || loading || !!loadError || (action === "waste" && (batchLoading || !batch))}>{saving ? "Saving..." : info.button}</button></div>
          </form>
        </section>
        <aside className={styles.guide}><span className={styles.eyebrow}>MATERIALS / {action === "stock-run" ? "RECEIVING" : action === "waste" ? "WASTE" : "SETUP"}</span><h2>{info.help}</h2><p>{info.note}</p><div className={styles.tip}>{action === "add" ? "Next step: receive stock through a stock-run draft." : action === "stock-run" ? "Step 1: Create draft. Step 2: Add items and post." : "Record quantities in the material's base unit."}</div></aside>
      </div>}
    </div>
  </AdminDashboardLayout>;
}
