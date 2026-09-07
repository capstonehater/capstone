"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Menu,
  Bell,
  CircleUserRound,
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
import { useLogout } from "@/hooks/useLogout";
import { useAuthStore } from "@/store/authStore";

type AdminHeaderProps = {
  onMenuClick: () => void;
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

export default function AdminHeader({ onMenuClick }: AdminHeaderProps) {
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
    <header className="flex flex-col gap-4 rounded-2xl bg-[#f45a1f] px-4 py-4 text-white shadow-sm md:flex-row md:items-center md:justify-between md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 hover:bg-white/10 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu size={22} />
        </button>

        <div>
          <h1 className="text-2xl font-bold leading-tight md:text-3xl">
            DASHBOARD
          </h1>
          <p className="text-sm text-white/85">
            Welcome back! Here&apos;s your inventory overview.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-4">
        <div className="relative" ref={alertsRef}>
          <button
            onClick={() => setAlertsOpen((current) => !current)}
            className="relative rounded-full p-2 transition hover:bg-white/10"
            aria-label="Open alerts"
          >
            <Bell size={20} />
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-yellow-300 px-1 text-[10px] font-bold text-slate-900">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>

          {alertsOpen ? (
            <div className="absolute right-0 top-full z-50 mt-3 w-[25rem] overflow-hidden rounded-2xl bg-white text-[#3d3434] shadow-xl">
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
            className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white/10"
          >
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">
                {user?.email ?? "admin@stockscout.com"}
              </p>
              <p className="text-xs text-white/80">{formattedRole}</p>
            </div>

            <div className="rounded-full bg-[#e9e1d6] p-2 text-[#3d3434]">
              <CircleUserRound size={24} />
            </div>

            <ChevronDown
              size={18}
              className={`transition-transform ${openDropdown ? "rotate-180" : ""}`}
            />
          </button>

          {openDropdown && (
            <div className="absolute right-0 top-full z-50 mt-3 w-56 overflow-hidden rounded-2xl bg-white py-2 text-[#3d3434] shadow-xl">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-semibold">
                  {user?.email ?? "admin@stockscout.com"}
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
