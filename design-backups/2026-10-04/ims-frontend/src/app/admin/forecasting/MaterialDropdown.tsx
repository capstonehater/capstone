"use client";

import AdminSelect from "@/components/admin/AdminSelect";
import styles from "./forecasting.module.css";

export default function MaterialDropdown({ value, onChange, products }: { value: string; onChange: (value: string) => void; products: { id: string; name: string }[] }) {
  return <div className={styles.materialFilter}><AdminSelect label="Product" value={value} onChange={onChange} options={[{ value: "", label: "All products" }, ...products.map(product => ({ value: product.id, label: product.name }))]} /></div>;
}
