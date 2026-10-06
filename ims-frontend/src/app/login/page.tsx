import AuthPageShell from "@/components/auth/AuthPageShell";
import LoginForm from "@/components/login/LoginForm";

export default function LoginPage() {
  return (
    <AuthPageShell label="Sign in">
      <LoginForm />
    </AuthPageShell>
  );
}
