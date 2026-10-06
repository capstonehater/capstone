"use client";

import { useId, type ReactNode } from "react";
import styles from "./InventoryValidationField.module.css";

export default function InventoryValidationField({ error, children }: { error?: string; children: ReactNode }) {
  const id = useId();
  return <div className={error ? styles.invalid : undefined} role="group" aria-describedby={error ? id : undefined}>
    {children}
    {error && <p id={id} role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
  </div>;
}
