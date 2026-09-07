"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDefaultRouteForRole, type Role } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";

type AuthGuardProps = {
  children: React.ReactNode;
  allowedRoles?: Role[];
};

export default function AuthGuard({
  children,
  allowedRoles,
}: AuthGuardProps) {
  const router = useRouter();
  const { status, isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (status === "loading") return;

    if (!isAuthenticated || !user) {
      router.replace("/login");
      return;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      router.replace(getDefaultRouteForRole(user.role));
    }
  }, [status, isAuthenticated, user, allowedRoles, router]);

  if (status === "loading") return null;
  if (!isAuthenticated || !user) return null;
  if (allowedRoles && !allowedRoles.includes(user.role)) return null;

  return <>{children}</>;
}
