"use client";


import { usePathname } from "next/navigation";
import { getAdminPageInfo } from "@/components/layout/shell-navigation";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import styles from "@/components/layout/ApplicationShell.module.css";

export default function AdminHeader() {
  const pathname = usePathname();
  const page = getAdminPageInfo(pathname);

  return (
    <div className={styles.pageIntro}>
      <AdminSectionHeader
        title={page?.label ?? "Cafe Salvacion"}
        description={page?.subtitle ?? "Inventory management"}
      />
    </div>
  );
}
