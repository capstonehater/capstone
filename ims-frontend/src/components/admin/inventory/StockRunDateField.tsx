"use client";

import { useRef } from "react";
import { Clock3 } from "lucide-react";
import DateFilter from "@/components/staff-pos/DateFilter";
import { InventoryField } from "./InventoryField";
import styles from "./InventoryModal.module.css";

export default function StockRunDateField({ id, label, value, onChange, type = "date", required = false }: {
  id: string; label: string; value: string; onChange: (value: string) => void;
  type?: "date" | "time"; required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  if (type === "date") return <DateFilter editable inputId={id} label={label} value={value} onChange={onChange} required={required} />;
  return <InventoryField htmlFor={id} label={label} required={required}>
    <div className={styles.stockRunDateControl}>
      <input ref={inputRef} id={id} type={type} value={value} required={required}
        onChange={event => onChange(event.target.value)} />
      <button type="button" aria-label={`Open ${label.toLowerCase()} picker`}
        onClick={() => {
          const input = inputRef.current;
          if (!input) return;
          try { input.showPicker(); } catch { input.focus(); }
        }}>
        <Clock3 size={18} aria-hidden="true" />
      </button>
    </div>
  </InventoryField>;
}
