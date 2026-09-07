import { ReactNode } from "react";

type SummaryCardProps = {
  title: string;
  value: string | number;
  icon?: ReactNode;
};

export default function SummaryCard({ title, value, icon }: SummaryCardProps) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-neutral-500">{title}</p>
        <div className="text-neutral-700">{icon}</div>
      </div>
      <h3 className="text-3xl font-bold text-neutral-900">{value}</h3>
    </div>
  );
}