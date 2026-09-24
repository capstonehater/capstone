import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import AuthPageShell from "@/components/auth/AuthPageShell";

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell
      label="Reset password"
      title="Get back to your workspace."
      description="Recover access to your account and get back to keeping stock, deliveries, and daily operations on track."
    >
      <ForgotPasswordForm />
    </AuthPageShell>
  );
}
