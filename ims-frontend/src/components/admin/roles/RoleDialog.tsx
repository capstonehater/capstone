"use client";
import { useEffect, useId, useRef } from 'react';
import styles from './RolesWorkspace.module.css';
export default function RoleDialog({ title, children, onClose, busy }: { title: string; children: React.ReactNode; onClose: () => void; busy: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><h2 id={titleId}>{title}</h2><button type="button" onClick={onClose} disabled={busy}>Close</button></header>
    <div className={styles.dialogBody}>{children}</div>
  </dialog>;
}
