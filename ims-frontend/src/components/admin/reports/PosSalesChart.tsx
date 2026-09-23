import styles from "./PosReports.module.css";

type Point = { key: string; label: string; value: number; detail?: string };
export default function PosSalesChart({ points, valueFormatter, emptyLabel }: { points: Point[]; valueFormatter: (value: number) => string; emptyLabel: string }) {
  if (!points.length) return <p className="py-12 text-center text-sm text-slate-500">{emptyLabel}</p>;
  const values = points.map(point => Number.isFinite(point.value) ? point.value : 0);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(1, ...values);
  const x = (index: number) => 100 + index / Math.max(1, points.length - 1) * 930;
  const y = (value: number) => 320 - (value - minimum) / (maximum - minimum) * 285;
  return <div className={styles.chart}>
    <svg viewBox="0 0 1080 375" role="img" aria-label="Hourly net sales from 1 PM to 10 PM">
      {Array.from({ length: 6 }, (_, index) => {
        const value = minimum + (maximum - minimum) * index / 5;
        return <g key={index}><line x1="100" x2="1030" y1={y(value)} y2={y(value)} stroke="#e6e6e6" /><text x="88" y={y(value) + 4} textAnchor="end" fontSize="12" fill="#777">{valueFormatter(value)}</text></g>;
      })}
      <polyline points={values.map((value, index) => `${x(index)},${y(value)}`).join(" ")} fill="none" stroke="#165dff" strokeWidth="3" strokeLinejoin="round" />
      {points.map((point, index) => <g key={point.key}><circle cx={x(index)} cy={y(values[index])} r="4" fill="#165dff"><title>{point.label}: {valueFormatter(values[index])} {point.detail}</title></circle><text x={x(index)} y="348" textAnchor="middle" fontSize="12" fill="#666">{point.label}</text></g>)}
    </svg>
    <div className={styles.chartLegend}>Net sales (₱)</div>
    <details className="mt-3 text-xs text-slate-500"><summary className="cursor-pointer">View hourly values</summary><table className="mt-2 w-full text-left"><thead><tr><th>Hour</th><th>Net sales</th><th>Transactions</th></tr></thead><tbody>{points.map((point, index) => <tr key={point.key}><td>{point.label}</td><td>{valueFormatter(values[index])}</td><td>{point.detail}</td></tr>)}</tbody></table></details>
  </div>;
}
