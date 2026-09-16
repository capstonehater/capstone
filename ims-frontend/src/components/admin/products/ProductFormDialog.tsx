"use client";

import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import type { ProductCategory, ProductDetail, VariantFormInput } from "@/lib/products";

type Props = { mode: "create" | "edit"; open: boolean; categories: ProductCategory[]; product: ProductDetail | null; submitting: boolean; errorMessage?: string | null; fieldErrors?: Record<string, string[]>; onClose: () => void; onSubmit: (input: { name: string; categoryId: string; isEnabled: boolean; initialVariants: VariantFormInput[] }) => Promise<void> };
const input = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#168000] focus:ring-1 focus:ring-[#168000]";
function emptyVariant(): VariantFormInput { return { name: "", sku: "", price: "", isEnabled: true }; }

export default function ProductFormDialog(props: Props) {
  if (!props.open) return null;
  return <ProductFormDialogBody key={`${props.mode}:${props.product?.id ?? "new"}`} {...props} />;
}

function ProductFormDialogBody({ mode, categories, product, submitting, errorMessage, fieldErrors, onClose, onSubmit }: Omit<Props, "open">) {
  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(product?.category.id ?? categories[0]?.id ?? "");
  const [isEnabled, setIsEnabled] = useState(product?.manualAvailability !== "DISABLED");
  const [variants, setVariants] = useState<VariantFormInput[]>([emptyVariant()]);
  const [clientErrors, setClientErrors] = useState<string[]>([]);
  function validate() {
    const errors: string[] = [];
    if (!name.trim()) errors.push("Product name is required.");
    if (!categoryId) errors.push("Category is required.");
    if (mode === "create") {
      if (!variants.length) errors.push("At least one initial variant is required.");
      const names = new Set<string>(); const skus = new Set<string>();
      variants.forEach((v, i) => { const n=v.name.trim(), s=v.sku.trim(), price=Number(v.price); if(!n) errors.push(`Variant ${i+1}: name is required.`); else if(names.has(n.toLowerCase())) errors.push(`Variant ${i+1}: duplicate variant name.`); else names.add(n.toLowerCase()); if(!s) errors.push(`Variant ${i+1}: SKU is required.`); else if(skus.has(s.toLowerCase())) errors.push(`Variant ${i+1}: duplicate SKU.`); else skus.add(s.toLowerCase()); if(!v.price.trim() || Number.isNaN(price) || price<0) errors.push(`Variant ${i+1}: price must be a valid non-negative number.`); });
    }
    setClientErrors(errors); return errors.length === 0;
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!validate()) return; await onSubmit({ name:name.trim(), categoryId, isEnabled, initialVariants: mode === "create" ? variants.map(v=>({...v,name:v.name.trim(),sku:v.sku.trim(),price:v.price.trim()})) : [] }); }
  const updateVariant = (index: number, patch: Partial<VariantFormInput>) => setVariants(current => current.map((v,i)=>i===index ? {...v,...patch} : v));
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
    <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5"><div><h2 className="text-xl font-bold text-slate-900">{mode === "create" ? "Add Product" : "Edit Product"}</h2><p className="mt-1 text-sm text-slate-500">{mode === "create" ? "Create a new product, set availability, and organize category details." : "Update product information, availability, and details."}</p></div><button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
      <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {(clientErrors.length || errorMessage) ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700"><ul>{clientErrors.map(e=><li key={e}>{e}</li>)}{errorMessage ? <li>{errorMessage}</li> : null}{fieldErrors ? Object.entries(fieldErrors).map(([k,v])=><li key={k}>{k}: {v.join(", ")}</li>) : null}</ul></div> : null}
        <section className="rounded-lg border border-slate-200 p-4"><h3 className="text-sm font-bold text-slate-900">Product Information</h3><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-700">Product Name *<input value={name} onChange={e=>setName(e.target.value)} className={`${input} mt-1`} placeholder="Spanish Latte" /></label><label className="text-xs font-semibold text-slate-700">Category *<select value={categoryId} onChange={e=>setCategoryId(e.target.value)} className={`${input} mt-1`}><option value="">Select category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>{mode === "create" ? <div className="mt-4 flex items-center justify-between rounded-md bg-slate-50 px-3 py-3"><div><p className="text-xs font-semibold text-slate-800">POS Availability</p><p className="text-xs text-slate-500">{isEnabled ? "Enabled" : "Disabled"}</p></div><button type="button" role="switch" aria-checked={isEnabled} onClick={()=>setIsEnabled(v=>!v)} className={`relative h-6 w-11 rounded-full ${isEnabled ? "bg-[#168000]" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${isEnabled ? "left-6" : "left-1"}`} /></button></div> : null}</section>
        {mode === "create" ? <section className="mt-4 rounded-lg border border-slate-200 p-4"><div className="flex items-start justify-between"><div><h3 className="text-sm font-bold text-slate-900">Product Setup</h3><p className="mt-1 text-xs text-slate-500">Add the initial variant required to sell this product.</p></div><button type="button" onClick={()=>setVariants(v=>[...v,emptyVariant()])} className="inline-flex items-center gap-1 text-xs font-semibold text-[#168000]"><Plus className="h-3.5 w-3.5" /> Add Variant</button></div>{variants.map((v,i)=><div key={i} className="mt-3 grid gap-3 rounded-md bg-slate-50 p-3 sm:grid-cols-4"><input value={v.name} onChange={e=>updateVariant(i,{name:e.target.value})} placeholder="Variant name" className={input} /><input value={v.sku} onChange={e=>updateVariant(i,{sku:e.target.value})} placeholder="SKU" className={input} /><input value={v.price} onChange={e=>updateVariant(i,{price:e.target.value})} placeholder="Price" className={input} /><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={v.isEnabled} onChange={e=>updateVariant(i,{isEnabled:e.target.checked})} /> Enabled</label></div>)}</section> : null}
        <footer className="mt-5 flex justify-end gap-3 border-t border-slate-200 pt-4"><button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700">Cancel</button><button type="submit" disabled={submitting} className="rounded-md bg-[#168000] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Saving..." : mode === "create" ? "Create Product" : "Save Changes"}</button></footer>
      </form>
    </div>
  </div>;
}
