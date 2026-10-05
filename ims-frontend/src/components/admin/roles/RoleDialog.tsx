"use client";
import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import styles from './RolesWorkspace.module.css';
export default function RoleDialog({ title, description, children, footer, onClose, busy, className = '' }: { title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode; onClose: () => void; busy: boolean; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={`${styles.dialog} ${className}`} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><div className={styles.dialogHeading}><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div><button type="button" onClick={onClose} disabled={busy} aria-label="Close dialog"><X size={20} /></button></header>
    <div className={styles.dialogBody}>{children}</div>
    {footer && <div className={styles.dialogFooter}>{footer}</div>}
  </dialog>;
}
