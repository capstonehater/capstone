import AuthGuard from "@/components/auth/AuthGuard";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard allowedRoles={["ADMINISTRATOR"]}>
      {children}
    </AuthGuard>
  );
}
