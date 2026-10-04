"use client";

import { useCallback, useState } from "react";
import { useAdminPageEntrance } from "@/components/admin/useAdminPageEntrance";
import styles from "@/components/layout/ApplicationShell.module.css";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Menu } from "lucide-react";
import { useSidebarStore } from "@/store/sidebarStore";

type AdminDashboardLayoutProps = {
  children: React.ReactNode;
  fillContent?: boolean;
  showHeader?: boolean;
  whiteTop?: boolean;
};

export default function AdminDashboardLayout({
  children,
  fillContent = false,
  showHeader = true,
  whiteTop = false,
}: AdminDashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const contentRef = useAdminPageEntrance();
  const sidebarCollapsed = useSidebarStore(state => state.collapsed);
  const toggleCollapsed = useSidebarStore(state => state.toggleCollapsed);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className={`${styles.shell} ${sidebarCollapsed ? styles.adminShellCollapsed : ""} ${fillContent ? styles.fillContent : ""}`}>
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleCollapsed}
      />

      <div className={`${styles.body} ${whiteTop ? styles.bodyWhiteTop : ""}`}>
        <button type="button" className={styles.shellMobileMenu} onClick={() => setSidebarOpen(true)} aria-expanded={sidebarOpen} aria-controls="admin-navigation" aria-label="Open navigation"><Menu size={20} /></button>
        {showHeader ? <AdminHeader /> : null}
        <main ref={contentRef} className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
