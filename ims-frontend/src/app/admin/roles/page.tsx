import AdminDashboardLayout from '@/components/admin/AdminDashboardLayout';
import RolesWorkspace from '@/components/admin/roles/RolesWorkspace';
export default function RolesPage() {
  return <AdminDashboardLayout showHeader={false}><RolesWorkspace /></AdminDashboardLayout>;
}
