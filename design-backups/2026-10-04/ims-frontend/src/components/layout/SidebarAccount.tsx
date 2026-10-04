"use client";

import ProfileAvatar from "@/components/auth/ProfileAvatar";
import { useAuthStore } from "@/store/authStore";
import styles from "./ApplicationShell.module.css";

export default function SidebarAccount({ collapsed = false }: { collapsed?: boolean; onNavigate?: () => void }) {
  const user = useAuthStore(state => state.user);
  return <div className={`${styles.sidebarAccount} ${collapsed ? styles.accountCollapsed : ""}`}>
    <div className={styles.accountTrigger}>
      <ProfileAvatar />
      <span className={styles.accountIdentity}><strong>{user?.name ?? "Account"}</strong><span>{user?.email ?? "My Account"}</span></span>
    </div>
  </div>;
}
