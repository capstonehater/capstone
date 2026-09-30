import AuthGuard from "@/components/auth/AuthGuard";
import NoAccess from "@/components/auth/NoAccess";

export default function NoAccessPage() {
  return <AuthGuard><NoAccess /></AuthGuard>;
}
