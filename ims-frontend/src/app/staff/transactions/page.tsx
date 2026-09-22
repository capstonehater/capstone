import AuthGuard from "@/components/auth/AuthGuard";
import StaffDashboardLayout from "@/components/staff-pos/StaffDashboardLayout";
import TransactionHistoryPage from "@/components/staff-pos/TransactionHistoryPage";

export default function StaffTransactionsPage() {
  return (
    <AuthGuard allowedRoles={["STAFF"]}>
      <StaffDashboardLayout>
        <TransactionHistoryPage />
      </StaffDashboardLayout>
    </AuthGuard>
  );
}
