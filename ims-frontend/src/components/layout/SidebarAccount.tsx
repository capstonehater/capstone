"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import ProfileAvatar from "@/components/auth/ProfileAvatar";
import { useLogout } from "@/hooks/useLogout";
import { useAuthStore } from "@/store/authStore";
import styles from "./ApplicationShell.module.css";

export default function SidebarAccount({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const user = useAuthStore(state => state.user);
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const settingsHref = user?.role === "STAFF" ? "/staff/settings" : user?.role === "MANAGER" ? "/manager/settings" : "/admin/settings";

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  return (
    <div ref={root} className={`${styles.sidebarAccount} ${collapsed ? styles.accountCollapsed : ""}`} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <button ref={trigger} type="button" className={styles.accountTrigger} aria-label="Open account menu" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <ProfileAvatar />
        <span className={styles.accountIdentity}><strong>{user?.name ?? "Account"}</strong><span>{user?.email ?? "Account settings"}</span></span>
        <ChevronDown size={16} className={styles.accountChevron} />
      </button>
      {open && <div className={styles.accountDropdown}>
        <Link href={settingsHref} onClick={() => { setOpen(false); onNavigate?.(); }}><Settings size={17} />Account Settings</Link>
        <button type="button" onClick={async () => { setOpen(false); await logout(); }}><LogOut size={17} />Logout</button>
      </div>}
    </div>
  );
}
