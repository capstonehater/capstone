"use client";

import DateFilter from "@/components/staff-pos/DateFilter";
import StockRunTimeField from "./StockRunTimeField";

export default function StockRunDateField({ id, label, value, onChange, type = "date", required = false, min }: {
  id: string; label: string; value: string; onChange: (value: string) => void;
  type?: "date" | "time"; required?: boolean; min?: string;
}) {
  if (type === "date") return <DateFilter editable min={min} inputId={id} label={label} value={value} onChange={onChange} required={required} />;
  return <StockRunTimeField id={id} label={label} value={value} onChange={onChange} required={required} />;
}
