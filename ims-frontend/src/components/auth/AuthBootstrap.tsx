"use client";
import { useEffect } from "react";
import { AuthSessionError, fetchCurrentUser } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";

export default function AuthBootstrap() {
  useEffect(() => {
    let active = true;
    let inFlight = false;
    let lastRefresh = 0;
    const refresh = async (initial = false) => {
      const before = useAuthStore.getState();
      if (inFlight || (!initial && (!before.isAuthenticated || Date.now() - lastRefresh < 5000))) return;
      inFlight = true; lastRefresh = Date.now();
      try {
        const user = await fetchCurrentUser();
        const now = useAuthStore.getState();
        // Do not let an older request undo logout, a new login, or a profile update.
        if (active && now.user === before.user && now.status === before.status) now.setAuthenticated({
          ...user, roles: user.roles ?? [], effectivePermissions: user.effectivePermissions ?? [], authorizationRevision: user.authorizationRevision ?? null,
        });
      } catch (error) {
        const now = useAuthStore.getState();
        if (active && now.user === before.user && now.status === before.status && (initial || (error instanceof AuthSessionError && error.status === 401))) now.setUnauthenticated();
        // Transient refresh failures retain the current session. Retry on next focus.
      } finally { inFlight = false; }
    };
    if (!useAuthStore.getState().hasInitialized) void refresh(true);
    const focus = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => { active = false; window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
  }, []);
  return null;
}
