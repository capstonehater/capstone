"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { ChevronLeft, Menu, X } from "lucide-react";
import { getVisibleNavigation } from "@/components/layout/shell-navigation";
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
  const isPOSPage = pathname === "/staff/dashboard" || pathname === "/staff/pos";
  const focusMode = focusEnabled && isPOSPage;
  const links = getVisibleNavigation(useAuthStore()).flatMap(group => group.items).map(item =>
    item.authenticatedOnly ? {...item, href: "/staff/settings"} : item
  );

  return (
    <FocusModeContext.Provider value={{ focusMode, toggleFocusMode: () => { setFocusEnabled((value) => !value); setSidebarOpen(false); } }}>
    <div className={`${styles.shell} ${collapsed ? styles.staffShellCollapsed : ""} ${focusMode ? focusStyles.focusShell : ""}`}>
      {sidebarOpen ? <button type="button" className={styles.overlay} aria-label="Close navigation" onClick={() => setSidebarOpen(false)} /> : null}
      <aside inert={focusMode} className={`${styles.staffSidebar} ${focusStyles.sidebar} ${sidebarOpen ? styles.staffSidebarOpen : ""} ${collapsed ? styles.staffSidebarCollapsed : ""}`}>
        <div className={styles.staffBrand}><div className={styles.sidebarBrandLogo}><strong>{collapsed ? "CS" : "Cafe Salvacion"}</strong>{!collapsed && <p>POS Management</p>}</div><button type="button" className={styles.mobileClose} onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={20} /></button></div>
        <SidebarAccount collapsed={collapsed && !sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
        <nav className={styles.staffNavigation} aria-label="Staff navigation">
          {links.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href === "/staff/pos" && pathname === "/staff/dashboard");
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} title={collapsed ? label : undefined} className={styles.staffNavLink} onClick={() => setSidebarOpen(false)}><Icon size={18} /><span>{collapsed ? null : label}</span></Link>;
          })}
        </nav>
        <button type="button" className={styles.staffCollapseButton} onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}</button>
      </aside>
      <div className={`${styles.staffBody} ${focusStyles.body}`}><button type="button" className={`${styles.shellMobileMenu} ${focusStyles.mobileMenu}`} onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>{showHeader && !isPOSPage && pathname !== "/staff/transactions" && <div className={focusStyles.retract}><div className={focusStyles.retractInner}><StaffHeader /></div></div>}<main className={styles.content}>{children}</main></div>
    </div>
    </FocusModeContext.Provider>
  );
}
