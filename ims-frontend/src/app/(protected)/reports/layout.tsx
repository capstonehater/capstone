"use client";

import { usePathname } from "next/navigation";
import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import ReportsScopeSwitch from "@/components/admin/reports/ReportsScopeSwitch";
import { routeHref } from "@/lib/routing/routes";

export default function ReportsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const inventory = routeHref("reports.inventory");
  const pos = routeHref("reports.pos");
  const dedicatedReportPage = pathname === inventory || pathname === pos;

  return (
    <AdminDashboardLayout showHeader={pathname === inventory}>
      <div className="space-y-6">
        {!dedicatedReportPage && <AdminSectionHeader title="Admin Reports" description="Review stock health, purchasing costs, and sales performance for your selected period.">
          <div className="w-full max-w-3xl"><ReportsScopeSwitch /></div>
        </AdminSectionHeader>}
        {children}
      </div>
    </AdminDashboardLayout>
  );
}
