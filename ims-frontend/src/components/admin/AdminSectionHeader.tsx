import styles from "./AdminSectionHeader.module.css";

export default function AdminSectionHeader({ title, description, children, className = "" }: {
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return <header className={`${styles.panel} ${className}`}>
    <h1>{title}</h1>
    <p>{description}</p>
    {children ? <div className={styles.actions}>{children}</div> : null}
  </header>;
}
