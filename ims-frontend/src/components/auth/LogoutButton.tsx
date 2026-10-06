"use client";

import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes } from "react";
import { LogOut } from "lucide-react";
import { useLogout } from "@/hooks/useLogout";
import styles from "./LogoutButton.module.css";

export default function LogoutButton({ children, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const performLogout = useLogout();

  async function confirmLogout() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      await performLogout();
    } catch {
      // useLogout clears the local session and redirects even if the request fails.
    } finally {
      setOpen(false);
      setBusy(false);
      submitting.current = false;
    }
  }

  return <>
    <button {...props} type="button" onClick={() => setOpen(true)}>{children}</button>
    {open && <LogoutConfirmation busy={busy} onCancel={() => setOpen(false)} onConfirm={() => { void confirmLogout(); }} />}
  </>;
}

function LogoutConfirmation({ busy, onCancel, onConfirm }: { busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    cancelRef.current?.focus();
    return () => dialog?.close();
  }, []);
  return <dialog ref={dialogRef} className={styles.confirmation} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <div className={styles.confirmationBody}>
      <div className={styles.confirmationHeading}>
        <span className={styles.logoutIcon}><LogOut size={24} aria-hidden="true" /></span>
        <div><h2 id={titleId}>Confirm logout</h2><p className={styles.confirmationSubtitle}>End your current session</p></div>
      </div>
      <p id={descriptionId}>Are you sure you want to log out?</p>
    </div>
    <div className={styles.confirmationActions}>
      <button ref={cancelRef} type="button" disabled={busy} onClick={onCancel}>Stay signed in</button>
      <button type="button" disabled={busy} className={styles.confirmLogout} onClick={onConfirm}><LogOut size={18} aria-hidden="true" />{busy ? "Logging out..." : "Log out"}</button>
    </div>
  </dialog>;
}
