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
import styles from "./Login.module.css";


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

  if (status === "loading") return <p role="status" className={styles.subtitle}>Loading sign in...</p>;

  if (user?.role === "MANAGER" || unsupportedRole === "MANAGER") {
    return (
      <div className={styles.formContent}>
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
              <button className={styles.submit} type="button" onClick={handleUnsupportedRoleSignOut}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formContent}>
      <span className={styles.formMark} aria-hidden="true">✳</span>
      <h2 className={styles.formTitle}>Sign in</h2>
      <p className={styles.subtitle}>Enter your credentials to open the dashboard.</p>
      <form onSubmit={handleSubmit} className={styles.form}>
        {resetSuccess && <p role="status" className={styles.success}>Password updated successfully. Sign in with your new password.</p>}
        <label className={styles.field} htmlFor="email">
          Email address
          <input id="email" type="email" autoComplete="username" placeholder="admin@cafesalvacion.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className={styles.field} htmlFor="password">
          Password
          <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        <div className={styles.formLinks}>
          <button type="button" aria-controls="password" aria-pressed={showPassword} onClick={() => setShowPassword((previous) => !previous)}>{showPassword ? "Hide password" : "Show password"}</button>
          <Link href="/forgot-password">Forgot password?</Link>
        </div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <button className={styles.submit} type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
      </form>
      <p className={styles.accessNote}>Access is limited to authorized Café Salvacion staff.</p>
    </div>
  );
}
