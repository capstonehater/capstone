"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Upload, Trash2, Check } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import styles from "./ProductFormDialog.module.css";

export default function ProductImagePicker({ imageUrl, file, disabled, onChange }: {
  imageUrl: string | null;
  file: File | null;
  disabled: boolean;
  onChange: (file: File | null, remove?: boolean) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
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
        <input ref={fileInputRef} type="file" aria-label="Choose product photo" accept=".svg,.jpg,.jpeg,.png,image/svg+xml,image/jpeg,image/png" disabled={disabled} hidden onChange={(event) => {
          const next = event.target.files?.[0];
          event.target.value = "";
          if (!next) return;
          if (!/\.(svg|jpe?g|png)$/i.test(next.name) || next.size > 5 * 1024 * 1024) {
            setError("Choose an SVG, JPG, JPEG, or PNG image up to 5 MB."); return;
          }
          setError(""); onChange(next);
        }} />
      <div className={styles.photoActions}>
      <button type="button" disabled={disabled} className={styles.primary} onClick={() => fileInputRef.current?.click()}>
        <Upload size={16} aria-hidden="true" />
        {file || imageUrl ? "Change Photo" : "Insert Photo"}
      </button>
      {(file || imageUrl) && <button type="button" disabled={disabled} className={styles.removePhoto} onClick={() => { setError(""); onChange(null, true); }}><Trash2 size={15} aria-hidden="true" />Remove</button>}
      </div>
      {file && <p role="status" className={styles.photoFilename}><Check size={14} aria-hidden="true" /><span>{file.name}</span></p>}
      {error && <p role="alert" className={styles.photoError}>{error}</p>}
    </div>
    </div>
    <div className={styles.photoFootnote}><div className={styles.formatBadges}>{["SVG", "JPG", "JPEG", "PNG"].map(format => <span key={format}>{format}</span>)}</div><span>Up to 5 MB per image</span></div>
  </section>;
}
