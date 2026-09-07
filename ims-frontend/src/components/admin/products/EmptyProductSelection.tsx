"use client";

export default function EmptyProductSelection() {
  return (
    <div className="flex h-full min-h-[65vh] items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
      <div className="max-w-md">
        <h2 className="text-xl font-semibold text-slate-900">Select a product</h2>
        <p className="mt-3 text-sm text-slate-500">
          Choose a product from the navigator to open its overview, variants and recipes, and
          ingredient usage.
        </p>
      </div>
    </div>
  );
}

