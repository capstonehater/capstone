import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";

export default function RecommendationsPage() {
  return (
    <AdminDashboardLayout>
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Recommendations</h1>
        <p className="mt-2 text-neutral-600">
          AI-driven store recommendations and geolocation page coming next.
        </p>
      </div>
    </AdminDashboardLayout>
  );
}