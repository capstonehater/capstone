"use client";

export default function ProductListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-3xl border border-slate-200 bg-white p-4"
        >
          <div className="h-4 w-2/3 rounded-full bg-slate-200" />
          <div className="mt-3 h-3 w-1/3 rounded-full bg-slate-100" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="h-3 rounded-full bg-slate-100" />
            <div className="h-3 rounded-full bg-slate-100" />
            <div className="h-3 rounded-full bg-slate-100" />
            <div className="h-3 rounded-full bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

