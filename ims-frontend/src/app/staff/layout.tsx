import AuthGuard from "@/components/auth/AuthGuard";

export default function StaffLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AuthGuard allowedRoles={["STAFF"]}>{children}</AuthGuard>;
}
