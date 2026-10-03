"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { NavigationOverlay, NavigationCloseButton, NavigationMenuButton, SidebarCollapseButton } from "@/components/layout/ShellControls";
import { getVisibleNavigation } from "@/components/layout/shell-navigation";
import { routeHref } from "@/lib/routing/routes";
import { useAuthStore } from "@/store/authStore";
import styles from "@/components/layout/ApplicationShell.module.css";
import StaffHeader from "./StaffHeader";
import SidebarAccount from "@/components/layout/SidebarAccount";
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
  const [collapsed, setCollapsed] = useState(false);
  const [focusEnabled, setFocusEnabled] = useState(false);
  const focusMode = focusEnabled && pathname === routeHref("pos");
  const links = getVisibleNavigation(useAuthStore()).flatMap(group => group.items);

  return (
    <FocusModeContext.Provider value={{ focusMode, toggleFocusMode: () => { setFocusEnabled((value) => !value); setSidebarOpen(false); } }}>
    <div className={`${styles.shell} ${collapsed ? styles.staffShellCollapsed : ""} ${focusMode ? focusStyles.focusShell : ""}`}>
      <NavigationOverlay open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <aside inert={focusMode} className={`${styles.staffSidebar} ${focusStyles.sidebar} ${sidebarOpen ? styles.staffSidebarOpen : ""} ${collapsed ? styles.staffSidebarCollapsed : ""}`}>
        <div className={styles.staffBrand}><div className={styles.sidebarBrandLogo}><strong>{collapsed ? "CS" : "Cafe Salvacion"}</strong>{!collapsed && <p>POS Management</p>}</div><NavigationCloseButton onClose={() => setSidebarOpen(false)} /></div>
        <SidebarAccount collapsed={collapsed && !sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
        <nav className={styles.staffNavigation} aria-label="Staff navigation">
          {links.map(({ label, href, icon: Icon }) => {
            const active = pathname === href;
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} title={collapsed ? label : undefined} className={styles.staffNavLink} onClick={() => setSidebarOpen(false)}><Icon size={18} /><span>{collapsed ? null : label}</span></Link>;
          })}
        </nav>
        <SidebarCollapseButton className={styles.staffCollapseButton} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      </aside>
        <div className={`${styles.staffBody} ${focusStyles.body}`}><NavigationMenuButton className={`${styles.shellMobileMenu} ${focusStyles.mobileMenu}`} onOpen={() => setSidebarOpen(true)} />{showHeader && pathname !== routeHref("pos.transactions") && <div className={focusStyles.retract}><div className={focusStyles.retractInner}><StaffHeader focusMode={focusMode} onToggleFocus={pathname === routeHref("pos") ? () => { setFocusEnabled((value) => !value); setSidebarOpen(false); } : undefined} /></div></div>}<main className={styles.content}>{children}</main></div>
    </div>
    </FocusModeContext.Provider>
  );
}
