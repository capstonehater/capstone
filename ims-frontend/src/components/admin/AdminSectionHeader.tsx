import styles from "./AdminSectionHeader.module.css";

export default function AdminSectionHeader({ title, description, children, titleHint, className = "" }: {
  title: string;
  description: string;
  children?: React.ReactNode;
  titleHint?: React.ReactNode;
  className?: string;
}) {
  return <header className={`${styles.panel} ${className}`}>
    <div className={styles.titleRow}><h1>{title}</h1>{titleHint}</div>
    <p>{description}</p>
    {children ? <div className={styles.actions}>{children}</div> : null}
  </header>;
}
