"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical, Package } from "lucide-react";
import type { InventoryItem } from "../../types/inventory";

type Props = {
  items: InventoryItem[];
  onRecommend: (item: InventoryItem) => void;
  onRestock: (item: InventoryItem) => void;
  onView: (item: InventoryItem) => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
};

function getStatusClasses(status: InventoryItem["status"]) {
  switch (status) {
    case "In Stock":
      return "bg-[#a8d4f5] text-[#1f5f8b]";
    case "Low Stock":
      return "bg-[#efe47a] text-[#5a5100]";
    case "Out of Stock":
      return "bg-[#f4b1b1] text-[#7a1f1f]";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getProductIconColor(status: InventoryItem["status"]) {
  switch (status) {
    case "In Stock":
      return "bg-[#9fcaeb]";
    case "Low Stock":
      return "bg-[#efe47a]";
    case "Out of Stock":
      return "bg-[#f4b1b1]";
    default:
      return "bg-gray-200";
  }
}

export default function InventoryTable({
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
    <div className="rounded-[24px] border border-neutral-300 bg-white p-4 shadow-sm">
      <div className="mb-4 text-sm text-neutral-700">
        Showing {items.length} of 67 products
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-400 text-left text-[13px] text-neutral-800">
              <th className="w-8 py-3 pr-2">
                <div className="h-3 w-3 rounded-sm bg-black" />
              </th>
              <th className="py-3 pr-4 font-medium">Item Name</th>
              <th className="py-3 pr-4 font-medium">Category</th>
              <th className="py-3 pr-4 font-medium">Type</th>
              <th className="py-3 pr-4 font-medium">Unit</th>
              <th className="py-3 pr-4 font-medium">Expiration Date</th>
              <th className="py-3 pr-4 font-medium">SKU</th>
              <th className="py-3 pr-4 font-medium">Current Stock</th>
              <th className="py-3 pr-4 font-medium">Supplier</th>
              <th className="py-3 pr-4 font-medium">Unit Price</th>
              <th className="py-3 pr-4 font-medium">Status</th>
              <th className="py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-neutral-300 text-[13px] text-neutral-800"
              >
                <td className="py-3 pr-2 align-middle">
                  <div className="h-3 w-3 rounded-sm bg-black" />
                </td>

                <td className="py-3 pr-4 align-middle">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${getProductIconColor(
                        item.status
                      )}`}
                    >
                      <Package size={15} className="text-neutral-800" />
                    </div>
                    <span className="font-medium">{item.name}</span>
                  </div>
                </td>

                <td className="py-3 pr-4 align-middle">
                  <span className="rounded-full bg-[#e9e9e9] px-2 py-1 text-[10px] text-neutral-700">
                    {item.category}
                  </span>
                </td>

                <td className="py-3 pr-4 align-middle">{item.type}</td>
                <td className="py-3 pr-4 align-middle">{item.unit}</td>
                <td className="py-3 pr-4 align-middle">{item.expirationDate}</td>
                <td className="py-3 pr-4 align-middle">{item.sku}</td>

                <td className="py-3 pr-4 align-middle">
                  <span className="text-[18px] font-semibold leading-none">
                    {item.stock}
                  </span>
                </td>

                <td className="py-3 pr-4 align-middle">{item.supplier}</td>

                <td className="py-3 pr-4 align-middle">
                  <span className="text-[18px] font-semibold leading-none">
                    {item.unitPrice}
                  </span>
                </td>

                <td className="py-3 pr-4 align-middle">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-[10px] font-medium ${getStatusClasses(
                      item.status
                    )}`}
                  >
                    {item.status}
                  </span>
                </td>

                <td className="py-3 text-right align-middle">
                  <div className="relative inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRestock(item)}
                      className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      Restock
                    </button>

                    <button
                      type="button"
                      onClick={() => onRecommend(item)}
                      className="rounded-full border border-[#8cbde4] bg-[#d8ebf8] px-3 py-1.5 text-[11px] font-medium text-[#2a6b98] hover:bg-[#cfe4f4]"
                    >
                      Recommend
                    </button>

                    <div
                      ref={openMenuId === item.id ? menuRef : null}
                      className="relative"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuId((prev) =>
                            prev === item.id ? null : item.id
                          )
                        }
                        className="rounded-md p-1 text-black hover:bg-neutral-100"
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}