import type { ReactNode } from "react";
import styles from "./PageSkeleton.module.css";

export type SkeletonPage = "dashboard" | "inventory" | "products" | "users" | "roles" | "suppliers" | "alerts" | "forecasting" | "settings" | "pos" | "transactions" | "reports";
function Block({ className = "" }: { className?: string }) { return <div className={styles.block + " " + className} />; }
function Panel({ children }: { children: ReactNode }) { return <div className={styles.panel}>{children}</div>; }
function Rows({ count = 6 }: { count?: number }) { return <div className={styles.rows}>{Array.from({ length: count }, (_, i) => <div className={styles.row} key={i}><Block /><Block /><Block /></div>)}</div>; }
function Cards({ count }: { count: number }) { return <div className={styles.cards} style={{ gridTemplateColumns: "repeat(" + count + ", minmax(0, 1fr))" }}>{Array.from({ length: count }, (_, i) => <Panel key={i}><Block className={styles.label} /><Block className={styles.value} /><Block className={styles.caption} /></Panel>)}</div>; }
function Chart() { return <Panel><Block className={styles.label} /><div className={styles.chart}>{[35, 62, 48, 80, 58, 92, 70, 84].map((height, i) => <Block key={i} className={styles.bar + " " + styles["bar" + height]} />)}</div></Panel>; }
export default function PageSkeleton({ page, header = true }: { page: SkeletonPage; header?: boolean }) {
  const masterDetail = ["inventory", "products", "users", "roles", "suppliers"].includes(page);
  const analytics = ["dashboard", "forecasting", "reports"].includes(page);
  return <section className={styles.skeleton} role="status" aria-label={"Loading " + page + " page"} aria-busy="true">
    <span className={styles.srOnly}>Loading {page}…</span>
    <div aria-hidden="true" className={styles.content}>
      {header && <div className={styles.heading}><Block className={styles.title} /><Block className={styles.subtitle} /></div>}
      {page !== "settings" && <div className={styles.toolbar}><Block className={styles.search} /><Block className={styles.control} /><Block className={styles.control} /></div>}
      {analytics && <Cards count={page === "forecasting" ? 3 : page === "dashboard" ? 5 : 4} />}
      {masterDetail && <div className={styles.split}><Panel><Block className={styles.label} /><Rows /></Panel><Panel><div className={styles.profile}><Block className={styles.avatar} /><Block className={styles.title} /></div><Block className={styles.tab} /><Rows count={5} /></Panel></div>}
      {analytics && <><div className={styles.charts}><Chart /><Chart /></div>{page === "dashboard" ? <div className={styles.charts}><Panel><Rows count={4} /></Panel><Panel><Rows count={4} /></Panel></div> : <Panel><Block className={styles.label} /><Rows /></Panel>}</>}
      {page === "alerts" && <Panel>{Array.from({ length: 5 }, (_, i) => <div className={styles.alert} key={i}><Block className={styles.avatar} /><div className={styles.alertText}><Block className={styles.title} /><Block className={styles.subtitle} /><Block className={styles.caption} /></div><Block className={styles.control} /></div>)}</Panel>}
      {page === "settings" && <><Panel><div className={styles.profile}><Block className={styles.avatar} /><Block className={styles.title} /></div><div className={styles.fields}>{Array.from({ length: 4 }, (_, i) => <div key={i}><Block className={styles.label} /><Block className={styles.field} /></div>)}</div></Panel><Panel><Block className={styles.title} /><Block className={styles.subtitle} /><Block className={styles.control} /></Panel></>}
      {page === "pos" && <div className={styles.pos}><div className={styles.productGrid}>{Array.from({ length: 6 }, (_, i) => <Panel key={i}><Block className={styles.productImage} /><Block className={styles.label} /><Block className={styles.caption} /></Panel>)}</div><Panel><Block className={styles.title} /><Rows count={4} /><Block className={styles.checkout} /></Panel></div>}
      {page === "transactions" && <Panel><Block className={styles.label} /><Rows count={8} /></Panel>}
    </div>
  </section>;
}
