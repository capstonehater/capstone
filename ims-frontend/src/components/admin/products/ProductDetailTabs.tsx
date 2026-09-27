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
    <div className="flex border-b border-slate-200">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`border-b-2 px-4 py-2 text-xs font-semibold transition ${
            activeTab === tab.value
              ? "border-[#232d46] text-[#232d46]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
