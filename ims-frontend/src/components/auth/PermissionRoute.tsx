"use client";

import { Fragment, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { getRouteAccess } from "@/components/layout/shell-navigation";
import NoAccess from "./NoAccess";

export default function PermissionRoute({ children }: { children: ReactNode }) {
  const auth = useAuthStore();
  const pathname = usePathname();
  if (!getRouteAccess(pathname, auth)) return <NoAccess />;
  // Discard open dialogs and feature data when the backend authorization snapshot changes.
  return <Fragment key={`${auth.user?.id}:${auth.user?.role}:${auth.authorizationRevision}:${auth.effectivePermissions.join(",")}`}>{children}</Fragment>;
}
