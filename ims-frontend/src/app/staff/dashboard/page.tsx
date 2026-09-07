import StaffDashboardLayout from "../../../components/staff-pos/StaffDashboardLayout";
import StaffPOSPage from "../../../components/staff-pos/StaffPOSPage";
import AuthGuard from "@/components/auth/AuthGuard";
export default function StaffDashboardPage() {
  return (
    <AuthGuard allowedRoles={["STAFF"]}>
      <StaffDashboardLayout>
      <StaffPOSPage />
    </StaffDashboardLayout>
    </AuthGuard>
  );
}