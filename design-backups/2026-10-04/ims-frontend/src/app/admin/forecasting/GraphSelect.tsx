"use client";

import AdminSelect from "@/components/admin/AdminSelect";

type Option = { value: string; label: string };

export default function GraphSelect({ label, value, options, onChange, className = "", disabled = false, describedBy }: {
  label: string; value: string; options: Option[]; onChange: (value: string) => void; className?: string; disabled?: boolean; describedBy?: string;
}) {
  return <div className={className}><AdminSelect label={label} value={value} options={options} onChange={onChange} disabled={disabled} describedBy={describedBy} /></div>;
}
