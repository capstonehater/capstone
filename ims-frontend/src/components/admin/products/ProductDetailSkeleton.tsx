"use client";

export default function ProductDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4 rounded-[28px] bg-white p-6 shadow-sm" aria-hidden="true">
      <div className="h-8 w-1/3 rounded-full bg-slate-200" />
      <div className="h-4 w-1/4 rounded-full bg-slate-100" />
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-3xl border border-slate-200 p-4">
            <div className="h-3 w-1/2 rounded-full bg-slate-100" />
            <div className="mt-3 h-5 w-2/3 rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="h-10 w-full rounded-2xl bg-slate-100" />
      <div className="h-72 rounded-3xl bg-slate-50" />
    </div>
  );
}

