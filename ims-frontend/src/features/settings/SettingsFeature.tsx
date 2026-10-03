"use client";

import readable from "@/components/admin/ReadableWorkspace.module.css";
import SettingsWorkspace from "./SettingsWorkspace";

// Presentation only: admission remains authenticated self-service at each route.
export default function SettingsFeature({ presentation = "standard" }: {
  presentation?: "standard" | "account";
}) {
  const account = presentation === "account";
  return (
    <div className={account ? "space-y-6" : `${readable.readable} space-y-6`}>
      <section className={`overflow-hidden rounded-[28px] border ${account ? "border-[#232d46]/15" : "border-[#232d46]/10"} bg-white shadow-sm`}>
        <div className="bg-[#f5f5f5] p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#232d46]">{account ? "Manager Account" : "Account"}</p>
          <h1 className="mt-2 text-2xl font-bold text-[#232d46] md:text-3xl">{account ? "ACCOUNT SETTINGS" : "SETTINGS"}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#232d46]/75">{account ? "Manage your account information and password." : "Manage your account information and security."}</p>
        </div>
      </section>
      <SettingsWorkspace />
    </div>
  );
}
