"use client";

import { useRouter } from "next/navigation";
import { logoutSession } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";

export function useLogout() {
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.logout);

  return async () => {
    try {
      await logoutSession();
    } finally {
      clearSession();
      router.replace("/login");
    }
  };
}
