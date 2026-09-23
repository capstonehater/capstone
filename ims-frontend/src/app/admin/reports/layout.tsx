"use client";

import { usePathname } from "next/navigation";
import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import ReportsScopeSwitch from "@/components/admin/reports/ReportsScopeSwitch";

export default function ReportsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const dedicatedReportPage = pathname === "/admin/reports/inventory" || pathname === "/admin/reports/pos";
  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
        {!dedicatedReportPage && <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#f45a1f]">
                Reports Workspace
              </p>
              <h1 className="mt-2 text-2xl font-bold text-neutral-900">Admin Reports</h1>
              <p className="mt-2 max-w-3xl text-sm text-neutral-600">
                Switch between inventory reporting and the new POS reporting workspace without
                changing the underlying backend calculations.
              </p>
            </div>

            <div className="w-full max-w-3xl">
              <ReportsScopeSwitch />
            </div>
          </div>
        </section>}

        {children}
      </div>
    </AdminDashboardLayout>
  );
}
