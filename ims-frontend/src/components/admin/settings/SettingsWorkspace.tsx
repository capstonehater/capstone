"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AccountSettingsCard from "./AccountSettingsCard";
import ChangePasswordDialog from "./ChangePasswordDialog";
import EditAccountDialog from "./EditAccountDialog";
import SecuritySettingsCard from "./SecuritySettingsCard";
import {
  fetchSettingsAccount,
  type ChangePasswordResponse,
  type SettingsAccount,
  type UpdateSettingsAccountResponse,
} from "@/lib/settings";
import { useAuthStore } from "@/store/authStore";

export default function SettingsWorkspace() {
  const router = useRouter();
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const setUnauthenticated = useAuthStore((state) => state.setUnauthenticated);

  const [account, setAccount] = useState<SettingsAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      setLoading(true);
      setError(null);
      try {
        const nextAccount = await fetchSettingsAccount();
        if (!active) return;
        setAccount(nextAccount);
      } catch (nextError) {
        if (!active) return;
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to load settings."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadAccount();

    return () => {
      active = false;
    };
  }, []);

  function endSessionAndRedirectSoon() {
    window.setTimeout(() => {
      setUnauthenticated();
      router.replace("/login");
    }, 900);
  }

  function handleAccountSaved(response: UpdateSettingsAccountResponse) {
    setAccount(response.user);
    setEditOpen(false);

    if (response.requiresReauthentication) {
      setNotice("Email updated. Please sign in again.");
      endSessionAndRedirectSoon();
      return;
    }

    setAuthenticated({
      id: response.user.id,
      email: response.user.email,
      name: response.user.name,
      role: response.user.role,
    });
    setNotice(response.message || "Account settings updated.");
  }

  function handlePasswordChanged(response: ChangePasswordResponse) {
    setPasswordOpen(false);
    setNotice(response.message || "Password changed. Please sign in again.");
    endSessionAndRedirectSoon();
  }

  if (loading) {
    return (
      <section className="rounded-[32px] border border-white/70 bg-white p-6 shadow-sm">
        <div className="h-5 w-44 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-3xl bg-slate-100"
            />
          ))}
        </div>
      </section>
    );
  }

  if (error || !account) {
    return (
      <section className="rounded-[32px] border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-sm">
        <h2 className="text-lg font-bold">Settings could not be loaded</h2>
        <p className="mt-2 text-sm">{error ?? "No account data was returned."}</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {notice ? (
        <div
          role="status"
          className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700"
        >
          {notice}
        </div>
      ) : null}

      <AccountSettingsCard account={account} onEdit={() => setEditOpen(true)} />
      <SecuritySettingsCard onChangePassword={() => setPasswordOpen(true)} />

      {editOpen ? (
        <EditAccountDialog
          account={account}
          onClose={() => setEditOpen(false)}
          onSaved={handleAccountSaved}
        />
      ) : null}

      {passwordOpen ? (
        <ChangePasswordDialog
          onClose={() => setPasswordOpen(false)}
          onChanged={handlePasswordChanged}
        />
      ) : null}
    </div>
  );
}
