"use client";

import { useEffect, useState } from "react";
import { fetchUnreadAlertCount } from "@/lib/alerts";
import { useAuthStore } from "@/store/authStore";
import styles from "./AlertCountBadge.module.css";

export default function AlertCountBadge({ collapsed = false }: { collapsed?: boolean }) {
  const userId = useAuthStore(state => state.user?.id);
  const canViewAlerts = useAuthStore(state => state.can("alerts.view"));
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!userId || !canViewAlerts) return;
    let active = true;
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const result = await fetchUnreadAlertCount();
        if (active) setCount(result.count);
      } catch { /* Retry on the next refresh; keep the last known count. */ }
      finally { pending = false; }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("alerts-updated", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("alerts-updated", refresh);
    };
  }, [userId, canViewAlerts]);
  if (!userId || !canViewAlerts || count < 1) return null;
  return <span className={`${styles.badge} ${collapsed ? styles.collapsed : ""}`} aria-label={`${count} unread notifications`} title={`${count} unread notifications`}>{count > 99 ? "99+" : count}</span>;
}
