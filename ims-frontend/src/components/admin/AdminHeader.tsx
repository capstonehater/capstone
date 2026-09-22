"use client";

import Link from "next/link";
import { adminNavigation, matchesShellRoute } from "@/components/layout/shell-navigation";
import styles from "@/components/layout/ApplicationShell.module.css";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Menu,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import ProfileAvatar from "@/components/auth/ProfileAvatar";
import { useLogout } from "@/hooks/useLogout";
import { useAuthStore } from "@/store/authStore";

type AdminHeaderProps = {
  onMenuClick: () => void;
  sidebarOpen: boolean;
};

export default function AdminHeader({ onMenuClick, sidebarOpen }: AdminHeaderProps) {
  const pathname = usePathname();
  const page = adminNavigation.flatMap(group => group.items).find(item => matchesShellRoute(pathname, item.href));
  const user = useAuthStore((state) => state.user);
  const settingsHref = user?.role === "MANAGER" ? "/manager/settings" : "/admin/settings";
  const performLogout = useLogout();

  const [openDropdown, setOpenDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
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
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpenDropdown((prev) => !prev)}
            className={styles.profile}
            aria-label="Open account menu"
            aria-expanded={openDropdown}
          >
            <div className={styles.identity}>
              <p className={styles.role}>{user?.name ?? formattedRole}</p>
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
                  {user?.name ?? "Account"}
                </p>
                <p className="text-xs text-gray-500">{user?.email ?? "Account"}</p>
              </div>

              <Link
                href={settingsHref}
                onClick={() => setOpenDropdown(false)}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[#3d3434] no-underline hover:bg-gray-50"
              >
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
