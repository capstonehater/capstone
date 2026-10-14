"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Upload, Trash2, Check } from "lucide-react";
import { validateImageUpload } from "@/lib/image-upload";
import ProductImage from "@/components/ProductImage";
import ProfilePictureCropper from "@/components/admin/settings/ProfilePictureCropper";
import styles from "./ProductFormDialog.module.css";

export default function ProductImagePicker({ imageUrl, file, disabled, onChange, onEditingChange }: {
  imageUrl: string | null;
  file: File | null;
  disabled: boolean;
  onChange: (file: File | null, remove?: boolean) => void;
  onEditingChange: (editing: boolean) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const finishEditing = () => { setCropFile(null); onEditingChange(false); };
  async function adjustPhoto() {
    if (disabled || loading || cropFile) return;
    if (originalFile || file) {
      setCropFile(originalFile ?? file); onEditingChange(true); return;
    }
    if (!imageUrl) return;
    setLoading(true); setError(""); onEditingChange(true);
    const controller = new AbortController();
    request.current = controller;
    try {
      const url = imageUrl.startsWith("/product-images/")
        ? `${(process.env.NEXT_PUBLIC_API_BASE_URL ?? "/backend").replace(/\/+$/, "")}${imageUrl}` : imageUrl;
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("The saved product photo could not be loaded.");
      const blob = await response.blob();
      if (!blob.size || blob.size > 5 * 1024 * 1024) throw new Error("Choose an image up to 5 MB.");
      const source = new File([blob], "saved-product-photo", { type: blob.type });
      setOriginalFile(source); setCropFile(source);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "Unable to adjust this photo.");
      onEditingChange(false);
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(file);
    return () => { reader.onload = null; reader.abort(); };
  }, [file]);
  return <section className={styles.photoSection} aria-label="Product photo">
    <div className={styles.photoHeader}>
      <span className={styles.photoIcon}><ImagePlus size={20} aria-hidden="true" /></span>
      <div><h3>Product photo</h3><p>Give your product a place on the menu.</p></div>
      <span className={styles.optionalBadge}>Optional</span>
    </div>
    <div className={styles.photoBody}>
    <div className={styles.photoPreview}><ProductImage src={file ? preview : imageUrl} name="Product image preview" /><span>POS preview</span></div>
    <div className={styles.photoControls}>
      <p className={styles.photoHeading}>{file || imageUrl ? "Looking good on your menu" : "Add a photo of your product"}</p>
      <p className={styles.photoHelp}>Shown on the product card and when staff open the product.</p>
        <input ref={fileInputRef} type="file" aria-label="Choose product photo" accept=".svg,.jpg,.jpeg,.png,image/svg+xml,image/jpeg,image/png" disabled={disabled} hidden onChange={async (event) => {
          const next = event.target.files?.[0];
          event.target.value = "";
          if (!next) return;
          if (!/\.(svg|jpe?g|png)$/i.test(next.name) || !next.size || next.size > 5 * 1024 * 1024) {
            setError("Choose an SVG, JPG, JPEG, or PNG image up to 5 MB."); return;
          }
          setError(""); setLoading(true); onEditingChange(true);
          const controller = new AbortController(); request.current = controller;
          try {
            await validateImageUpload(next, controller.signal);
            if (!controller.signal.aborted) setCropFile(next);
          } catch (cause) {
            if (!controller.signal.aborted) {
              setError(cause instanceof Error ? cause.message : "This file is not a valid image.");
              onEditingChange(false);
            }
          } finally { if (!controller.signal.aborted) setLoading(false); }
        }} />
      <div className={styles.photoActions}>
      <button type="button" disabled={disabled || loading || !!cropFile} className={styles.primary} onClick={() => fileInputRef.current?.click()}>
        <Upload size={16} aria-hidden="true" />
        {file || imageUrl ? "Change Photo" : "Insert Photo"}
      </button>
      {(file || imageUrl) && <button type="button" disabled={disabled || loading || !!cropFile} className={styles.removePhoto} onClick={adjustPhoto}>{loading ? "Loading..." : "Adjust photo"}</button>}
      {(file || imageUrl) && <button type="button" disabled={disabled || loading || !!cropFile} className={styles.removePhoto} onClick={() => { setError(""); setOriginalFile(null); onChange(null, true); }}><Trash2 size={15} aria-hidden="true" />Remove</button>}
      </div>
      {file && <p role="status" className={styles.photoFilename}><Check size={14} aria-hidden="true" /><span>{file.name}</span></p>}
      {loading && <p role="status" className={styles.photoHelp}>Checking and loading photo...</p>}
      {error && <p role="alert" className={styles.photoError}>{error}</p>}
    </div>
    </div>
    {cropFile && <div className="w-full" aria-label="Adjust product photo"><ProfilePictureCropper key={`${cropFile.name}:${cropFile.lastModified}`} variant="product" file={cropFile} onCancel={finishEditing} onApply={(adjusted) => { setOriginalFile(cropFile); onChange(adjusted); finishEditing(); }} /></div>}
    <div className={styles.photoFootnote}><div className={styles.formatBadges}>{["SVG", "JPG", "JPEG", "PNG"].map(format => <span key={format}>{format}</span>)}</div><span>Up to 5 MB per image</span></div>
  </section>;
}
