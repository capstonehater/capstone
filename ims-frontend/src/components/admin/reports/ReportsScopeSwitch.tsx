"use client";

import Link from "next/link";
import styles from "./ReportsHeader.module.css";
import { usePathname } from "next/navigation";
import { routeHref } from "@/lib/routing/routes";

const SCOPES = [
  {
    href: routeHref("reports.inventory"),
    label: "Inventory Reports",
    description: "Stock health, waste, spend, and operational inventory reporting.",
  },
  {
    href: routeHref("reports.pos"),
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
          scope.href === routeHref("reports.inventory")
            ? pathname === routeHref("reports") || pathname.startsWith(scope.href)
            : pathname.startsWith(scope.href);

        return (
          <Link
            key={scope.href}
            href={scope.href}
            aria-current={active ? "page" : undefined}
            className={styles.scope}
          >
            <div className="text-sm font-semibold">{scope.label}</div>
            <p className="mt-1 text-xs leading-5 text-inherit/80">{scope.description}</p>
          </Link>
        );
      })}
    </div>
  );
}
