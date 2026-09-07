"use client";

import Link from "next/link";
import { useState } from "react";
import { requestPasswordReset } from "@/lib/auth";
import TextInput from "@/components/ui/TextInput";
import PrimaryButton from "@/components/ui/PrimaryButton";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
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
    <div className="mx-auto max-w-3xl rounded-[2rem] border border-neutral-300 bg-[#f6f6f6] px-6 py-8 shadow-sm md:px-12 md:py-12">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-black md:text-5xl">
          Reset Password
        </h2>
        <p className="mt-2 text-base text-neutral-500 md:text-lg">
          Enter your email address and we&apos;ll help you reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-5">
        <TextInput
          id="email"
          label="Email Address :"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={setEmail}
        />

        {successMessage && (
          <p className="rounded-xl bg-emerald-100 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </p>
        )}

        {error && (
          <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-col items-center gap-4 pt-2">
          <PrimaryButton type="submit">
            {loading ? "Sending..." : successMessage ? "Send Again" : "Send Reset Link"}
          </PrimaryButton>

          <Link href="/login" className="text-sm font-medium text-[#f45a1f] underline">
            Back to Sign In
          </Link>
        </div>
      </form>
    </div>
  );
}
