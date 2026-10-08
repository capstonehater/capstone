"use client";
import { usePathname, useSearchParams } from "next/navigation";
import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import StaffDashboardLayout from "@/components/staff-pos/StaffDashboardLayout";
import PageSkeleton, { type SkeletonPage } from "@/components/loading/PageSkeleton";

export default function WorkspaceLoading({ page, contentOnly = false }: { page?: SkeletonPage; contentOnly?: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const segment = pathname.split("/").filter(Boolean).at(-1);
  const known: SkeletonPage[] = ["dashboard", "inventory", "products", "users", "roles", "suppliers", "alerts", "forecasting", "settings", "pos", "transactions", "reports"];
  const selected = page ?? (pathname.includes("/reports") ? "reports" : known.includes(segment as SkeletonPage) ? segment as SkeletonPage : "inventory");
  const skeleton = <PageSkeleton page={selected} />;
  if (contentOnly) return skeleton;
  if (selected === "pos" || selected === "transactions") return <StaffDashboardLayout showHeader={false}>{skeleton}</StaffDashboardLayout>;
  return <AdminDashboardLayout showHeader={false} whiteTop={selected === "dashboard"}>{params.get("view") === "stock-runs" && selected === "inventory" ? <PageSkeleton page="transactions" /> : skeleton}</AdminDashboardLayout>;
}
