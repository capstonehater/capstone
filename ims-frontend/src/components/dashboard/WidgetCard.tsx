import { ReactNode } from "react";

type WidgetCardProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

export default function WidgetCard({
  title,
  children,
  className = "",
}: WidgetCardProps) {
  return (
    <section className={`min-w-0 rounded-2xl bg-white p-4 shadow-sm ${className}`}>
      <h2 className="mb-4 text-lg font-semibold text-neutral-900">{title}</h2>
      {children}
    </section>
  );
}
