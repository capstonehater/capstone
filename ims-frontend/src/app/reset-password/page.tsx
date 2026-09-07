import { Suspense } from "react";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-[#f45a1f] p-6 md:p-10">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center rounded-[2rem] bg-[#e9e1d6] px-4 py-10 md:px-10">
        <div className="w-full max-w-4xl">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-black md:text-5xl">
              Inventory Management System
            </h1>
            <p className="mt-2 text-base text-neutral-700 md:text-lg">
              Smart Inventory Management
            </p>
          </div>

          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
