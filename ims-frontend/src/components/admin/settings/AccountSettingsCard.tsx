"use client";

import Image from "next/image";
import { profilePictureSrc } from "@/lib/settings";
import type { ReactNode } from "react";
import { Mail, Phone, ShieldCheck, UserRound, BadgeCheck } from "lucide-react";
import type { SettingsAccount } from "@/lib/settings";

type AccountSettingsCardProps = {
  account: SettingsAccount;
  onEdit: () => void;
};

const roleLabels: Record<SettingsAccount["role"], string> = {
  ADMINISTRATOR: "Administrator",
  MANAGER: "Manager",
  STAFF: "Staff",
};

const statusLabels: Record<SettingsAccount["status"], string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

function initialsFor(account: SettingsAccount) {
  const first = account.firstName.trim().charAt(0);
  const last = account.lastName.trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "CS";
}

function statusTone(status: SettingsAccount["status"]) {
  if (status === "ACTIVE") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "PENDING") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-orange-50 p-2 text-[#f45a1f]">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <div className="mt-1 break-words text-sm font-semibold text-slate-950">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AccountSettingsCard({
  account,
  onEdit,
}: AccountSettingsCardProps) {
  return (
    <section className="rounded-[32px] border border-white/70 bg-[#f8f3ec] p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f45a1f]">
            Account Settings
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">
            Manage your account information and personal details.
          </h2>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full bg-[#f45a1f] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d94d18] focus:outline-none focus:ring-2 focus:ring-[#f45a1f]/30"
        >
          Edit Account
        </button>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[18rem_1fr]">
        <div className="rounded-[30px] border border-slate-200 bg-white p-5 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#f45a1f] text-2xl font-black text-white shadow-sm">
            {account.profilePictureUrl ? (
              <Image src={profilePictureSrc(account.profilePictureUrl)!} alt={account.name + " profile picture"} width={96} height={96} unoptimized className="h-24 w-24 rounded-full object-cover" />
            ) : initialsFor(account)}
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-950">
            {account.name}
          </h3>
          <p className="mt-1 text-sm text-slate-500">{account.email}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
              {roleLabels[account.role]}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(account.status)}`}
            >
              {statusLabels[account.status]}
            </span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <DetailRow
            icon={<UserRound className="h-4 w-4" />}
            label="Full Name"
            value={account.name}
          />
          <DetailRow
            icon={<Mail className="h-4 w-4" />}
            label="Email Address"
            value={account.email}
          />
          <DetailRow
            icon={<Phone className="h-4 w-4" />}
            label="Phone Number"
            value={account.phone?.trim() || "Not provided"}
          />
          <DetailRow
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Role"
            value={roleLabels[account.role]}
          />
          <DetailRow
            icon={<BadgeCheck className="h-4 w-4" />}
            label="Account Status"
            value={statusLabels[account.status]}
          />
          <DetailRow
            icon={<UserRound className="h-4 w-4" />}
            label="Employee ID"
            value={account.id}
          />
        </div>
      </div>
    </section>
  );
}
