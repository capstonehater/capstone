"use client";

import { KeyRound, LockKeyhole } from "lucide-react";

type SecuritySettingsCardProps = {
  onChangePassword: () => void;
};

export default function SecuritySettingsCard({
  onChangePassword,
}: SecuritySettingsCardProps) {
  return (
    <section
      id="security"
      className="rounded-[32px] border border-white/70 bg-white p-5 shadow-sm md:p-6"
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f45a1f]">
            Security Settings
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">
            Manage your password and account security.
          </h2>
        </div>
        <button
          type="button"
          onClick={onChangePassword}
          className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-950/25"
        >
          Change Password
        </button>
      </div>

      <div className="mt-6 rounded-[28px] border border-slate-200 bg-[#f8f3ec] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-white p-3 text-[#f45a1f] shadow-sm">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-950">Password</p>
              <p className="mt-1 font-mono text-sm tracking-[0.28em] text-slate-600">
                ••••••••••••
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Your current password is never fetched or displayed.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
            <KeyRound className="h-3.5 w-3.5" />
            Reauthentication required after change
          </div>
        </div>
      </div>
    </section>
  );
}
