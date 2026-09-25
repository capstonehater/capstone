"use client";

import { usePathname } from "next/navigation";
import { getAdminPageInfo } from "@/components/layout/shell-navigation";
import styles from "@/components/layout/ApplicationShell.module.css";

export default function AdminHeader() {
  const pathname = usePathname();
  const page = getAdminPageInfo(pathname);

  return (
    <header className={styles.pageIntro}>
      <h1 className={styles.title}>{page?.label.toUpperCase() ?? "CAFE SALVACION"}</h1>
      <p className={styles.subtitle}>{page?.subtitle ?? "Inventory management"}</p>
    </header>
  );
}
