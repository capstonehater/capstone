"use client";

import { useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import AdminDashboardLayout from '@/components/admin/AdminDashboardLayout';
import { fetchForecast, fetchForecastProducts, fetchForecastRun, type ForecastProduct, type ForecastResponse } from '@/lib/forecasting';
import MaterialDropdown from './MaterialDropdown';
import ForecastGraph from './ForecastGraph';
import styles from './forecasting.module.css';

const number = (value: number | null | undefined) => value == null ? 'N/A' : value.toLocaleString('en-PH', { maximumFractionDigits: 2 });
const summaryQuantity = (value: number | null | undefined, unit: string, convert: boolean) => {
  if (value == null) return 'N/A';
  const largerUnit = { G: 'KG', ML: 'L' }[unit.toUpperCase() as 'G' | 'ML'];
  if (convert && largerUnit && Math.abs(value) >= 1000) {
    return `${(value / 1000).toLocaleString('en-PH', { maximumFractionDigits: 3 })} ${largerUnit}`;
  }
  return `${number(value)} ${unit}`;
};
const dateLabel = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export default function ForecastingPage() {
  const [products, setProducts] = useState<ForecastProduct[]>([]);
  const [productId, setProductId] = useState('');
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [runId, setRunId] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [materialId, setMaterialId] = useState('');
  const [suggestions, setSuggestions] = useState(false);
  const [convertSummary, setConvertSummary] = useState(false);
  const loadedSelection = useRef<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setRefresh((value) => value + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    const selection = productId;
    const backgroundUpdate = loadedSelection.current === selection;
    Promise.resolve().then(() => {
      // Keep mounted charts and scroll containers intact during routine updates.
      if (active) { if (!backgroundUpdate) setLoading(true); setError(''); }
      return Promise.all([fetchForecastProducts(), fetchForecast(productId)]);
    }).then(([catalog, result]) => {
      if (!active) return;
      setProducts(catalog.products);
      setData(result);
      loadedSelection.current = selection;
      if (result.activeRun) setRunId(result.activeRun.id);
    }).catch((reason: unknown) => { if (active) {
      if (!backgroundUpdate) { setData(null); loadedSelection.current = null; }
      setError(backgroundUpdate ? 'Unable to check for updates. Showing saved records; retrying automatically.' : reason instanceof Error ? reason.message : 'Unable to load forecasts');
    } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId, refresh]);

  useEffect(() => {
    if (!runId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await fetchForecastRun(runId);
        if (!active) return;
        if (result.run.status !== 'RUNNING') {
          setRunId('');
          if (result.run.status === 'FAILED') setError('The forecast could not be updated. An automatic retry will follow; saved weeks remain available.');
          else { setNotice('Forecast and inventory recommendations saved.'); setRefresh((value) => value + 1); }
          return;
        }
      } catch (reason) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'Unable to check generation status. Retrying...');
      }
      if (active) timer = setTimeout(() => { void poll(); }, 3000);
    };
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [runId]);

  const run = data?.run;
  const rows = loading ? [] : run?.series ?? [];
  const selected = rows.find((row) => row.materialId === materialId) ?? rows[0];
  const restocks = rows.filter((row) => (row.recommendation?.data.RecommendedPurchase ?? 0) > 0)
    .sort((a, b) => (a.recommendation?.data.DaysRemaining ?? Infinity) - (b.recommendation?.data.DaysRemaining ?? Infinity));
  const critical = restocks.filter((row) => row.recommendation?.data.Priority === 'Critical');
  const chartPoints = selected?.points ?? [];
  const busy = Boolean(runId);

  return <AdminDashboardLayout><div className={styles.workspace}>
    <header className={styles.intro}><h1>Weekly stock forecast</h1><p>See how much stock you may need and what to buy. Choose a week in the graph, then a product or material to explore.</p><p>New forecasts are saved automatically every 7 days (Philippine time). {data?.nextScheduledDate && <>Next scheduled week starts {dateLabel(data.nextScheduledDate)}.</>}</p></header>
    <div className={styles.stats}>
      {[
        ['Materials Forecasted', loading ? '...' : String(rows.length), 'Materials with usage estimates'],
        ['Restock Needed', loading ? '...' : String(restocks.length), 'Based on stock when this was saved'],
        ['Materials to check first', loading ? '...' : String(critical.length), 'May run out in the first two days'],
        ['Forecast Period', '7 Days', run ? `${dateLabel(run.startDate)} - ${dateLabel(run.endDate)}` : 'Waiting for the first saved week'],
      ].map(([label, value, detail]) => <section key={label} className={styles.stat}><p>{label}</p><strong>{value}</strong><div className={styles.statDetail}>{detail}</div></section>)}
    </div>
    <div className={styles.filters}>
      <div className={styles.periodPicker}><span className={styles.filterLabel}>Latest saved forecast</span><strong>{data?.periods[0] ? `${dateLabel(data.periods[0].startDate)} – ${dateLabel(data.periods[0].endDate)}` : 'None yet'}</strong></div>
      <MaterialDropdown products={products} value={productId} onChange={setProductId} />
      <button type="button" className={styles.suggestionsButton} onClick={() => setRefresh((value) => value + 1)}>Refresh records</button>
    </div>
    {data?.automaticRetryPending && !busy && <p role="status" className={`${styles.errorMessage} ${styles.noticePill}`}>Update delayed. Retries hourly. Saved weeks available.</p>}
    {error && <p role="alert" className={styles.errorMessage}>{error}</p>}
    {notice && <p role="status" className={styles.message}>{notice}</p>}
    {busy && <p role="status" className={styles.running}><LoaderCircle size={18} className="animate-spin" />Your next weekly forecast is being prepared automatically. This may take several minutes. You can still browse saved weeks.</p>}
    {loading ? <p role="status">Loading saved forecasts...</p> : !run ? <section className={styles.panel}><h2>No forecasts yet</h2><p>The system prepares your first seven-day forecast automatically while the server is running. The saved week will appear here when it is ready.</p></section> : <>
      <p className={`${styles.snapshot} ${styles.noticePill}`}><strong>Saved estimate.</strong> Check live stock before ordering.</p>
      <p className={styles.message}>{data?.scope} Displaying {dateLabel(run.startDate)} - {dateLabel(run.endDate)}. History through {run.historyEnd ? dateLabel(run.historyEnd) : 'N/A'}. Stock snapshot saved {new Date(run.createdAt).toLocaleString('en-PH')}.</p>
      {run.warnings.length > 0 && <details className={styles.dataNotes}><summary>Data sources and model notes ({run.warnings.length})</summary><ul>{run.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
      {!rows.length ? <section className={styles.panel}><h2>No matching forecast</h2><p>This product has no recipe ingredients with saved forecasts. Check its recipe and historical raw-material data.</p></section> : <>
        <ForecastGraph periods={data?.periods ?? []} currentRun={run} productId={productId} materialId={selected.materialId} onMaterialChange={setMaterialId} materials={rows} />
        <div className={styles.columns}>
          <section className={`${styles.panel} ${styles.insights}`}><h2>What this means</h2><ul className={styles.insightList}>
            <li>{selected.name}: {number(selected.recommendation?.data.Forecast7Days)} {selected.unit} expected over seven days.</li>
            <li>Average daily usage: {number(selected.recommendation?.data.DailyDemand)} {selected.unit}.</li>
            <li>{selected.recommendation?.data.Recommendation ?? 'No inventory recommendation available.'}</li>
          </ul><button className={styles.suggestionsButton} aria-expanded={suggestions} onClick={() => setSuggestions(!suggestions)}>{suggestions ? 'Hide' : 'View'} Reorder Suggestions</button>
            {suggestions && <div className={styles.suggestions} tabIndex={0} role="region" aria-label="Reorder suggestions">{restocks.length ? restocks.map((row) => <p key={row.id}><strong>{row.name}:</strong> {row.recommendation?.data.Recommendation}</p>) : <p>No purchases are recommended for the available stock records.</p>}</div>}
          </section>
          <section className={`${styles.panel} ${styles.priorityPanel}`}><h2>Materials to check first</h2><div className={styles.stockCards} tabIndex={0} role="region" aria-label="Materials to check first">{critical.length ? critical.map((row) => <div key={row.id} className={`${styles.stockCard} ${styles.criticalCard}`}><div><strong>{row.name}</strong><p>Stock: {number(row.recommendation?.data.CurrentStock)} {row.unit}</p></div><small>Critical</small></div>) : <p>No critical alerts in this forecast.</p>}</div></section>
          <section className={`${styles.panel} ${styles.breakdown}`}><div className={styles.summaryHeader}><h2>Weekly material summary</h2><button type="button" className={styles.convertButton} aria-pressed={convertSummary} onClick={() => setConvertSummary((value) => !value)}>{convertSummary ? 'Original units' : 'Convert'}</button></div><div className={styles.tableScroll}><table><thead><tr><th>Material</th><th>7-day usage</th><th>Daily average</th><th>Change from previous week</th><th>How long saved stock may last</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.name}</td><td>{summaryQuantity(row.recommendation?.data.Forecast7Days, row.unit, convertSummary)}</td><td>{summaryQuantity(row.recommendation?.data.DailyDemand, row.unit, convertSummary)}</td><td>{row.metadata.changePercent == null ? 'N/A' : `${row.metadata.changePercent > 0 ? '+' : ''}${number(row.metadata.changePercent)}%`}</td><td>{row.recommendation?.data.HasInventoryData ? `${number(row.recommendation.data.DaysRemaining)} days` : 'No stock data'}</td></tr>)}</tbody></table></div></section>
          <section className={`${styles.panel} ${styles.recommendationsPanel}`}><h2>Suggested purchases for this week</h2><div className={`${styles.stockCards} ${styles.recommendationsList}`}>{restocks.length ? restocks.map((row) => <div key={row.id} className={`${styles.stockCard} ${row.recommendation?.data.Priority === 'Critical' ? styles.criticalCard : styles.lowCard}`}><div><strong>{row.name}</strong><p>Buy {number(row.recommendation?.data.RecommendedPurchase)} {row.unit}</p><p>Coverage: {number(row.recommendation?.data.DaysRemaining)} days</p></div><small>{row.recommendation?.data.Priority}</small></div>) : <p>No restocking needed.</p>}</div></section>
        </div>
        <section className={styles.panel} style={{ marginTop: 16 }}><h2>{selected.name}: Daily Forecast</h2><div className={styles.tableScroll}><table><thead><tr><th>Date</th><th>Expected usage ({selected.unit})</th><th>Lower estimate ({selected.unit})</th><th>Upper estimate ({selected.unit})</th></tr></thead><tbody>{chartPoints.map((point) => <tr key={point.date}><td>{dateLabel(point.date)}</td><td>{number(Number(point.forecast))}</td><td>{number(Number(point.lower95))}</td><td>{number(Number(point.upper95))}</td></tr>)}</tbody></table></div></section>
      </>}
    </>}
  </div></AdminDashboardLayout>;
}
