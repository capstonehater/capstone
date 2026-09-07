"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SCOPES = [
  {
    href: "/admin/reports/inventory",
    label: "Inventory Reports",
    description: "Stock health, waste, spend, and operational inventory reporting.",
  },
  {
    href: "/admin/reports/pos",
    label: "POS Reports",
    description: "Daily sales, transaction history, and point-of-sale performance.",
  },
] as const;

export default function ReportsScopeSwitch() {
  const pathname = usePathname();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {SCOPES.map((scope) => {
        const active =
          scope.href === "/admin/reports/inventory"
            ? pathname === "/admin/reports" || pathname.startsWith(scope.href)
            : pathname.startsWith(scope.href);

        return (
          <Link
            key={scope.href}
            href={scope.href}
            className={`rounded-2xl border px-4 py-4 transition ${
              active
                ? "border-[#f45a1f] bg-[#fff3ed] text-[#8b2f10]"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <div className="text-sm font-semibold">{scope.label}</div>
            <p className="mt-1 text-xs leading-5 text-inherit/80">{scope.description}</p>
          </Link>
        );
      })}
    </div>
  );
}
