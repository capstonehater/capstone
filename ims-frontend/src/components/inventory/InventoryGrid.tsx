"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical, Sparkles, Package, Boxes } from "lucide-react";
import type { InventoryItem } from "../../types/inventory";

type Props = {
  items: InventoryItem[];
  onRecommend: (item: InventoryItem) => void;
  onRestock: (item: InventoryItem) => void;
  onView: (item: InventoryItem) => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
};

function getHeaderColor(status: InventoryItem["status"]) {
  switch (status) {
    case "Out of Stock":
      return "bg-[#f4d6d6]";
    case "Low Stock":
      return "bg-[#efe47a]";
    case "In Stock":
      return "bg-[#9fcaeb]";
    default:
      return "bg-gray-200";
  }
}

function getBadgeColor(status: InventoryItem["status"]) {
  switch (status) {
    case "Out of Stock":
      return "bg-[#ef9a9a] text-[#4a1f1f]";
    case "Low Stock":
      return "bg-[#d7c95d] text-[#4d4300]";
    case "In Stock":
      return "bg-[#2f8fd8] text-white";
    default:
      return "bg-gray-200 text-gray-700";
  }
}

export default function InventoryGrid({
  items,
  onRecommend,
  onRestock,
  onView,
  onEdit,
  onDelete,
}: Props) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="overflow-hidden rounded-[22px] border border-neutral-300 bg-white shadow-sm"
        >
          <div className={`px-4 py-3 ${getHeaderColor(item.status)}`}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="rounded-full border border-black/20 p-1.5 text-neutral-800">
                  <Package size={16} />
                </div>

                <div>
                  <p className="text-lg font-semibold text-neutral-900">
                    {item.name}
                  </p>
                  <p className="text-xs text-neutral-700">
                    {item.type} • {item.unit}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-medium ${getBadgeColor(
                    item.status
                  )}`}
                >
                  {item.status}
                </span>

                <div
                  ref={openMenuId === item.id ? menuRef : null}
                  className="relative"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenuId((prev) => (prev === item.id ? null : item.id))
                    }
                    className="rounded-md p-1 text-neutral-700 hover:bg-black/5"
                  >
                    <MoreVertical size={16} />
                  </button>

                  {openMenuId === item.id && (
                    <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-neutral-200 bg-white py-2 shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          onView(item);
                        }}
                        className="block w-full px-4 py-2 text-left text-sm hover:bg-neutral-50"
                      >
                        View Details
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          onEdit(item);
                        }}
                        className="block w-full px-4 py-2 text-left text-sm hover:bg-neutral-50"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          onRestock(item);
                        }}
                        className="block w-full px-4 py-2 text-left text-sm hover:bg-neutral-50"
                      >
                        Restock
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          onRecommend(item);
                        }}
                        className="block w-full px-4 py-2 text-left text-sm hover:bg-neutral-50"
                      >
                        Recommend
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          onDelete(item);
                        }}
                        className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-neutral-50"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 px-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#efefef] p-3">
                <p className="text-[11px] text-neutral-500">Category</p>
                <p className="text-base font-semibold text-neutral-900">
                  {item.category}
                </p>
              </div>

              <div className="rounded-xl bg-[#efefef] p-3">
                <p className="text-[11px] text-neutral-500">Expiration Date</p>
                <p className="text-base font-semibold text-neutral-900">
                  {item.expirationDate}
                </p>
              </div>

              <div className="rounded-xl bg-[#efefef] p-3">
                <p className="text-[11px] text-neutral-500">SKU</p>
                <p className="text-base font-semibold text-neutral-900">
                  {item.sku}
                </p>
              </div>

              <div className="rounded-xl bg-[#efefef] p-3">
                <p className="text-[11px] text-neutral-500">Current Stock</p>
                <p className="text-3xl font-bold leading-none text-neutral-900">
                  {item.stock}
                </p>
                <p className="mt-1 text-[10px] text-neutral-500">
                  units available
                </p>
              </div>

              <div className="rounded-xl bg-[#efefef] p-3">
                <p className="text-[11px] text-neutral-500">Supplier</p>
                <p className="text-base font-semibold text-neutral-900">
                  {item.supplier}
                </p>
              </div>

              <div className="rounded-xl bg-[#efefef] p-3">
                <p className="text-[11px] text-neutral-500">Unit Price</p>
                <p className="text-3xl font-bold leading-none text-neutral-900">
                  {item.unitPrice}
                </p>
                <p className="mt-1 text-[10px] text-neutral-500">per unit</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 border-t border-neutral-200 px-4 py-3">
            <button
              type="button"
              onClick={() => onRestock(item)}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              <Boxes size={14} />
              Restock
            </button>

            <button
              type="button"
              onClick={() => onRecommend(item)}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[#8cbde4] bg-[#d8ebf8] px-3 py-2 text-sm text-[#2a6b98] hover:bg-[#cfe4f4]"
            >
              <Sparkles size={14} />
              Recommendation
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}