"use client";

import styles from "@/components/layout/ApplicationShell.module.css";
import StaffHeader from "./StaffHeader";

type StaffDashboardLayoutProps = {
  children: React.ReactNode;
};

export default function StaffDashboardLayout({
  children,
}: StaffDashboardLayoutProps) {
  return (
    <div className={styles.shell}>
      <StaffHeader />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
