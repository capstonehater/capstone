"use client";

import { useState, type FormEvent } from "react";
import useProductModalEscape from "./useProductModalEscape";
import AdminSelect from "@/components/admin/AdminSelect";
import ProductImagePicker from "./ProductImagePicker";
import { apiJsonFetch } from "@/lib/api";
import { Plus, Trash2, X } from "lucide-react";
import styles from "./ProductFormDialog.module.css";
import type { ProductCategory, ProductDetail, VariantFormInput } from "@/lib/products";
import { productFormErrors } from "@/lib/products/form-validation";

type Props = { mode: "create" | "edit"; open: boolean; categories: ProductCategory[]; product: ProductDetail | null; submitting: boolean; errorMessage?: string | null; fieldErrors?: Record<string, string[]>; onClose: () => void; onSubmit: (input: { imageUrl?: string | null; name: string; categoryId: string; isEnabled: boolean; initialVariants: VariantFormInput[] }) => Promise<void> };
const input = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500";
function generateVariantSku(productName: string, variantName: string): string {
  const words = productName.toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  const prefix = words.map(word => word[0]).join("");
  const suffix = variantName.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return prefix && suffix ? `${prefix}-${suffix}` : "";
}
function emptyVariant(): VariantFormInput { return { name: "", sku: "", price: "", isEnabled: true }; }

export default function ProductFormDialog(props: Props) {
  if (!props.open) return null;
  return <ProductFormDialogBody key={`${props.mode}:${props.product?.id ?? "new"}`} {...props} />;
}

function ProductFormDialogBody({ mode, categories, product, submitting, errorMessage, fieldErrors, onClose, onSubmit }: Omit<Props, "open">) {
  const [imageUrl, setImageUrl] = useState<string | null>(product?.imageUrl ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(product?.category.id ?? categories[0]?.id ?? "");
  const [isEnabled, setIsEnabled] = useState(product?.manualAvailability !== "DISABLED");
  const [variantDrafts, setVariants] = useState<VariantFormInput[]>([emptyVariant()]);
  const variants = variantDrafts.map(v => ({ ...v, sku: generateVariantSku(name, v.name) }));
  const [clientErrors, setClientErrors] = useState<string[]>([]);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [validationAttempted, setValidationAttempted] = useState(false);
  const validationErrors = productFormErrors(name, categoryId, categories.map(category => category.id), variants, mode === "create");
  const showError = (key: string) => fieldErrors?.[key]?.join(" ") || ((validationAttempted || touchedFields[key]) ? validationErrors[key] : undefined);
  const fieldClass = (key: string) => `${input}${showError(key) ? ` ${styles.invalidInput}` : ""}`;
  const fieldMessage = (key: string) => showError(key) ? <p id={`product-error-${key}`} role="alert" className={styles.fieldError}>{showError(key)}</p> : null;
  const modalRef = useProductModalEscape(true, submitting || uploading, onClose);

  function validate() {
    setValidationAttempted(true);
    return Object.keys(validationErrors).length === 0;
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading || submitting || !validate()) return;
    setUploading(true);
    try {
      let savedImageUrl = imageUrl;
      if (imageFile) {
        const body = new FormData(); body.append("image", imageFile);
        const result = await apiJsonFetch<{ imageUrl: string }>(mode === "create" ? "/admin/product-images" : "/admin/product-images/replacement", { method: "POST", body });
        savedImageUrl = result.imageUrl;
        setImageUrl(savedImageUrl); setImageFile(null);
      }
      await onSubmit({ imageUrl: savedImageUrl, name: name.trim(), categoryId, isEnabled, initialVariants: mode === "create" ? variants.map(v => ({ ...v, name: v.name.trim(), sku: v.sku.trim(), price: v.price.trim() })) : [] });
    } catch (error) {
      setClientErrors([error instanceof Error ? error.message : "Failed to upload product image."]);
    } finally { setUploading(false); }
  }
  const updateVariant = (index: number, patch: Partial<VariantFormInput>) => setVariants(current => current.map((v,i)=>i===index ? {...v,...patch} : v));
  return <div ref={modalRef} data-product-modal className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-[5px] p-4">
    <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
      <header className={`${styles.dialogHeader} bg-[var(--modal-header-background)] flex shrink-0 items-center justify-between border-b border-slate-200`}><div><h2 className={styles.dialogTitle}>{mode === "create" ? "Add Product" : "Edit Product"}</h2><p className={styles.dialogDescription}>{mode === "create" ? "Create a new product, set availability, and organize category details." : "Update product information, availability, and details."}</p></div><button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white p-0 text-slate-600 hover:border-slate-400 hover:bg-slate-50"><X className="h-5 w-5" /></button></header>
      <form noValidate onSubmit={handleSubmit} onBlurCapture={event => {
        const target = event.target as HTMLElement;
        const key = target.dataset.validationField || (target.id === "product-form-category" ? "categoryId" : undefined);
        if (key) setTouchedFields(current => ({ ...current, [key]: true }));
      }} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {(clientErrors.length || errorMessage) ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700"><ul>{clientErrors.map(e=><li key={e}>{e}</li>)}{errorMessage ? <li>{errorMessage}</li> : null}{fieldErrors ? Object.entries(fieldErrors).map(([k,v])=><li key={k}>{k}: {v.join(", ")}</li>) : null}</ul></div> : null}
        <section className="rounded-lg border border-slate-200 p-4"><h3 className="text-sm font-bold text-slate-900">Product Information</h3><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-700">Product Name <span className={styles.requiredMark} aria-hidden="true">*</span><input data-validation-field="name" aria-invalid={!!showError("name")} aria-describedby={showError("name") ? "product-error-name" : undefined} value={name} onChange={e=>setName(e.target.value)} className={`${fieldClass("name")} mt-1`} placeholder="Ex. Spanish Latte" />{fieldMessage("name")}</label><div className={`${styles.categoryField} ${showError("categoryId") ? styles.invalidSelect : ""}`}><label htmlFor="product-form-category" className={styles.categoryLabel}>Category <span className={styles.requiredMark} aria-hidden="true">*</span></label><AdminSelect describedBy={showError("categoryId") ? "product-error-categoryId" : undefined} id="product-form-category" hideLabel label="Category" value={categoryId} onChange={setCategoryId} options={[{ value: "", label: "Select category" }, ...categories.map(c => ({ value: c.id, label: c.name }))]} />{fieldMessage("categoryId")}</div></div>{mode === "create" ? <div className="mt-4 flex items-center justify-between rounded-md bg-slate-50 px-3 py-3"><div><p className="text-xs font-semibold text-slate-800">POS Availability</p><p className="text-xs text-slate-500">{isEnabled ? "Enabled" : "Disabled"}</p></div><button type="button" role="switch" aria-label="POS availability" aria-checked={isEnabled} onClick={()=>setIsEnabled(v=>!v)} className={styles.switch}><span className={styles.switchThumb} /></button></div> : null}</section>
        <ProductImagePicker imageUrl={imageUrl} file={imageFile} disabled={submitting || uploading} onChange={(file, remove) => { setImageFile(file); if (remove) setImageUrl(null); }} />
        {mode === "create" ? <section className="mt-4 rounded-lg border border-slate-200 p-4"><div className="flex items-start justify-between"><div><h3 className="text-sm font-bold text-slate-900">Product Setup</h3><p className="mt-1 text-xs text-slate-500">Add the initial variant required to sell this product.</p></div><button type="button" onClick={()=>setVariants(v=>[...v,emptyVariant()])} className={`${styles.primary} ${styles.addVariant}`}><Plus className="h-3.5 w-3.5" /> Add Variant</button></div>{variants.map((v,i)=><div key={i} className={`mt-3 grid gap-3 rounded-md bg-slate-50 p-3 ${styles.variantRow}`}><div className={styles.variantName}><input data-validation-field={`initialVariants.${i}.name`} aria-invalid={!!showError(`initialVariants.${i}.name`)} aria-describedby={showError(`initialVariants.${i}.name`) ? `product-error-initialVariants.${i}.name` : undefined} value={v.name} onChange={e=>updateVariant(i,{name:e.target.value})} placeholder="Ex. Solo, Family, etc." aria-label="Variant name" className={fieldClass(`initialVariants.${i}.name`)} />{fieldMessage(`initialVariants.${i}.name`)}</div><input value={v.sku} readOnly aria-label="Automatically generated SKU" placeholder="Auto-generated SKU" className={input} /><div><input data-validation-field={`initialVariants.${i}.price`} aria-invalid={!!showError(`initialVariants.${i}.price`)} aria-describedby={showError(`initialVariants.${i}.price`) ? `product-error-initialVariants.${i}.price` : undefined} value={v.price} onChange={e=>{ if (/^\d*$/.test(e.target.value)) updateVariant(i,{price:e.target.value}); }} inputMode="numeric" pattern="[0-9]+" aria-label="Price" placeholder="Price" className={fieldClass(`initialVariants.${i}.price`)} />{fieldMessage(`initialVariants.${i}.price`)}</div><div className={styles.variantActions}><label className="flex items-center gap-2 text-xs"><input type="checkbox" className={styles.checkbox} checked={v.isEnabled} onChange={e=>updateVariant(i,{isEnabled:e.target.checked})} /> Enabled</label>{i > 0 ? <button type="button" className={styles.deleteVariant} aria-label={`Delete variant ${i + 1}`} disabled={submitting || uploading} onClick={()=>setVariants(current=>current.filter((_,index)=>index!==i))}><Trash2 className="h-3.5 w-3.5" /> Delete</button> : null}</div></div>)}</section> : null}
        <footer className="mt-5 flex justify-end gap-3 border-t border-slate-200 pt-4"><button type="submit" disabled={submitting || uploading} className={styles.primary}>{submitting || uploading ? "Saving..." : mode === "create" ? "Create Product" : "Save Changes"}</button></footer>
      </form>
    </div>
  </div>;
}
