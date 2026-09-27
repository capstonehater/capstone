"use client";

import { useEffect, useRef, type ReactNode } from "react";

export default function UserDetailsModal({ children, onClose }: {
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog ref={ref} aria-labelledby="user-details-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className="fixed inset-0 m-auto h-[90dvh] max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-6xl overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/55">
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="user-details-title" className="text-xl font-semibold">User details</h2>
            <p className="mt-1 text-sm text-slate-500">Manage profile, permissions, activity, and sessions.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600">Close</button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 [scrollbar-gutter:stable] sm:p-6">{children}</div>
      </div>
    </dialog>
  );
}
