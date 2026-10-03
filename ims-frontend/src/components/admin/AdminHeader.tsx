"use client";


import { usePathname } from "next/navigation";
import { getAdminPageInfo } from "@/components/layout/shell-navigation";
import styles from "@/components/layout/ApplicationShell.module.css";
import { useAuthStore } from "@/store/authStore";
import { routeHref } from "@/lib/routing/routes";
import { managerSettingsMetadata } from "@/lib/routing/page-metadata";

export default function AdminHeader() {
  const pathname = usePathname();
  const role = useAuthStore(state => state.user?.role);
  const page = pathname === routeHref("settings") && role === "MANAGER"
    ? managerSettingsMetadata
    : getAdminPageInfo(pathname);

  return (
    <header className={styles.pageIntro}>
      <h1 className={styles.title}>{page?.label.toUpperCase() ?? "CAFE SALVACION"}</h1>
      <p className={styles.subtitle}>{page?.subtitle ?? "Inventory management"}</p>
      {pathname === routeHref("dashboard") || pathname === routeHref("reports.inventory") ? <div className={styles.introDivider} /> : null}
    </header>
  );
}
