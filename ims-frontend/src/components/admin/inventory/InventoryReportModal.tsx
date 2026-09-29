"use client";
import ModalCloseButton from "@/components/ModalCloseButton";


import { useEffect, useRef } from "react";
import styles from "./InventoryReportModal.module.css";

export default function InventoryReportModal({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { dialog?.close(); };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="inventory-report-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className={styles.header}>
        <div>
          <h2 id="inventory-report-title">{title}</h2>
          <p>Full report</p>
        </div>
        <ModalCloseButton onClose={onClose} autoFocus />
      </header>
      <div className={styles.body}>{children}</div>
    </dialog>
  );
}
