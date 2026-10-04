"use client";

import readable from "@/components/admin/ReadableWorkspace.module.css";
import MyAccountHeader from "@/components/admin/settings/MyAccountHeader";
import SettingsWorkspace from "./SettingsWorkspace";

// Presentation only: admission remains authenticated self-service at each route.
export default function SettingsFeature({ presentation = "standard" }: {
  presentation?: "standard" | "account";
}) {
  const account = presentation === "account";
  return (
    <div className={account ? "space-y-6" : `${readable.readable} space-y-6`}>
      <MyAccountHeader />
      <SettingsWorkspace />
    </div>
  );
}
