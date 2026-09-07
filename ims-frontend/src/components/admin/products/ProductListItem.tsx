"use client";

import type { KeyboardEvent } from "react";
import type { ProductListItem as ProductListItemModel } from "@/lib/products";
import {
  effectiveStatusBadgeClasses,
  manualAvailabilityBadgeClasses,
  summarizeAvailabilityLabel,
} from "./product-ui";

type Props = {
  item: ProductListItemModel;
  selected: boolean;
  onSelect: () => void;
  onSelectRelative: (direction: -1 | 1) => void;
};

export default function ProductListItem({
  item,
  selected,
  onSelect,
  onSelectRelative,
}: Props) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onSelectRelative(1);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      onSelectRelative(-1);
    }
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      aria-current={selected ? "true" : undefined}
      className={`w-full rounded-3xl border px-4 py-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[#f45a1f]/30 ${
        selected
          ? "border-[#f45a1f] bg-[#fff4ef] shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{item.category.name}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${effectiveStatusBadgeClasses(item.effectiveStatus)}`}
        >
          {item.effectiveStatusLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <span>{item.variantCount} variants</span>
        <span>{item.ingredientCount} ingredients</span>
        <span>{item.stockAvailability.status}</span>
        <span
          className={`inline-flex w-fit rounded-full px-2 py-1 font-medium ${manualAvailabilityBadgeClasses(item.manualAvailability)}`}
        >
          {summarizeAvailabilityLabel(item.manualAvailability)}
        </span>
      </div>
    </button>
  );
}

