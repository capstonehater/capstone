"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useState } from "react";
import { NavigationMenuButton } from "@/components/layout/ShellControls";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { routeHref } from "@/lib/routing/routes";
import { useSidebarStore } from "@/store/sidebarStore";
import styles from "@/components/layout/ApplicationShell.module.css";
import StaffHeader from "./StaffHeader";
import focusStyles from "./FocusMode.module.css";

const FocusModeContext = createContext({ focusMode: false, toggleFocusMode: () => {} });
export const usePOSFocusMode = () => useContext(FocusModeContext);

type StaffDashboardLayoutProps = {
  children: React.ReactNode;
  showHeader?: boolean;
};

export default function StaffDashboardLayout({
  children,
  showHeader = true,
}: StaffDashboardLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const collapsed = useSidebarStore(state => state.collapsed);
  const toggleCollapsed = useSidebarStore(state => state.toggleCollapsed);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const [focusEnabled, setFocusEnabled] = useState(false);
  const focusMode = focusEnabled && pathname === routeHref("pos");

  return (
    <FocusModeContext.Provider value={{ focusMode, toggleFocusMode: () => { setFocusEnabled((value) => !value); setSidebarOpen(false); } }}>
    <div className={`${styles.shell} ${collapsed ? styles.adminShellCollapsed : ""} ${focusMode ? focusStyles.focusShell : ""}`}>
      <AdminSidebar isOpen={sidebarOpen} onClose={closeSidebar} collapsed={collapsed} onToggleCollapse={toggleCollapsed} className={focusStyles.sidebar} inert={focusMode} />
        <div className={`${styles.body} ${focusStyles.body}`}><NavigationMenuButton className={`${styles.shellMobileMenu} ${focusStyles.mobileMenu}`} onOpen={() => setSidebarOpen(true)} expanded={sidebarOpen} controls="admin-navigation" />{showHeader && pathname !== routeHref("pos") && pathname !== routeHref("pos.transactions") && <div className={focusStyles.retract}><div className={focusStyles.retractInner}><StaffHeader /></div></div>}<main className={styles.content}>{children}</main></div>
    </div>
    </FocusModeContext.Provider>
  );
}
