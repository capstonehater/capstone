import { Suspense } from "react";
import AuthPageShell from "@/components/auth/AuthPageShell";
import LoginForm from "@/components/login/LoginForm";
import styles from "@/components/login/Login.module.css";

export default function LoginPage() {
  return (
    <AuthPageShell label="Sign in">
      <Suspense fallback={<p role="status" className={styles.subtitle}>Loading sign in...</p>}>
        <LoginForm />
      </Suspense>
    </AuthPageShell>
  );
}
