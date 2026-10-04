"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { ChevronDown, ChevronLeft, Menu, X } from "lucide-react";
import { getVisibleNavigation } from "@/components/layout/shell-navigation";
import { useAuthStore } from "@/store/authStore";
import styles from "@/components/layout/ApplicationShell.module.css";
import StaffHeader from "./StaffHeader";
import SidebarAccount from "@/components/layout/SidebarAccount";
import AlertCountBadge from "@/components/layout/AlertCountBadge";
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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const isPOSPage = pathname === "/staff/dashboard" || pathname === "/staff/pos";
  const focusMode = focusEnabled && isPOSPage;
  const navigation = getVisibleNavigation(useAuthStore()).map(group => ({
    ...group,
    items: group.items.map(item =>
      item.authenticatedOnly ? { ...item, href: "/staff/settings" } : item,
    ),
  }));

  return (
    <FocusModeContext.Provider value={{ focusMode, toggleFocusMode: () => { setFocusEnabled((value) => !value); setSidebarOpen(false); } }}>
    <div className={`${styles.shell} ${collapsed ? styles.staffShellCollapsed : ""} ${focusMode ? focusStyles.focusShell : ""}`}>
      {sidebarOpen ? <button type="button" className={styles.overlay} aria-label="Close navigation" onClick={() => setSidebarOpen(false)} /> : null}
      <aside inert={focusMode} className={`${styles.staffSidebar} ${focusStyles.sidebar} ${sidebarOpen ? styles.staffSidebarOpen : ""} ${collapsed ? styles.staffSidebarCollapsed : ""}`}>
        <div className={styles.staffBrand}><div className={styles.sidebarBrandLogo}><strong>{collapsed ? "CS" : "Cafe Salvacion"}</strong>{!collapsed && <p>POS Management</p>}</div><button type="button" className={styles.mobileClose} onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={20} /></button></div>
        <SidebarAccount collapsed={collapsed && !sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
        <nav className={styles.staffNavigation} aria-label="Staff navigation">
          {navigation.map(group => <div key={group.label} className={styles.staffNavGroup}>
            {!collapsed && <h2 className={styles.staffGroupTitle}>{group.label}</h2>}
            {group.items.map(({ label, href, icon: Icon, children }) => {
              const active = pathname === href || (href === "/staff/pos" && pathname === "/staff/dashboard");
              const childActive = children?.some(child => pathname === child.href || pathname.startsWith(`${child.href}/`)) ?? false;
              if (children?.length) return <div key={href}>
                <button type="button" aria-expanded={!collapsed && !!openSections[href]} aria-label={collapsed ? label : undefined} title={collapsed ? label : undefined} className={`${styles.staffNavLink} ${styles.staffNavToggle}`} data-active={childActive} onClick={() => {
                  if (collapsed) setCollapsed(false);
                  setOpenSections(current => ({ ...current, [href]: !current[href] }));
                }}>
                  <Icon size={18} /><span>{collapsed ? null : label}</span>{!collapsed && <ChevronDown size={16} className={styles.staffNavChevron} aria-hidden="true" />}
                </button>
                {!collapsed && <div className={styles.staffNavSubmenu} hidden={!openSections[href]}>
                  {children.map(child => <Link key={child.href} href={child.href} aria-current={pathname === child.href ? "page" : undefined} className={styles.staffNavSubLink} onClick={() => setSidebarOpen(false)}>{child.label}</Link>)}
                </div>}
              </div>;
              return <Link key={href} href={href} aria-current={active ? "page" : undefined} title={collapsed ? label : undefined} className={styles.staffNavLink} onClick={() => setSidebarOpen(false)}><Icon size={18} /><span>{collapsed ? null : label}</span>{href === "/admin/alerts" && <AlertCountBadge collapsed={collapsed} />}</Link>;
            })}
          </div>)}
        </nav>
        <button type="button" className={styles.staffCollapseButton} onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}</button>
      </aside>
      <div className={`${styles.staffBody} ${focusStyles.body}`}><button type="button" className={`${styles.shellMobileMenu} ${focusStyles.mobileMenu}`} onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>{showHeader && !isPOSPage && pathname !== "/staff/transactions" && <div className={focusStyles.retract}><div className={focusStyles.retractInner}><StaffHeader /></div></div>}<main className={styles.content}>{children}</main></div>
    </div>
    </FocusModeContext.Provider>
  );
}
