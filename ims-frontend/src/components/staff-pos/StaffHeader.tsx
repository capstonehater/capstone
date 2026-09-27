"use client";

import { usePathname } from "next/navigation";
import { staffPageInfo } from "@/components/layout/shell-navigation";
import styles from "@/components/layout/ApplicationShell.module.css";

export default function StaffHeader() {
  const pathname = usePathname();
  const page = staffPageInfo[pathname];
  return (
    <header className={styles.pageIntro}>
      <h1 className={styles.title}>{page?.label.toUpperCase() ?? "STAFF"}</h1>
      <p className={styles.subtitle}>{page?.subtitle ?? "Manage your daily work."}</p>
    </header>
  );
}
