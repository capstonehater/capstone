"use client";

import Link from "next/link";
import { useLogout } from "@/hooks/useLogout";
import { useAuthStore } from "@/store/authStore";

type DashboardShellProps = {
  title: string;
  roleLabel: string;
  children?: React.ReactNode;
};

export default function DashboardShell({
  title,
  roleLabel,
  children,
}: DashboardShellProps) {
  const user = useAuthStore((state) => state.user);
  const performLogout = useLogout();

  const handleLogout = async () => {
    await performLogout();
  };

  return (
    <main className="min-h-screen bg-[#f45a1f] p-6 md:p-10">
      <section className="mx-auto max-w-6xl rounded-[2rem] bg-[#e9e1d6] p-6 md:p-10">
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-neutral-300 pb-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-black md:text-4xl">{title}</h1>
            <p className="mt-1 text-neutral-700">{roleLabel}</p>
            <p className="text-sm text-neutral-500">
              Logged in as: {user?.email ?? "Unknown user"}
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/login"
              className="rounded-xl border border-neutral-400 px-4 py-2 text-sm text-neutral-700 no-underline"
            >
              Login
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-xl bg-[#3d3434] px-4 py-2 text-sm text-white"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">{children}</div>
      </section>
    </main>
  );
}
