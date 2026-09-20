"use client";

import styles from "@/components/layout/ApplicationShell.module.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ProfileAvatar from "@/components/auth/ProfileAvatar";
import { useLogout } from "@/hooks/useLogout";
import {
  Bell,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";

export default function StaffHeader() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const performLogout = useLogout();

  const [openDropdown, setOpenDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpenDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    setOpenDropdown(false);
    await performLogout();
  };

  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.title}>
          {pathname === "/staff/pos" ? "STAFF POS" : "STAFF DASHBOARD"}
        </h1>
        <p className={styles.subtitle}>
          Welcome back! Here’s your POS and daily transaction overview.
        </p>
      </div>

      <div className={styles.actions}>
        <button type="button" disabled className={styles.iconButton} aria-label="Staff notifications unavailable" title="Staff notifications are not available">
          <Bell size={20} />
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpenDropdown((prev) => !prev)}
            className={styles.profile}
            aria-label="Open account menu"
            aria-expanded={openDropdown}
          >
            <div className={styles.identity}>
              <p className={styles.role}>{user?.name ?? "Staff"}</p>
              <p className={styles.email}>{user?.email ?? "Account"}</p>
            </div>

            <ProfileAvatar />

            <ChevronDown
              size={18}
              className={`transition-transform ${
                openDropdown ? "rotate-180" : ""
              }`}
            />
          </button>

          {openDropdown && (
            <div className="absolute right-0 top-full z-50 mt-3 w-56 overflow-hidden rounded-2xl bg-white py-2 text-[#3d3434] shadow-xl">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-semibold">
                  {user?.name ?? "Account"}
                </p>
                <p className="text-xs text-gray-500">{user?.email ?? "Account"}</p>
              </div>

              <Link href="/staff/settings" onClick={() => setOpenDropdown(false)} className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[#3d3434] no-underline hover:bg-gray-50">
                <Settings size={18} />
                <span>Account Settings</span>
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
