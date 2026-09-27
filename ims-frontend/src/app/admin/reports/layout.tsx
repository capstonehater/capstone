"use client";

import { usePathname } from "next/navigation";
import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import styles from "@/components/admin/reports/ReportsHeader.module.css";
import ReportsScopeSwitch from "@/components/admin/reports/ReportsScopeSwitch";

export default function ReportsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const dedicatedReportPage = pathname === "/admin/reports/inventory" || pathname === "/admin/reports/pos";
  return (
    <AdminDashboardLayout showHeader={pathname === "/admin/reports/inventory"}>
      <div className="space-y-6">
        {!dedicatedReportPage && <section className={styles.header}>
          <div className={styles.headerContent}>
            <div>
              <p className={styles.eyebrow}>
                Reports Workspace
              </p>
              <h1 className="mt-2 text-2xl font-bold text-neutral-900">Admin Reports</h1>
              <p className="mt-2 max-w-3xl text-sm text-neutral-600">
                Review stock health, purchasing costs, and sales performance for your selected period.
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
