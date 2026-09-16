"use client";
import type { ProductListItem as ProductListItemModel } from "@/lib/products";
type Props = { item: ProductListItemModel; selected: boolean; onSelect: () => void; onSelectRelative: (direction: -1 | 1) => void };
export default function ProductListItem({ item, selected, onSelect }: Props) {
  return <tr aria-current={selected ? "true" : undefined} onClick={onSelect} className={`cursor-pointer transition ${selected ? "bg-[#fff4ef]" : "bg-white hover:bg-slate-50"}`}>
    <td className="px-3 py-2"><p className="truncate text-xs font-semibold text-slate-900">{item.name}</p><p className="truncate text-[10px] text-slate-500">{item.category.name} · {item.effectiveStatusLabel}</p></td>
    <td className="px-2 py-2 text-center text-xs text-slate-700">{item.variantCount}</td><td className="px-2 py-2 text-center text-xs text-slate-700">{item.ingredientCount}</td>
  </tr>;
}
