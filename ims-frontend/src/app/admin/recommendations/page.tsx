import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";

export default function RecommendationsPage() {
  return (
    <AdminDashboardLayout showHeader={false}>
      <AdminSectionHeader title="Recommendations" description="AI-driven store recommendations and geolocation page coming next." />
    </AdminDashboardLayout>
  );
}