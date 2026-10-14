"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleAlert } from "lucide-react";
import { requestPasswordReset } from "@/lib/auth";
import styles from "@/components/login/Login.module.css";
import ActionAlert from "@/components/feedback/ActionAlert";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setEmailError("");
    setSuccessMessage("");
    setNoticeDismissed(false);
    setLoading(true);

    try {
      const message = await requestPasswordReset(email);
      setSuccessMessage(message);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to submit your request right now.";
      if (message === "not an existing email") {
        setEmailError(message);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.formContent}>
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
          onChange={(event) => {
            setEmail(event.target.value);
            setEmailError("");
          }}
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? "email-error" : undefined}
          className={emailError ? styles.invalidInput : undefined}
          required
        />
        </label>
        {emailError && (
          <p id="email-error" role="alert" className={styles.fieldError}>
            <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
            <span>{emailError}</span>
          </p>
        )}

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
