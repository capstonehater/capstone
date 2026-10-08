"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/auth";
import NoAccess from "./NoAccess";
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


  }, [status, isAuthenticated, user, allowedRoles, router]);

  if (status === "loading") return null;
  if (!isAuthenticated || !user) return null;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <NoAccess />;

  return <>{children}</>;
}
