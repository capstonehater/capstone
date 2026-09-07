"use client";

type DetailTab = "overview" | "variants" | "usage";

type Props = {
  activeTab: DetailTab;
  onChange: (tab: DetailTab) => void;
};

const tabs: Array<{ value: DetailTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "variants", label: "Variants & Recipe" },
  { value: "usage", label: "Ingredient Usage" },
];

export default function ProductDetailTabs({ activeTab, onChange }: Props) {
  return (
    <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === tab.value
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

