"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getDefaultRouteForRole,
  loginWithPassword,
  logoutSession,
  type AuthUser,
} from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";
import TextInput from "@/components/ui/TextInput";
import PrimaryButton from "@/components/ui/PrimaryButton";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const setUnauthenticated = useAuthStore((state) => state.setUnauthenticated);
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const resetSuccess = searchParams.get("reset") === "success";
  const unsupportedRole = searchParams.get("unsupportedRole");

  const redirectPath = useMemo(() => {
    if (!user) {
      return null;
    }

    return getDefaultRouteForRole(user.role);
  }, [user]);

  useEffect(() => {
    if (status !== "authenticated" || !redirectPath) return;

    router.replace(redirectPath);
  }, [status, redirectPath, router]);

  const handleLoginSuccess = (authenticatedUser: AuthUser) => {
    setAuthenticated(authenticatedUser);
    router.push(getDefaultRouteForRole(authenticatedUser.role));
  };

  const handleUnsupportedRoleSignOut = async () => {
    try {
      await logoutSession();
    } finally {
      setUnauthenticated();
      router.replace("/login");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const authenticatedUser = await loginWithPassword({
        email,
        password,
      });

      handleLoginSuccess(authenticatedUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") return null;

  if (user?.role === "MANAGER" || unsupportedRole === "MANAGER") {
    return (
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-amber-300 bg-[#f6f6f6] px-6 py-8 shadow-sm md:px-12 md:py-12">
        <div className="space-y-4 text-center">
          <h2 className="text-3xl font-bold text-black md:text-5xl">
            Account Authenticated
          </h2>
          <p className="text-base text-neutral-700 md:text-lg">
            Your account was recognized, but no application workspace is available for the MANAGER role yet.
          </p>
          <p className="text-sm text-neutral-500">
            Administrator and Staff routes remain blocked until the Manager experience is implemented.
          </p>
          {user?.role === "MANAGER" && (
            <div className="pt-2">
              <PrimaryButton type="button" onClick={handleUnsupportedRoleSignOut}>
                Sign Out
              </PrimaryButton>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl rounded-[2rem] border border-neutral-300 bg-[#f6f6f6] px-6 py-8 shadow-sm md:px-12 md:py-12">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-black md:text-5xl">
          Admin Access
        </h2>
        <p className="mt-2 text-base text-neutral-500 md:text-lg">
          enter your credentials to continue
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-5">
        {resetSuccess && (
          <p className="rounded-xl bg-emerald-100 px-4 py-3 text-sm text-emerald-700">
            Password updated successfully. Sign in with your new password.
          </p>
        )}

        <TextInput
          id="email"
          label="Email Address :"
          type="email"
          placeholder="admin@stockscout.com"
          value={email}
          onChange={setEmail}
        />

        <div>
          <TextInput
            id="password"
            label="Password :"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={password}
            onChange={setPassword}
          />

          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="text-sm text-neutral-600 underline"
            >
              {showPassword ? "Hide password" : "Show password"}
            </button>

            <Link
              href="/forgot-password"
              className="text-sm font-medium text-[#f45a1f] underline"
            >
              Forgot Password?
            </Link>
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="pt-2 text-center">
          <PrimaryButton type="submit">
            {loading ? "Signing In..." : "Sign In"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
