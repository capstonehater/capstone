"use client";

import { useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";

type AdminDashboardLayoutProps = {
  children: React.ReactNode;
};

export default function AdminDashboardLayout({
  children,
}: AdminDashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#e9e1d6]">
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="lg:ml-[280px]">
        <div className="p-4 md:p-6">
          <AdminHeader onMenuClick={() => setSidebarOpen(true)} />
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
