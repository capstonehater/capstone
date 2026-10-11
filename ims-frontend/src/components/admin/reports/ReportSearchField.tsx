import type { ReactNode } from "react";
import styles from "./ReportSearchField.module.css";

export default function ReportSearchField({ label, children }: { label: string; children: ReactNode }) {
  return <label className={`${styles.field} report-search-field`}>
    <span>{label}</span>
    {children}
  </label>;
}
