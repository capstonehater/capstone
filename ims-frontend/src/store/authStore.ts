import { create } from "zustand";
import type { AuthUser } from "@/lib/auth";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthState = {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  hasInitialized: boolean;
  setLoading: () => void;
  setAuthenticated: (user: AuthUser) => void;
  setUnauthenticated: () => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "loading",
  isAuthenticated: false,
  hasInitialized: false,

  setLoading: () =>
    set((state) => ({
      ...state,
      status: "loading",
    })),

  setAuthenticated: (user) =>
    set({
      user,
      status: "authenticated",
      isAuthenticated: true,
      hasInitialized: true,
    }),

  setUnauthenticated: () =>
    set({
      user: null,
      status: "unauthenticated",
      isAuthenticated: false,
      hasInitialized: true,
    }),

  logout: () =>
    set({
      user: null,
      status: "unauthenticated",
      isAuthenticated: false,
      hasInitialized: true,
    }),
}));
