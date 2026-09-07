"use client";

type InventoryFieldProps = {
  htmlFor: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
};

export const inventoryInputClasses =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#f45a1f] focus:ring-2 focus:ring-[#f45a1f]/15";

export const inventoryTextareaClasses =
  "min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#f45a1f] focus:ring-2 focus:ring-[#f45a1f]/15";

export function InventoryField({
  htmlFor,
  label,
  hint,
  children,
}: InventoryFieldProps) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-semibold text-slate-800"
      >
        {label}
      </label>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {children}
    </div>
  );
}
