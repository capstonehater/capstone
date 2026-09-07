"use client";

import { useEffect, useRef, useState } from "react";
import { useLogout } from "@/hooks/useLogout";
import {
  Bell,
  CircleUserRound,
  User,
  Settings,
  Shield,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";

export default function StaffHeader() {
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
    <header className="flex flex-col gap-4 rounded-2xl bg-[#f45a1f] px-4 py-4 text-white shadow-sm md:flex-row md:items-center md:justify-between md:px-6">
      <div>
        <h1 className="text-2xl font-bold leading-tight md:text-3xl">
          STAFF DASHBOARD
        </h1>
        <p className="text-sm text-white/85">
          Welcome back! Here’s your POS and daily transaction overview.
        </p>
      </div>

      <div className="flex items-center justify-end gap-4">
        <button className="relative rounded-full p-2 transition hover:bg-white/10">
          <Bell size={20} />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-yellow-300" />
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpenDropdown((prev) => !prev)}
            className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white/10"
          >
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">
                {user?.email ?? "staff@stockscout.com"}
              </p>
              <p className="text-xs text-white/80">Staff</p>
            </div>

            <div className="rounded-full bg-[#e9e1d6] p-2 text-[#3d3434]">
              <CircleUserRound size={24} />
            </div>

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
                  {user?.email ?? "staff@stockscout.com"}
                </p>
                <p className="text-xs text-gray-500">Staff Account</p>
              </div>

              <button className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50">
                <User size={18} />
                <span>My Profile</span>
              </button>

              <button className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50">
                <Settings size={18} />
                <span>Account Settings</span>
              </button>

              <button className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50">
                <Shield size={18} />
                <span>Privacy & Security</span>
              </button>

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
