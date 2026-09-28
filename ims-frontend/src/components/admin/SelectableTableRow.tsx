"use client";

import type { ReactNode } from "react";

export default function SelectableTableRow({ selected, disabled = false, onSelect, children }: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return <tr
    aria-current={selected ? "true" : undefined}
    aria-disabled={disabled || undefined}
    tabIndex={disabled ? -1 : 0}
    onClick={() => { if (!disabled) onSelect(); }}
    onKeyDown={(event) => {
      if (disabled) return;
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const sibling = event.key === "ArrowDown" ? event.currentTarget.nextElementSibling : event.currentTarget.previousElementSibling;
        if (sibling instanceof HTMLElement && sibling.tabIndex === 0) { sibling.focus(); sibling.click(); }
      }
    }}
    className={`transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-500 ${disabled ? "opacity-50" : "cursor-pointer"} ${selected ? "bg-slate-100" : "bg-white hover:bg-slate-50"}`}
  >{children}</tr>;
}
