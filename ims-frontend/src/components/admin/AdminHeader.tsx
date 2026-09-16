"use client";

import Link from "next/link";
import { adminNavigation, matchesShellRoute } from "@/components/layout/shell-navigation";
import styles from "@/components/layout/ApplicationShell.module.css";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Menu,
  Bell,
  User,
  Settings,
  Shield,
  LogOut,
  ChevronDown,
  AlertTriangle,
  CheckCheck,
  X,
} from "lucide-react";
import { acknowledgeAlert, dismissAlert, fetchAlerts, fetchUnreadAlertCount, type AlertRecord } from "@/lib/alerts";
import ProfileAvatar from "@/components/auth/ProfileAvatar";
import { useLogout } from "@/hooks/useLogout";
import { useAuthStore } from "@/store/authStore";

type AdminHeaderProps = {
  onMenuClick: () => void;
  sidebarOpen: boolean;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function alertTone(alert: AlertRecord) {
  if (alert.severity === "CRITICAL") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (alert.severity === "WARNING") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function AdminHeader({ onMenuClick, sidebarOpen }: AdminHeaderProps) {
  const pathname = usePathname();
  const page = adminNavigation.flatMap(group => group.items).find(item => matchesShellRoute(pathname, item.href));
  const user = useAuthStore((state) => state.user);
  const performLogout = useLogout();

  const [openDropdown, setOpenDropdown] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertActionId, setAlertActionId] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setOpenDropdown(false);
      }

      if (alertsRef.current && !alertsRef.current.contains(target)) {
        setAlertsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadAlerts = async () => {
      setAlertsLoading(true);
      try {
        const [nextAlerts, unread] = await Promise.all([
          fetchAlerts({ limit: 25 }),
          fetchUnreadAlertCount(),
        ]);

        if (!active) return;
        setAlerts(nextAlerts);
        setUnreadCount(unread.count);
      } catch {
        if (!active) return;
      } finally {
        if (active) {
          setAlertsLoading(false);
        }
      }
    };

    void loadAlerts();
    const interval = window.setInterval(() => {
      void loadAlerts();
    }, 30000);
    const handleFocus = () => {
      void loadAlerts();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const handleLogout = async () => {
    setOpenDropdown(false);
    await performLogout();
  };

  const handleAlertAction = async (
    alertId: string,
    action: "acknowledge" | "dismiss"
  ) => {
    setAlertActionId(alertId);
    try {
      if (action === "acknowledge") {
        await acknowledgeAlert(alertId);
      } else {
        await dismissAlert(alertId);
      }

      const [nextAlerts, unread] = await Promise.all([
        fetchAlerts({ limit: 25 }),
        fetchUnreadAlertCount(),
      ]);
      setAlerts(nextAlerts);
      setUnreadCount(unread.count);
    } finally {
      setAlertActionId(null);
    }
  };

  const formattedRole = user?.role
    ? user.role.replaceAll("_", " ")
    : "Administrator";

  return (
    <header className={styles.header}>
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className={`${styles.iconButton} ${styles.mobileMenu}`}
          aria-expanded={sidebarOpen}
          aria-controls="admin-navigation"
          aria-label="Open sidebar"
        >
          <Menu size={22} />
        </button>

        <div>
          <h1 className={styles.title}>
            {page?.label.toUpperCase() ?? "CAFE SALVACION"}
          </h1>
          <p className={styles.subtitle}>
            {page?.subtitle ?? "Inventory management"}
          </p>
        </div>
      </div>

      <div className={styles.actions}>
        <div className="relative" ref={alertsRef}>
          <button
            onClick={() => setAlertsOpen((current) => !current)}
            className={styles.iconButton}
            aria-expanded={alertsOpen}
            aria-label="Open alerts"
          >
            <Bell size={20} />
            {unreadCount > 0 ? (
              <span className={styles.badge}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>

          {alertsOpen ? (
            <div className={styles.alertPanel}>
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Operational Alerts</p>
                  <p className="text-xs text-gray-500">
                    {unreadCount} unread alert{unreadCount === 1 ? "" : "s"}
                  </p>
                </div>
                <Link
                  href="/admin/alerts"
                  onClick={() => setAlertsOpen(false)}
                  className="text-xs font-semibold text-[#f45a1f]"
                >
                  View all
                </Link>
              </div>

              <div className="max-h-[26rem] space-y-3 overflow-y-auto p-4">
                {alertsLoading ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Loading alerts...
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    No alerts to review right now.
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`rounded-2xl border p-4 ${alertTone(alert)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="mt-0.5 h-4 w-4" />
                          <div>
                            <p className="font-semibold">{alert.title}</p>
                            <p className="mt-1 text-xs opacity-90">{alert.message}</p>
                            <p className="mt-2 text-[11px] uppercase tracking-wide opacity-75">
                              {alert.type.replaceAll("_", " ")} • {alert.severity}
                            </p>
                            <p className="mt-1 text-[11px] opacity-75">
                              Triggered {formatDateTime(alert.lastTriggeredAt)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end gap-2">
                        {alert.state === "ACTIVE" || alert.state === "DISMISSED" ? (
                          <button
                            type="button"
                            disabled={alertActionId === alert.id}
                            onClick={() => void handleAlertAction(alert.id, "acknowledge")}
                            className="inline-flex items-center gap-1 rounded-xl border border-current/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/40 disabled:opacity-60"
                          >
                            <CheckCheck className="h-3.5 w-3.5" />
                            Mark as Read
                          </button>
                        ) : null}
                        {alert.state === "ACTIVE" ? (
                          <button
                            type="button"
                            disabled={alertActionId === alert.id}
                            onClick={() => void handleAlertAction(alert.id, "dismiss")}
                            className="inline-flex items-center gap-1 rounded-xl border border-current/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/40 disabled:opacity-60"
                          >
                            <X className="h-3.5 w-3.5" />
                            Dismiss
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpenDropdown((prev) => !prev)}
            className={styles.profile}
            aria-label="Open account menu"
            aria-expanded={openDropdown}
          >
            <div className={styles.identity}>
              <p className={styles.role}>{formattedRole.toLowerCase()}</p>
              <p className={styles.email}>{user?.email ?? "Account"}</p>
            </div>

            <ProfileAvatar />

            <ChevronDown
              size={18}
              className={`transition-transform ${openDropdown ? "rotate-180" : ""}`}
            />
          </button>

          {openDropdown && (
            <div className="absolute right-0 top-full z-50 mt-3 w-56 overflow-hidden rounded-2xl bg-white py-2 text-[#3d3434] shadow-xl">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-semibold">
                  {user?.email ?? "Account"}
                </p>
                <p className="text-xs text-gray-500">{formattedRole} Account</p>
              </div>

              <Link
                href="/admin/settings"
                onClick={() => setOpenDropdown(false)}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[#3d3434] no-underline hover:bg-gray-50"
              >
                <User size={18} />
                <span>My Profile</span>
              </Link>

              <Link
                href="/admin/settings"
                onClick={() => setOpenDropdown(false)}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[#3d3434] no-underline hover:bg-gray-50"
              >
                <Settings size={18} />
                <span>Account Settings</span>
              </Link>

              <Link
                href="/admin/settings#security"
                onClick={() => setOpenDropdown(false)}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[#3d3434] no-underline hover:bg-gray-50"
              >
                <Shield size={18} />
                <span>Privacy & Security</span>
              </Link>

              <div className="my-1 border-t border-gray-100" />

              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
