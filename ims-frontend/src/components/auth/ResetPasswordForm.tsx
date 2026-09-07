"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  PASSWORD_REQUIREMENTS_MESSAGE,
  resetPassword,
} from "@/lib/auth";
import TextInput from "@/components/ui/TextInput";
import PrimaryButton from "@/components/ui/PrimaryButton";

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

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-neutral-300 bg-[#f6f6f6] px-6 py-8 shadow-sm md:px-12 md:py-12">
        <div className="space-y-4 text-center">
          <h2 className="text-3xl font-bold text-black md:text-5xl">
            Invalid Reset Link
          </h2>
          <p className="text-base text-neutral-500 md:text-lg">
            This password reset link is missing information or is no longer usable.
          </p>
          <div className="flex flex-col items-center gap-3 pt-2">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-[#f45a1f] underline"
            >
              Request a New Reset Link
            </Link>
            <Link href="/login" className="text-sm text-neutral-600 underline">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl rounded-[2rem] border border-neutral-300 bg-[#f6f6f6] px-6 py-8 shadow-sm md:px-12 md:py-12">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-black md:text-5xl">
          Create a New Password
        </h2>
        <p className="mt-2 text-base text-neutral-500 md:text-lg">
          Choose a strong password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-5">
        <TextInput
          id="new-password"
          label="New Password :"
          type={showNewPassword ? "text" : "password"}
          placeholder="Enter your new password"
          value={newPassword}
          onChange={setNewPassword}
        />

        <div className="-mt-2 flex justify-between">
          <p className="text-sm text-neutral-500">
            {PASSWORD_REQUIREMENTS_MESSAGE}
          </p>
          <button
            type="button"
            onClick={() => setShowNewPassword((prev) => !prev)}
            className="text-sm text-neutral-600 underline"
          >
            {showNewPassword ? "Hide password" : "Show password"}
          </button>
        </div>

        <TextInput
          id="confirm-password"
          label="Confirm Password :"
          type={showConfirmPassword ? "text" : "password"}
          placeholder="Re-enter your new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
        />

        <div className="-mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            className="text-sm text-neutral-600 underline"
          >
            {showConfirmPassword ? "Hide password" : "Show password"}
          </button>
        </div>

        {successMessage && (
          <p className="rounded-xl bg-emerald-100 px-4 py-3 text-sm text-emerald-700">
            {successMessage} Redirecting you to sign in...
          </p>
        )}

        {error && (
          <div className="space-y-3">
            <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
            <Link
              href="/forgot-password"
              className="block text-sm font-medium text-[#f45a1f] underline"
            >
              Request a new reset link
            </Link>
          </div>
        )}

        <div className="flex flex-col items-center gap-4 pt-2">
          <PrimaryButton type="submit">
            {loading ? "Updating..." : "Update Password"}
          </PrimaryButton>

          <Link href="/login" className="text-sm font-medium text-[#f45a1f] underline">
            Back to Sign In
          </Link>
        </div>
      </form>
    </div>
  );
}
