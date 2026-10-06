"use client";

import Link from "next/link";
import { Check, Circle, Eye, EyeOff } from "lucide-react";
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

  const passwordChecks = [
    { label: "10-72 characters", met: newPassword.length >= 10 && newPassword.length <= 72 },
    { label: "Uppercase letter", met: /[A-Z]/.test(newPassword) },
    { label: "Lowercase letter", met: /[a-z]/.test(newPassword) },
    { label: "Number", met: /\d/.test(newPassword) },
  ];
  const metCount = passwordChecks.filter((check) => check.met).length;
  const passwordStrong = passwordChecks.every((check) => check.met) && PASSWORD_RULE.test(newPassword);
  const strengthLabel = !newPassword ? "Enter a password" : passwordStrong ? "Strong password" : "Needs improvement";

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

    if (!passwordStrong) {
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
        <div className={styles.field}>
          <label htmlFor="new-password">New password</label>
          <div className={styles.passwordField}>
            <input
              id="new-password"
              type={showNewPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Enter your new password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              aria-describedby="password-strength password-requirements"
              minLength={10}
              maxLength={72}
              required
            />
            <button className={styles.passwordToggle} type="button" aria-label={showNewPassword ? "Hide password" : "Show password"} aria-controls="new-password" aria-pressed={showNewPassword} onClick={() => setShowNewPassword((previous) => !previous)}>
              {showNewPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>
        <div className={styles.passwordHelp}>
          <div id="password-strength" className={styles.strengthHeading} aria-live="polite" aria-atomic="true">
            <span>Password strength</span>
            <strong className={passwordStrong ? styles.requirementMet : undefined}>{strengthLabel}</strong>
          </div>
          <div className={styles.strengthMeter} aria-hidden="true">
            {passwordChecks.map((check, index) => <span key={check.label} className={newPassword && index < metCount ? (passwordStrong ? styles.strengthStrong : styles.strengthPartial) : undefined} />)}
          </div>
          <ul id="password-requirements" className={styles.passwordRequirements} aria-label="Password requirements">
            {passwordChecks.map((check) => (
              <li key={check.label} className={check.met ? styles.requirementMet : undefined}>
                {check.met ? <Check size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
                <span>{check.label}<span className={styles.visuallyHidden}>{check.met ? ": met" : ": not met"}</span></span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.field}>
          <label htmlFor="confirm-password">Confirm password</label>
          <div className={styles.passwordField}>
            <input
              id="confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              aria-describedby={confirmPassword ? "password-match" : undefined}
              aria-invalid={confirmPassword ? newPassword !== confirmPassword : undefined}
              required
            />
            <button className={styles.passwordToggle} type="button" aria-label={showConfirmPassword ? "Hide password" : "Show password"} aria-controls="confirm-password" aria-pressed={showConfirmPassword} onClick={() => setShowConfirmPassword((previous) => !previous)}>
              {showConfirmPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
          {confirmPassword && <p id="password-match" className={newPassword === confirmPassword ? styles.passwordMatch : styles.passwordMismatch} aria-live="polite">{newPassword === confirmPassword ? "Passwords match" : "Passwords do not match yet"}</p>}
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
