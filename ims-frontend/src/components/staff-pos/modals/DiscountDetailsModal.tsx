"use client";

import { useId, useRef, useState } from "react";
import Modal from "./Modal";
import styles from "./DiscountDetailsModal.module.css";

export type DiscountDetails = { name: string; idNumber: string };

type Props = {
  discount: "senior" | "pwd";
  initialDetails?: DiscountDetails | null;
  onClose: () => void;
  onSubmit: (details: DiscountDetails) => void;
};

export default function DiscountDetailsModal({ discount, initialDetails, onClose, onSubmit }: Props) {
  const id = useId();
  const [name, setName] = useState(initialDetails?.name ?? "");
  const [idNumber, setIdNumber] = useState(initialDetails?.idNumber ?? "");
  const [attempted, setAttempted] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const idInput = useRef<HTMLInputElement>(null);
  const nameMissing = attempted && !name.trim();
  const idMissing = attempted && !idNumber.trim();
  const title = discount === "senior" ? "Senior Citizen" : "PWD";
  const idLabel = discount === "senior" ? "Senior Citizen ID No." : "ID No.";

  return <Modal title={title + " Discount Details"} onClose={onClose} panelClassName={styles.panel} footer={
    <div className={styles.footer}>
      <button type="submit" form={id + "-form"}>Apply Discount</button>
    </div>
  }>
    <form id={id + "-form"} noValidate className={styles.form} onSubmit={event => {
      event.preventDefault();
      setAttempted(true);
      if (!name.trim() || !idNumber.trim()) {
        (!name.trim() ? nameInput : idInput).current?.focus();
        return;
      }
      onSubmit({ name: name.trim(), idNumber: idNumber.trim() });
    }}>
      <p>Enter the customer details shown on their {title} ID. Both fields are required.</p>
      <label htmlFor={id + "-name"}>Name <span className={styles.required} aria-hidden="true">*</span></label>
      <input ref={nameInput} id={id + "-name"} autoFocus required maxLength={120} autoComplete="off"
        value={name} onChange={event => setName(event.target.value)}
        aria-invalid={nameMissing} aria-describedby={nameMissing ? id + "-name-error" : undefined}
        placeholder="Full name on ID" />
      {nameMissing && <p id={id + "-name-error"} className={styles.error} role="alert">Name is required.</p>}
      <label htmlFor={id + "-number"}>{idLabel} <span className={styles.required} aria-hidden="true">*</span></label>
      <input ref={idInput} id={id + "-number"} required maxLength={120} autoComplete="off"
        value={idNumber} onChange={event => setIdNumber(event.target.value)}
        aria-invalid={idMissing} aria-describedby={idMissing ? id + "-number-error" : undefined}
        placeholder={idLabel} />
      {idMissing && <p id={id + "-number-error"} className={styles.error} role="alert">{idLabel} is required.</p>}
    </form>
  </Modal>;
}
