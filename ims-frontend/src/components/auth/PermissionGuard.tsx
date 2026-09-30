"use client";

import type { ReactNode } from "react";
import { useAuthStore } from "@/store/authStore";
import NoAccess from "./NoAccess";

type Props = { children: ReactNode; fallback?: ReactNode } & (
  { permission: string; permissions?: never } | { permissions: string[]; permission?: never }
);

// UI control only. Every API continues to enforce its existing backend authorization.
export default function PermissionGuard({ children, permission, permissions, fallback = <NoAccess /> }: Props) {
  const allowed = useAuthStore(state => permission !== undefined ? state.can(permission) : state.canAll(permissions ?? []));
  return <>{allowed ? children : fallback}</>;
}

export function PermissionAction(props: Props) {
  return <PermissionGuard {...props} fallback={null} />;
}
