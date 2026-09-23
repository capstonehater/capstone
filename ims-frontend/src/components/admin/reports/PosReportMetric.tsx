import { BarChart3, CreditCard, Package, ShoppingCart, Tag, TrendingUp, Undo2, Wallet } from "lucide-react";
import styles from "./PosReports.module.css";

export default function PosReportMetric({ title, value }: { title: string; value: string | number }) {
  const Icon = /refund|reversal/i.test(title) ? Undo2 : /growth/i.test(title) ? TrendingUp : /transaction|order/i.test(title) ? ShoppingCart : /discount|margin/i.test(title) ? Tag : /product|quantity/i.test(title) ? Package : /card|payment/i.test(title) ? CreditCard : /average/i.test(title) ? BarChart3 : Wallet;
  return <article className={styles.metric}><span className={styles.metricIcon}><Icon size={27} strokeWidth={1.8} aria-hidden="true" /></span><div><p>{title}</p><strong>{value}</strong></div></article>;
}
