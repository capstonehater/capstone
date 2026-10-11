"use client";

import { reportAccountingNote } from "@/lib/report-accounting";
import styles from "./ReportAccountingHint.module.css";

export default function ReportAccountingHint() {
  return <details className={styles.hint}>
    <summary aria-label="How report figures are calculated">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 5.25v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="9" cy="12.25" r="0.75" fill="currentColor" />
      </svg>
    </summary>
    <p>{reportAccountingNote}</p>
  </details>;
}
