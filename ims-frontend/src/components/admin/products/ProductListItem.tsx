"use client";
import type { ProductListItem as ProductListItemModel } from "@/lib/products";
type Props = { item: ProductListItemModel; selected: boolean; onSelect: () => void; onSelectRelative: (direction: -1 | 1) => void };
export default function ProductListItem({ item, selected, onSelect, onSelectRelative }: Props) {
  return <tr aria-current={selected ? "true" : undefined} tabIndex={0} onClick={onSelect} onKeyDown={(event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(); }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const sibling = direction === 1 ? event.currentTarget.nextElementSibling : event.currentTarget.previousElementSibling;
      if (sibling instanceof HTMLElement) { sibling.focus(); onSelectRelative(direction); }
    }
  }} className={`cursor-pointer transition ${selected ? "bg-slate-100" : "bg-white hover:bg-slate-50"}`}>
    <td className="px-3 py-2"><p className="mb-1! truncate text-xs font-semibold text-slate-900">{item.name}</p><p className="mb-0! truncate text-[13px] text-slate-500">{item.category.name} · {item.effectiveStatusLabel}</p></td>
    <td className="px-2 py-2 text-center text-xs text-slate-700">{item.variantCount}</td><td className="px-2 py-2 text-center text-xs text-slate-700">{item.ingredientCount}</td>
  </tr>;
}
