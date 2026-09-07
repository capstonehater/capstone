"use client";

import StaffHeader from "./StaffHeader";

type StaffDashboardLayoutProps = {
  children: React.ReactNode;
};

export default function StaffDashboardLayout({
  children,
}: StaffDashboardLayoutProps) {
  return (
    <main className="min-h-screen bg-[#e9e1d6]">
      <div className="p-4 md:p-6">
        <StaffHeader />
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}