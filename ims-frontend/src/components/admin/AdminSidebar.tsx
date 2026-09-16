"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { adminNavigation, matchesShellRoute } from "@/components/layout/shell-navigation";
import styles from "@/components/layout/ApplicationShell.module.css";

type AdminSidebarProps = { isOpen: boolean; onClose: () => void };

export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLElement>(null);

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
      <aside id="admin-navigation" ref={sidebarRef} aria-label="Administrator navigation" className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.brand}>
          <div><strong>Cafe Salvacion</strong><p>POS Management</p></div>
          <button type="button" onClick={onClose} className={styles.mobileClose} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <nav className={styles.navigation}>
          {adminNavigation.map(group => (
            <div key={group.label} className={styles.group}>
              <h2 className={styles.groupTitle}>{group.label}</h2>
              {group.items.map(item => (
                <div key={item.href} className={styles.navItemWrap}>
                  <Link href={item.href} onClick={onClose} className={styles.navLink} aria-current={matchesShellRoute(pathname, item.href.split("#")[0]) ? "page" : undefined}>
                    <item.icon size={19} aria-hidden="true" /><span>{item.label}</span>
                  </Link>
                </div>
              ))}
            </div>
          ))}
        </nav>
        <footer className={styles.footer}>Cafe Salvacion IMS</footer>
      </aside>
    </>
  );
}
