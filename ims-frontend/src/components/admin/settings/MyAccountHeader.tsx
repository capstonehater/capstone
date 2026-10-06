"use client";

import { useEffect, useId, useRef } from "react";
import { LogOut } from "lucide-react";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import styles from "./MyAccountHeader.module.css";

export default function MyAccountHeader() {
  return <AdminSectionHeader title="My Account" description="Manage your account information and security." className={styles.header} />;
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
