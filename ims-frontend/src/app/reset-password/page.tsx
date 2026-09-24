import { Suspense } from "react";
import AuthPageShell from "@/components/auth/AuthPageShell";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import styles from "@/components/login/Login.module.css";

export default function ResetPasswordPage() {
  return (
    <AuthPageShell
      label="Create a new password"
      title="A fresh start for your account."
      description="Choose a secure password to access your workspace and keep every counter running smoothly."
    >
      <Suspense fallback={<p role="status" className={styles.subtitle}>Loading password setup...</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthPageShell>
  );
}
