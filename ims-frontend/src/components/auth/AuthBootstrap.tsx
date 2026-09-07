"use client";

import { useEffect, useRef } from "react";
import { fetchCurrentUser } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";

export default function AuthBootstrap() {
  const hasInitialized = useAuthStore((state) => state.hasInitialized);
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const setUnauthenticated = useAuthStore((state) => state.setUnauthenticated);
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current || hasInitialized) {
      return;
    }

    didRun.current = true;

    void (async () => {
      try {
        const user = await fetchCurrentUser();
        setAuthenticated(user);
      } catch {
        setUnauthenticated();
      }
    })();
  }, [hasInitialized, setAuthenticated, setUnauthenticated]);

  return null;
}
