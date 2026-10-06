import "bootstrap/dist/css/bootstrap.min.css";
import PermissionRoute from "@/components/auth/PermissionRoute";
import AuthGuard from "@/components/auth/AuthGuard";

export default function StaffLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AuthGuard><PermissionRoute>{children}</PermissionRoute></AuthGuard>;
}
