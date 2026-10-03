import AdminDashboardLayout from '@/components/admin/AdminDashboardLayout';
import RolesWorkspace from '@/components/admin/roles/RolesWorkspace';
export default function RolesFeature() {
  return <AdminDashboardLayout showHeader={false}><RolesWorkspace /></AdminDashboardLayout>;
}
