"use client";

import { createContext, useState, type ReactNode } from "react";

export const ReportColumnsHeaderContext = createContext<HTMLElement | null | undefined>(undefined);

type WidgetCardProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

export default function WidgetCard({ title, children, className = "" }: WidgetCardProps) {
  const [columnControls, setColumnControls] = useState<HTMLDivElement | null>(null);
  return (
    <section className={`min-w-0 rounded-2xl bg-white p-4 shadow-sm ${className}`}>
      <div className="widget-card-header mb-4 flex items-center justify-between gap-3">
        <h2 className="min-w-0 text-lg font-semibold text-neutral-900">{title}</h2>
        <div ref={setColumnControls} className="flex shrink-0 items-center gap-2 print:hidden" />
      </div>
      <ReportColumnsHeaderContext.Provider value={columnControls}>
        {children}
      </ReportColumnsHeaderContext.Provider>
    </section>
  );
}
