"use client";

import { usePathname } from "next/navigation";
import { staffPageInfo } from "@/components/layout/shell-navigation";
import styles from "@/components/layout/ApplicationShell.module.css";
import { Maximize2, Minimize2 } from "lucide-react";
import focusStyles from "./FocusMode.module.css";

export default function StaffHeader({ focusMode = false, onToggleFocus }: { focusMode?: boolean; onToggleFocus?: () => void }) {
  const pathname = usePathname();
  const page = staffPageInfo[pathname];
  return (
    <header className={styles.pageIntro}>
      <div className={focusStyles.headerRow}>
        <div className={`${focusStyles.retract} ${focusMode ? focusStyles.retracted : ""}`} inert={focusMode}>
        <div className={focusStyles.retractInner}>
          <h1 className={styles.title}>{page?.label.toUpperCase() ?? "STAFF"}</h1>
          <p className={styles.subtitle}>{page?.subtitle ?? "Manage your daily work."}</p>
        </div>
        </div>
        {onToggleFocus && <button type="button" className={focusStyles.toggle} aria-pressed={focusMode} onClick={onToggleFocus}>
          {focusMode ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
          {focusMode ? "Exit Focus Mode" : "Focus Mode"}
        </button>}
      </div>
      {!focusMode && <div className={styles.introDivider} />}
    </header>
  );
}
