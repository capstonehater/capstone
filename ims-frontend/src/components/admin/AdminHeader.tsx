"use client";


import { usePathname } from "next/navigation";
import { getAdminPageInfo } from "@/components/layout/shell-navigation";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
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
    <div className={styles.pageIntro}>
      <AdminSectionHeader
        title={page?.label ?? "Cafe Salvacion"}
        description={page?.subtitle ?? "Inventory management"}
      />
    </div>
  );
}
