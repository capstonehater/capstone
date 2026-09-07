"use client";

import type { InventoryItem } from "../../types/inventory";
import { MapPinned, Sparkles, Store } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
};

const mockRecommendations = [
  {
    store: "FreshMart Supply",
    distance: "1.2 km",
    price: "₱78",
    eta: "12 mins",
  },
  {
    store: "City Wholesale Hub",
    distance: "2.4 km",
    price: "₱74",
    eta: "18 mins",
  },
  {
    store: "QuickBuy Depot",
    distance: "3.1 km",
    price: "₱76",
    eta: "21 mins",
  },
];

export default function RecommendModal({ isOpen, onClose, item }: Props) {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-[#f45a1f]">
              <Sparkles size={16} />
              AI Store Recommendation
            </div>
            <h2 className="text-2xl font-bold">Recommended stores for {item.name}</h2>
            <p className="text-sm text-neutral-500">
              Based on stock urgency, estimated distance, and supplier pricing.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg border px-3 py-2 text-sm text-neutral-700"
          >
            Close
          </button>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-[#f9f7f2] p-4">
            <p className="text-sm text-neutral-500">Item</p>
            <p className="text-lg font-semibold">{item.name}</p>
          </div>
          <div className="rounded-xl bg-[#f9f7f2] p-4">
            <p className="text-sm text-neutral-500">Current Stock</p>
            <p className="text-lg font-semibold">{item.stock}</p>
          </div>
          <div className="rounded-xl bg-[#f9f7f2] p-4">
            <p className="text-sm text-neutral-500">Reorder Point</p>
            <p className="text-lg font-semibold">{item.reorderPoint}</p>
          </div>
          <div className="rounded-xl bg-[#f9f7f2] p-4">
            <p className="text-sm text-neutral-500">Status</p>
            <p className="text-lg font-semibold">{item.status}</p>
          </div>
        </div>

        <div className="space-y-3">
          {mockRecommendations.map((rec) => (
            <div
              key={rec.store}
              className="flex flex-col gap-4 rounded-xl border border-neutral-200 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-orange-100 p-2 text-[#f45a1f]">
                  <Store size={18} />
                </div>

                <div>
                  <p className="font-semibold text-neutral-900">{rec.store}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
                    <span className="inline-flex items-center gap-1">
                      <MapPinned size={14} />
                      {rec.distance}
                    </span>
                    <span>ETA: {rec.eta}</span>
                    <span>Estimated Price: {rec.price}</span>
                  </div>
                </div>
              </div>

              <button className="rounded-lg bg-[#f45a1f] px-4 py-2 text-sm text-white">
                Select Store
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}   