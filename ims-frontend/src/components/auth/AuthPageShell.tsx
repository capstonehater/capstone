import type { ReactNode } from "react";
import { PanelsTopLeft } from "lucide-react";
import styles from "@/components/login/Login.module.css";

export default function AuthPageShell({
  children,
  label,
  title = "Know what’s on the shelf before you run out.",
  description = "Sign in to track stock levels, log deliveries, and keep every counter running without a midnight supply run.",
}: {
  children: ReactNode;
  label: string;
  title?: string;
  description?: string;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
      <section className={styles.brandPanel} aria-label="Café Salvacion IMS">
        <div className={styles.brand}><PanelsTopLeft size={26} strokeWidth={1.5} aria-hidden="true" /><span>Café Salvacion IMS</span></div>
        <div className={styles.introduction}>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className={styles.highlights}>
          <div><strong>Stock</strong><span>items tracked</span></div>
          <div><strong>Alerts</strong><span>low-stock notices</span></div>
          <div><strong>Sync</strong><span>inventory updates</span></div>
        </div>
      </section>
      <section className={styles.signInPanel} aria-label={label}>
        {children}
      </section>
      </div>
    </main>
  );
}
