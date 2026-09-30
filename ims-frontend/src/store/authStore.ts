import { create } from "zustand";
import type { AssignedAuthRole, AuthUser } from "@/lib/auth";
type AuthStatus = "loading" | "authenticated" | "unauthenticated";
type AuthState = {
  user: AuthUser | null;
  roles: AssignedAuthRole[];
  effectivePermissions: string[];
  authorizationRevision: string | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  hasInitialized: boolean;
  setLoading: () => void;
  setAuthenticated: (user: AuthUser) => void;
  setUnauthenticated: () => void;
  logout: () => void;
  can: (permission: string) => boolean;
  canAll: (permissions: readonly string[]) => boolean;
};
const cleared = { user: null, roles: [], effectivePermissions: [], authorizationRevision: null, status: "unauthenticated" as const, isAuthenticated: false, hasInitialized: true };
export const useAuthStore = create<AuthState>((set, get) => ({
  ...cleared, status: "loading", hasInitialized: false,
  setLoading: () => set({ status: "loading" }),
  setAuthenticated: (user) => set((state) => {
    // Existing same-account profile updates contain only legacy identity fields.
    const sameAccount = state.user?.id === user.id && state.user?.role === user.role;
    const roles = user.roles ?? (sameAccount ? state.roles : []);
    const effectivePermissions = [...new Set(user.effectivePermissions ?? (sameAccount ? state.effectivePermissions : []))];
    const authorizationRevision = user.authorizationRevision !== undefined ? user.authorizationRevision : sameAccount ? state.authorizationRevision : null;
    return { user: { ...user, roles, effectivePermissions, authorizationRevision }, roles, effectivePermissions, authorizationRevision, status: "authenticated", isAuthenticated: true, hasInitialized: true };
  }),
  setUnauthenticated: () => set(cleared),
  logout: () => set(cleared),
  // UX helpers only. Backend guards remain the security boundary.
  can: (permission) => get().status === "authenticated" && get().isAuthenticated && get().effectivePermissions.includes(permission),
  canAll: (permissions) => get().status === "authenticated" && get().isAuthenticated && permissions.every((permission) => get().effectivePermissions.includes(permission)),
}));
