import AuthGuard from "@/components/auth/AuthGuard";
import PermissionRoute from "@/components/auth/PermissionRoute";
export default function ProtectedRoutesLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard><PermissionRoute>{children}</PermissionRoute></AuthGuard>;
}
