"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  PASSWORD_REQUIREMENTS_MESSAGE,
  resetPassword,
} from "@/lib/auth";
import styles from "@/components/login/Login.module.css";
import ActionAlert from "@/components/feedback/ActionAlert";

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const token = searchParams.get("token")?.trim() ?? "";
  const tokenMissing = token.length < 32;

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNoticeDismissed(false);

    if (tokenMissing) {
      setError("This reset link is missing or invalid.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (
      newPassword.length < 10 ||
      newPassword.length > 72 ||
      !PASSWORD_RULE.test(newPassword)
    ) {
      setError(PASSWORD_REQUIREMENTS_MESSAGE);
      return;
    }

    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const message = await resetPassword({
        token,
        newPassword,
      });

      setSuccessMessage(message);
      redirectTimeoutRef.current = setTimeout(() => {
        router.replace("/login?reset=success");
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to reset your password right now."
      );
    } finally {
      setLoading(false);
    }
  };

  if (tokenMissing) {
    return (
      <div className={styles.formContent}>
        <span className={styles.formMark} aria-hidden="true">✳</span>
        <h2 className={styles.formTitle}>Invalid reset link</h2>
        <p className={styles.subtitle}>
          This password link is missing information. Request a new link, or ask your administrator to resend your account setup email.
        </p>
        <div className={styles.recoveryLinks}>
          <Link href="/forgot-password" className={styles.submit}>Request a new reset link</Link>
          <div className={styles.formLinks}><Link href="/login">Back to sign in</Link></div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formContent}>
      <span className={styles.formMark} aria-hidden="true">✳</span>
      <h2 className={styles.formTitle}>Create a new password</h2>
      <p className={styles.subtitle}>Choose a strong password to secure your account.</p>

      <form onSubmit={handleSubmit} className={styles.form} aria-busy={loading}>
        <label className={styles.field} htmlFor="new-password">
          New password
          <input
            id="new-password"
            type={showNewPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Enter your new password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            aria-describedby="password-requirements"
            minLength={10}
            maxLength={72}
            required
          />
        </label>
        <div className={styles.passwordHelp}>
          <p id="password-requirements" className={styles.subtitle}>{PASSWORD_REQUIREMENTS_MESSAGE}</p>
          <div className={styles.formLinks}>
            <button type="button" aria-controls="new-password" aria-pressed={showNewPassword} onClick={() => setShowNewPassword((previous) => !previous)}>
              {showNewPassword ? "Hide password" : "Show password"}
            </button>
          </div>
        </div>

        <label className={styles.field} htmlFor="confirm-password">
          Confirm password
          <input
            id="confirm-password"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </label>
        <div className={styles.formLinks}>
          <button type="button" aria-controls="confirm-password" aria-pressed={showConfirmPassword} onClick={() => setShowConfirmPassword((previous) => !previous)}>
            {showConfirmPassword ? "Hide password" : "Show password"}
          </button>
        </div>

        {successMessage && !noticeDismissed && <ActionAlert key="password-updated" tone="success" title="Password updated" message={`${successMessage} Redirecting you to sign in...`} onDismiss={() => setNoticeDismissed(true)} />}
        {error && (
          <div>
            <ActionAlert key={error} tone="error" title="Unable to update password" message={error} onDismiss={() => setError("")} />
            <div className={styles.formLinks}><Link href="/forgot-password">Request a new reset link</Link></div>
          </div>
        )}

        <button className={styles.submit} type="submit" disabled={loading || Boolean(successMessage)}>
          {loading ? "Updating password..." : successMessage ? "Password updated" : "Update password"}
        </button>
        <div className={styles.recoveryLinks}>
          <div className={styles.formLinks}><Link href="/login">Back to sign in</Link></div>
        </div>
      </form>
      <p className={styles.accessNote}>Access is limited to authorized Café Salvacion staff.</p>
    </div>
  );
}
