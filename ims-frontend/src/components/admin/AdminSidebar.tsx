"use client";

import Link from "next/link";
import SidebarAccount from "@/components/layout/SidebarAccount";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { useSidebarStore } from "@/store/sidebarStore";
import { ChevronDown, ChevronLeft, Menu, X } from "lucide-react";
import { adminNavigation, materialActions, matchesShellRoute } from "@/components/layout/shell-navigation";
import styles from "@/components/layout/ApplicationShell.module.css";

type AdminSidebarProps = { isOpen: boolean; onClose: () => void; collapsed: boolean; onToggleCollapse: () => void };

export default function AdminSidebar({ isOpen, onClose, collapsed, onToggleCollapse }: AdminSidebarProps) {
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLElement>(null);
  const materialsOpen = useSidebarStore(state => state.materialsOpen);
  const toggleMaterials = useSidebarStore(state => state.toggleMaterials);
  const openSections = useSidebarStore(state => state.openSections);
  const toggleSection = useSidebarStore(state => state.toggleSection);
  const expandSection = useSidebarStore(state => state.expandSection);
  const setScrollTop = useSidebarStore(state => state.setScrollTop);
  const restoreScroll = useCallback((node: HTMLElement | null) => {
    if (node) node.scrollTop = useSidebarStore.getState().scrollTop;
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    if (!isOpen || desktop.matches) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const nodes = sidebarRef.current?.querySelectorAll<HTMLElement>("a[href], button");
      if (!nodes?.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const handleResize = () => { if (desktop.matches) onClose(); };
    desktop.addEventListener("change", handleResize);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      desktop.removeEventListener("change", handleResize);
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && <button type="button" className={styles.overlay} onClick={onClose} aria-label="Close navigation" tabIndex={-1} />}
      <aside id="admin-navigation" ref={sidebarRef} aria-label="Administrator navigation" className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""} ${collapsed ? styles.adminSidebarCollapsed : ""}`}>
        <div className={`${styles.brand} ${styles.brandWithAccount}`}>
          <div className={styles.sidebarBrandLogo}>
            <strong>{collapsed ? "CS" : "Cafe Salvacion"}</strong>
            {collapsed ? null : <p>POS Management</p>}
          </div>
          <button type="button" onClick={onClose} className={styles.mobileClose} aria-label="Close navigation"><X size={20} /></button>
          <SidebarAccount collapsed={collapsed && !isOpen} onNavigate={onClose} />
        </div>
        <nav ref={restoreScroll} onScroll={event => setScrollTop(event.currentTarget.scrollTop)} className={styles.navigation}>
          {adminNavigation.map(group => (
            <div key={group.label} className={styles.group}>
              {collapsed ? null : <h2 className={styles.groupTitle}>{group.label}</h2>}
              {group.items.map(item => (
                <div key={item.href} className={styles.navItemWrap}>
                  {item.children ? <div className={styles.navSplitRow}>
                    <Link href={item.href} title={collapsed ? item.label : undefined} className={styles.navLink} onClick={() => { expandSection(item.href); onClose(); }} aria-current={pathname === item.href ? "page" : undefined}>
                      <item.icon size={19} aria-hidden="true" />{!collapsed && <span>{item.label}</span>}
                    </Link>
                    {!collapsed && <button type="button" className={styles.navArrowToggle} aria-label={`${openSections[item.href] ? "Collapse" : "Expand"} ${item.label} submenu`} aria-expanded={!!openSections[item.href]} aria-controls={`sidebar-${item.label.toLowerCase()}`} onClick={() => toggleSection(item.href)}><ChevronDown size={16} className={styles.navChevron} aria-hidden="true" /></button>}
                  </div> : <Link href={item.href} title={collapsed ? item.label : undefined} onClick={onClose} className={styles.navLink} aria-current={matchesShellRoute(pathname, item.href.split("#")[0]) ? "page" : undefined}>
                    <item.icon size={19} aria-hidden="true" /><span>{collapsed ? null : item.label}</span>
                  </Link>}
                  {item.children ? <div id={`sidebar-${item.label.toLowerCase()}`} className={styles.navDropdown} hidden={collapsed || !openSections[item.href]}>
                    {[{ label: "Overview", href: item.href }, ...item.children].map(child => child.href === "/admin/inventory/materials" ? <div key={child.href}>
                      <div className={styles.navSplitRow}><Link href={child.href} onClick={onClose} className={styles.navSubLink} aria-current={pathname === child.href ? "page" : undefined}>{child.label}</Link><button type="button" className={styles.navArrowToggle} aria-label={materialsOpen ? "Collapse Materials actions" : "Expand Materials actions"} aria-expanded={materialsOpen} aria-controls="materials-actions" onClick={toggleMaterials}><ChevronDown size={14} className={styles.navChevron} /></button></div>
                      <div id="materials-actions" className={styles.materialActions} hidden={!materialsOpen}>{materialActions.map(action => <Link key={action.href} href={action.href} onClick={onClose} className={styles.navSubLink} aria-current={pathname === action.href ? "page" : undefined}>{action.label}</Link>)}</div>
                    </div> : <Link key={child.href} href={child.href} onClick={onClose} className={styles.navSubLink} aria-current={pathname === child.href ? "page" : undefined}>{child.label}</Link>)}
                  </div> : null}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <footer className={styles.footer}>{collapsed ? "CS" : "Cafe Salvacion IMS"}</footer>
        <button type="button" className={styles.adminCollapseButton} onClick={onToggleCollapse} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}</button>
      </aside>
    </>
  );
}
