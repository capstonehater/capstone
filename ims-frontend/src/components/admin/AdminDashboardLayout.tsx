"use client";

import { useCallback, useState } from "react";
import styles from "@/components/layout/ApplicationShell.module.css";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";

type AdminDashboardLayoutProps = {
  children: React.ReactNode;
};

export default function AdminDashboardLayout({
  children,
}: AdminDashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className={styles.shell}>
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
      />

      <div className={styles.body}>
        <AdminHeader sidebarOpen={sidebarOpen} onMenuClick={() => setSidebarOpen(true)} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
