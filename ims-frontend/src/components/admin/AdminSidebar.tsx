"use client";

import Link from "next/link";
import SidebarAccount from "@/components/layout/SidebarAccount";
import AlertCountBadge from "@/components/layout/AlertCountBadge";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSidebarStore } from "@/store/sidebarStore";
import { ChevronDown } from "lucide-react";
import { NavigationOverlay, NavigationCloseButton, SidebarCollapseButton } from "@/components/layout/ShellControls";
import { adminNavigation, getVisibleNavigation, matchesShellRoute } from "@/components/layout/shell-navigation";
import { routeHref } from "@/lib/routing/routes";
import { useAuthStore } from "@/store/authStore";
import styles from "@/components/layout/ApplicationShell.module.css";

type AdminSidebarProps = { isOpen: boolean; onClose: () => void; collapsed: boolean; onToggleCollapse: () => void; className?: string; inert?: boolean };

export default function AdminSidebar({ isOpen, onClose, collapsed, onToggleCollapse, className = "", inert = false }: AdminSidebarProps) {
  const pathname = usePathname();
  const navigation = getVisibleNavigation(useAuthStore());
  const [selectedDropdown, setSelectedDropdown] = useState<{ href: string; path: string } | null>(null);
  const dropdownSelection = selectedDropdown?.path === pathname ? selectedDropdown.href : null;
  function navigate() {
    setSelectedDropdown(null);
    onClose();
  }
  function navigateMain() {
    useSidebarStore.getState().closeSections();
    navigate();
  }
  const sidebarRef = useRef<HTMLElement>(null);
  const openSections = useSidebarStore(state => state.openSections);
  const toggleSection = useSidebarStore(state => state.toggleSection);
  const expandSection = useSidebarStore(state => state.expandSection);
  useEffect(() => {
    const activeSection = adminNavigation.flatMap(group => group.items).find(item =>
      item.children && matchesShellRoute(pathname, item.href),
    );
    if (activeSection) expandSection(activeSection.href);
  }, [pathname, expandSection]);
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
      <NavigationOverlay open={isOpen} onClose={onClose} tabIndex={-1} />
      <aside id="admin-navigation" ref={sidebarRef} inert={inert} aria-label="Application navigation" className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""} ${collapsed ? styles.adminSidebarCollapsed : ""} ${className}`}>
        <div className={`${styles.brand} ${styles.brandWithAccount}`}>
          <div className={styles.sidebarBrandLogo}>
            <strong>{collapsed ? "CS" : "Cafe Salvacion"}</strong>
            {collapsed ? null : <p>Inventory Management</p>}
          </div>
          <NavigationCloseButton onClose={onClose} />
          <SidebarAccount collapsed={collapsed && !isOpen} onNavigate={navigateMain} />
        </div>
        <nav ref={restoreScroll} onScroll={event => setScrollTop(event.currentTarget.scrollTop)} className={styles.navigation}>
          {navigation.map(group => (
            <div key={group.label} className={styles.group}>
              {collapsed ? null : <h2 className={styles.groupTitle}>{group.label}</h2>}
              {group.items.map(item => (
                <div key={item.href} className={styles.navItemWrap}>
                  {item.children ? <button
                    type="button"
                    title={collapsed ? item.label : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    className={`${styles.navLink} ${styles.navToggle}`}
                    data-active={dropdownSelection === item.href || matchesShellRoute(pathname, item.href)}
                    aria-expanded={!collapsed && !!openSections[item.href]}
                    aria-controls={`sidebar-${item.label.toLowerCase()}`}
                    onClick={() => {
                      setSelectedDropdown({ href: item.href, path: pathname });
                      if (collapsed) {
                        onToggleCollapse();
                        expandSection(item.href);
                      } else {
                        toggleSection(item.href);
                      }
                    }}
                  >
                    <item.icon size={19} aria-hidden="true" />
                    {!collapsed && <><span>{item.label}</span><ChevronDown size={16} className={styles.navChevron} aria-hidden="true" /></>}
                  </button> : <Link href={item.href} title={collapsed ? item.label : undefined} onClick={navigateMain} className={styles.navLink} aria-current={!dropdownSelection && matchesShellRoute(pathname, item.href.split("#")[0]) ? "page" : undefined}>
                    <item.icon size={19} aria-hidden="true" /><span>{collapsed ? null : item.label}</span>
                    {item.href === routeHref("alerts") && <AlertCountBadge collapsed={collapsed} />}
                  </Link>}
                  {item.children ? <div id={`sidebar-${item.label.toLowerCase()}`} className={styles.navDropdown} hidden={collapsed || !openSections[item.href]}>
                    {(item.href === "/reports" ? item.children : [{ label: "Overview", href: item.href }, ...item.children]).map(child => <Link key={child.href} href={child.href} onClick={navigate} className={styles.navSubLink} aria-current={pathname === child.href ? "page" : undefined}>{child.label}</Link>)}
                  </div> : null}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <footer className={styles.footer}>{collapsed ? "CS" : "Cafe Salvacion IMS"}</footer>
        <SidebarCollapseButton className={styles.adminCollapseButton} collapsed={collapsed} onToggle={onToggleCollapse} />
      </aside>
    </>
  );
}
