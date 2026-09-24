"use client";

import Link from "next/link";
import { useState } from "react";
import { requestPasswordReset } from "@/lib/auth";
import styles from "@/components/login/Login.module.css";
import ActionAlert from "@/components/feedback/ActionAlert";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setNoticeDismissed(false);
    setLoading(true);

    try {
      const message = await requestPasswordReset(email);
      setSuccessMessage(message);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit your request right now."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.formContent}>
      <span className={styles.formMark} aria-hidden="true">✳</span>
        <h2 className={styles.formTitle}>
          Reset password
        </h2>
        <p className={styles.subtitle}>
          Enter your email address and we&apos;ll help you reset your password.
        </p>
      <form onSubmit={handleSubmit} className={styles.form} aria-busy={loading}>
        <label className={styles.field} htmlFor="email">
          Email address
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        </label>

        {successMessage && !noticeDismissed && (
          <ActionAlert key="reset-request-success" tone="success" title="Request received" message={successMessage} onDismiss={() => setNoticeDismissed(true)} />
        )}

        {error && (
          <ActionAlert key={error} tone="error" title="Unable to send reset link" message={error} onDismiss={() => setError("")} />
        )}

          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? "Sending..." : successMessage ? "Send again" : "Send reset link"}
          </button>
        <div className={styles.recoveryLinks}>
          <div className={styles.formLinks}>
          <Link href="/login">
            Back to sign in
          </Link>
          </div>
        </div>
      </form>
      <p className={styles.accessNote}>Access is limited to authorized Café Salvacion staff.</p>
    </div>
  );
}
