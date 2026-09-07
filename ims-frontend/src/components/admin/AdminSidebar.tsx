"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  Boxes,
  Package2,
  FileText,
  Bell,
  UsersRound,
  Settings,
  X,
} from "lucide-react";

type AdminSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

const navItems = [
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Inventory",
    href: "/admin/inventory",
    icon: Boxes,
  },
  {
    label: "Products",
    href: "/admin/products",
    icon: Package2,
  },
  {
    label: "Reports",
    href: "/admin/reports",
    icon: FileText,
  },
  {
    label: "Alerts",
    href: "/admin/alerts",
    icon: Bell,
  },
  {
    label: "User",
    href: "/admin/users",
    icon: UsersRound,
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

export default function AdminSidebar({
  isOpen,
  onClose,
}: AdminSidebarProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col bg-[#f45a1f] text-white transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-white/20 px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[15px] font-bold uppercase leading-5 tracking-wide break-words">
                Inventory Management System
              </h1>
              <p className="mt-2 text-[11px] leading-4 text-white/80">
                Smart Inventory Management
              </p>
            </div>

            <button
              onClick={onClose}
              className="shrink-0 rounded-md p-1 hover:bg-white/10 lg:hidden"
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-2 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white no-underline transition hover:bg-white/15"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
