"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ClipboardList, LayoutDashboard, Menu, Settings, X } from "lucide-react";
import styles from "@/components/layout/ApplicationShell.module.css";
import StaffHeader from "./StaffHeader";

type StaffDashboardLayoutProps = {
  children: React.ReactNode;
};

export default function StaffDashboardLayout({
  children,
}: StaffDashboardLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const links = [
    { label: "POS Dashboard", href: "/staff/dashboard", icon: LayoutDashboard },
    { label: "Transaction History", href: "/staff/transactions", icon: ClipboardList },
    { label: "Account Settings", href: "/staff/settings", icon: Settings },
  ];

  return (
    <div className={`${styles.shell} ${collapsed ? styles.staffShellCollapsed : ""}`}>
      {sidebarOpen ? <button type="button" className={styles.overlay} aria-label="Close navigation" onClick={() => setSidebarOpen(false)} /> : null}
      <aside className={`${styles.staffSidebar} ${sidebarOpen ? styles.staffSidebarOpen : ""} ${collapsed ? styles.staffSidebarCollapsed : ""}`}>
        <div className={styles.staffBrand}><strong>{collapsed ? "CS" : "Cafe Salvacion"}</strong><button type="button" className={styles.mobileClose} onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={20} /></button></div>
        <nav className={styles.staffNavigation} aria-label="Staff navigation">
          {links.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href === "/staff/dashboard" && pathname === "/staff/pos");
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} title={collapsed ? label : undefined} className={styles.staffNavLink} onClick={() => setSidebarOpen(false)}><Icon size={18} /><span>{collapsed ? null : label}</span></Link>;
          })}
        </nav>
        <button type="button" className={styles.staffCollapseButton} onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}</button>
      </aside>
      <div className={styles.staffBody}><button type="button" className={styles.staffMobileMenu} onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><StaffHeader /><main className={styles.content}>{children}</main></div>
    </div>
  );
}
