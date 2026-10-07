"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  loginWithPassword,
  type AuthUser,
} from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";
import { getDefaultLandingRoute } from "@/lib/routing/landing";
import styles from "./Login.module.css";
import ActionAlert from "@/components/feedback/ActionAlert";

function ResetPasswordNotice({ hidden, onDismiss }: { hidden: boolean; onDismiss: () => void }) {
  const searchParams = useSearchParams();
  if (hidden || searchParams.get("reset") !== "success") return null;
  return <ActionAlert tone="success" title="Password updated" message="Password updated successfully. Sign in with your new password." onDismiss={onDismiss} />;
}

export default function LoginForm() {
  const router = useRouter();
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetNoticeDismissed, setResetNoticeDismissed] = useState(false);

  const redirectPath = useMemo(() => {
    if (!user) {
      return null;
    }

    return getDefaultLandingRoute(useAuthStore.getState());
  }, [user]);

  useEffect(() => {
    if (status !== "authenticated" || !redirectPath) return;

    router.replace(redirectPath);
  }, [status, redirectPath, router]);

  const handleLoginSuccess = (authenticatedUser: AuthUser) => {
    setAuthenticated(authenticatedUser);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== "unauthenticated" || loading) return;
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

  return (
    <div className={styles.formContent}>
      <h2 className={styles.formTitle}>Sign in</h2>
      <p className={styles.subtitle}>Enter your credentials to open the dashboard.</p>
      <form onSubmit={handleSubmit} className={styles.form}>
        <Suspense fallback={null}><ResetPasswordNotice hidden={resetNoticeDismissed || Boolean(error)} onDismiss={() => setResetNoticeDismissed(true)} /></Suspense>
        <label className={styles.field} htmlFor="email">
          Email address
          <input id="email" type="email" autoComplete="username" placeholder="admin@cafesalvacion.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <div className={styles.field}>
          <label htmlFor="password">Password</label>
          <div className={styles.passwordField}>
            <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <button
              className={styles.passwordToggle}
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-controls="password"
              onClick={() => setShowPassword((previous) => !previous)}
            >
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>
        <div className={styles.formLinks}>
          <Link href="/forgot-password">Forgot password?</Link>
        </div>
        {error && <ActionAlert key={error} tone="error" title="Unable to sign in" message={error} onDismiss={() => setError("")} />}
        <button className={styles.submit} type="submit" disabled={loading || status !== "unauthenticated"}>{loading ? "Signing in..." : "Sign in"}</button>
      </form>
      <p className={styles.accessNote}>Access is limited to authorized Café Salvacion staff.</p>
    </div>
  );
}
