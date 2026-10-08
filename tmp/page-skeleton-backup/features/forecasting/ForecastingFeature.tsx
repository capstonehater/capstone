"use client";

import { formatUnit, formatUnitText } from "@/lib/units";

import headerStyles from "@/components/admin/AdminSectionHeader.module.css";
import { useEffect, useRef, useState } from 'react';
import { Check, CircleAlert, LoaderCircle, RefreshCw } from 'lucide-react';
import AdminDashboardLayout from '@/components/admin/AdminDashboardLayout';
import { fetchForecast, fetchForecastProducts, fetchForecastRun, forecastPeriodDays, forecastTotal, type ForecastProduct, type ForecastResponse, type Recommendation } from '@/lib/forecasting';
import MaterialDropdown from '@/app/admin/forecasting/MaterialDropdown';
import ForecastGraph from '@/app/admin/forecasting/ForecastGraph';
import ForecastNotes from '@/app/admin/forecasting/ForecastNotes';
import styles from '@/app/admin/forecasting/forecasting.module.css';

const number = (value: number | null | undefined) => value == null ? 'N/A' : value.toLocaleString('en-PH', { maximumFractionDigits: 2 });
const summaryQuantity = (value: number | null | undefined, unit: string, convert: boolean) => {
  if (value == null) return 'N/A';
  const largerUnit = { G: 'KG', ML: 'L' }[unit.toUpperCase() as 'G' | 'ML'];
  if (convert && largerUnit && Math.abs(value) >= 1000) {
    return `${(value / 1000).toLocaleString('en-PH', { maximumFractionDigits: 3 })} ${largerUnit}`;
  }
  return `${number(value)} ${unit}`;
};
const materialStatus = (recommendation: Recommendation | undefined) => {
  const label = recommendation?.HasInventoryData ? recommendation.Priority || 'No Data' : 'No Data';
  const tones: Record<string, string> = {
    Critical: styles.statusCritical, High: styles.statusHigh, Medium: styles.statusMedium,
    Low: styles.statusLow, Healthy: styles.statusHealthy,
  };
  return { label, tone: tones[label] ?? styles.statusNeutral };
};
const dateLabel = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export default function ForecastingFeature() {
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRoot = useRef<HTMLDivElement>(null);
  const helpButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!helpOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!helpRoot.current?.contains(event.target as Node)) setHelpOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [helpOpen]);

  const [products, setProducts] = useState<ForecastProduct[]>([]);
  const [productId, setProductId] = useState('');
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [runId, setRunId] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [refreshFeedback, setRefreshFeedback] = useState<'idle' | 'refreshing' | 'success' | 'error'>('idle');
  const manualRefreshPending = useRef(false);
  const refreshRecords = () => {
    if (manualRefreshPending.current) return;
    manualRefreshPending.current = true;
    setRefreshFeedback('refreshing');
    setRefresh((value) => value + 1);
  };
  useEffect(() => {
    if (refreshFeedback !== 'success') return;
    const timer = setTimeout(() => setRefreshFeedback('idle'), 2000);
    return () => clearTimeout(timer);
  }, [refreshFeedback]);
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
    const manualRefresh = manualRefreshPending.current;
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
      if (manualRefresh) {
        manualRefreshPending.current = false;
        setRefreshFeedback('success');
      }
    }).catch((reason: unknown) => { if (active) {
      if (!backgroundUpdate) { setData(null); loadedSelection.current = null; }
      setError(backgroundUpdate ? 'Unable to check for updates. Showing saved records; retrying automatically.' : reason instanceof Error ? reason.message : 'Unable to load forecasts');
      if (manualRefresh) {
        manualRefreshPending.current = false;
        setRefreshFeedback('error');
      }
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
          if (result.run.status === 'FAILED') setError('The forecast could not be updated. An automatic retry will follow; saved periods remain available.');
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
  const periodDays = run ? forecastPeriodDays(run) : null;
  const rows = loading ? [] : run?.series ?? [];
  const selected = rows.find((row) => row.materialId === materialId) ?? rows[0];
  const restocks = rows.filter((row) => (row.recommendation?.data.RecommendedPurchase ?? 0) > 0)
    .sort((a, b) => (a.recommendation?.data.DaysRemaining ?? Infinity) - (b.recommendation?.data.DaysRemaining ?? Infinity));
  const critical = restocks.filter((row) => row.recommendation?.data.Priority === 'Critical');
  const chartPoints = selected?.points ?? [];
  const busy = Boolean(runId);

  return <AdminDashboardLayout showHeader={false}><div className={styles.workspace}>
    <header className={headerStyles.panel}>
      <div ref={helpRoot} className={styles.titleRow} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHelpOpen(false);
      }} onKeyDown={(event) => {
        if (event.key === 'Escape' && helpOpen) { setHelpOpen(false); helpButton.current?.focus(); }
      }}>
        <h1>Raw Material Usage Forecast</h1>
        <button ref={helpButton} type="button" className={styles.forecastHelpButton} aria-label="About stock forecasts" aria-expanded={helpOpen} aria-controls={helpOpen ? 'forecast-help' : undefined} onClick={() => setHelpOpen((open) => !open)}>
          <CircleAlert size={20} aria-hidden="true" />
        </button>
        {helpOpen && <div id="forecast-help" role="region" aria-label="About stock forecasts" className={styles.forecastHelp}>
          <p>See how much stock you may need and what to buy. Choose a saved period in the graph, then a product or material to explore.</p>
          <p>Forecasts cover seven days and are prepared automatically after the current period ends (Philippine time).</p>
          {!loading && run && <p>{data?.scope} Displaying {dateLabel(run.startDate)} - {dateLabel(run.endDate)}. History through {run.historyEnd ? dateLabel(run.historyEnd) : 'N/A'}. Stock snapshot saved {new Date(run.createdAt).toLocaleString('en-PH')}.</p>}
        </div>}
      </div>
      <p>Review material usage forecasts and plan upcoming stock purchases.</p>
    </header>
    <div className={styles.stats}>
      {[
        ['Materials Forecasted', loading ? '...' : String(rows.length), 'Materials with usage estimates'],
        ['Restock Needed', loading ? '...' : String(restocks.length), 'Based on stock when this was saved'],
        ['Critical Materials', loading ? '...' : String(critical.length), 'May run out in the first two days'],
        ['Forecasted Period', periodDays ? `${periodDays} ${periodDays === 1 ? 'Day' : 'Days'}` : '...', run ? `${dateLabel(run.startDate)} - ${dateLabel(run.endDate)}` : 'Waiting for the first saved period'],
      ].map(([label, value, detail]) => <section key={label} className={styles.stat}><p>{label}</p><strong>{value}</strong><div className={styles.statDetail}>{detail}</div></section>)}
    </div>
    <div className={styles.filters}>
      <div className={styles.periodPicker}><span className={styles.filterLabel}>Latest saved forecast</span><strong>{data?.periods[0] ? `${dateLabel(data.periods[0].startDate)} – ${dateLabel(data.periods[0].endDate)}` : 'None yet'}</strong></div>
      <MaterialDropdown products={products} value={productId} onChange={setProductId} />
      <div className={styles.refreshActions}>
        <button type="button" className={`${styles.suggestionsButton} ${styles.refreshButton}`} onClick={refreshRecords} disabled={refreshFeedback === 'refreshing'} aria-busy={refreshFeedback === 'refreshing'}>
          {refreshFeedback === 'success' ? <Check size={18} className={styles.refreshComplete} aria-hidden="true" /> : refreshFeedback === 'error' ? <CircleAlert size={18} aria-hidden="true" /> : <RefreshCw size={18} className={refreshFeedback === 'refreshing' ? styles.refreshSpinner : undefined} aria-hidden="true" />}
          <span aria-live="polite">{refreshFeedback === 'refreshing' ? 'Refreshing…' : refreshFeedback === 'success' ? 'Refreshed' : refreshFeedback === 'error' ? 'Retry refresh' : 'Refresh records'}</span>
        </button>
      </div>
    </div>
    {data?.automaticRetryPending && !busy && <p role="status" className={`${styles.errorMessage} ${styles.noticePill}`}>Update delayed. Retries hourly. Saved periods available.</p>}
    {error && <p role="alert" className={styles.errorMessage}>{error}</p>}
    {notice && <p role="status" className={styles.message}>{notice}</p>}
    {busy && <p role="status" className={styles.running}><LoaderCircle size={18} className="animate-spin" />Your next forecast is being prepared automatically. This may take several minutes. You can still browse saved periods.</p>}
    {loading ? <p role="status">Loading saved forecasts...</p> : !run ? <section className={styles.panel}><h2>No forecasts yet</h2><p>The system prepares your first forecast automatically while the server is running. The saved period will appear here when it is ready.</p></section> : <>
      <ForecastNotes run={run} title="Latest Forecast Notes" />
      {!rows.length ? <section className={styles.panel}><h2>No matching forecast</h2><p>This product has no recipe ingredients with saved forecasts. Check its recipe and historical raw-material data.</p></section> : <>
        <ForecastGraph periods={data?.periods ?? []} currentRun={run} productId={productId} materialId={selected.materialId} onMaterialChange={setMaterialId} materials={rows} />
        <div className={styles.columns}>
          <section className={`${styles.panel} ${styles.insights}`}><h2>What this means</h2><ul className={styles.insightList}>
            <li>{selected.name}: {number(forecastTotal(selected))} {formatUnit(selected.unit)} expected over {periodDays} {periodDays === 1 ? 'day' : 'days'}.</li>
            <li>Average daily usage: {number(selected.recommendation?.data.DailyDemand)} {formatUnit(selected.unit)}.</li>
            <li>{formatUnitText(selected.recommendation?.data.Recommendation ?? 'No inventory recommendation available.')}</li>
          </ul><button className={styles.suggestionsButton} aria-expanded={suggestions} onClick={() => setSuggestions(!suggestions)}>{suggestions ? 'Hide' : 'View'} Reorder Suggestions</button>
            {suggestions && <div className={styles.suggestions} tabIndex={0} role="region" aria-label="Reorder suggestions">{restocks.length ? restocks.map((row) => <p key={row.id}><strong>{row.name}:</strong> {formatUnitText(row.recommendation?.data.Recommendation ?? "")}</p>) : <p>No purchases are recommended for the available stock records.</p>}</div>}
          </section>
          <section className={`${styles.panel} ${styles.breakdown}`}>
            <div className={styles.summaryHeader}>
              <div><h2 id="weekly-material-summary">Material forecast summary</h2><p>{rows.length} materials &middot; Status based on saved stock</p></div>
              <button type="button" className={styles.convertButton} aria-pressed={convertSummary} onClick={() => setConvertSummary((value) => !value)}>{convertSummary ? 'Original units' : 'Convert'}</button>
            </div>
            <div className={`${styles.tableScroll} ${styles.summaryScroll}`} tabIndex={0} role="region" aria-labelledby="weekly-material-summary">
              <table>
                <thead><tr><th scope="col">Material</th><th scope="col">Status</th><th scope="col">{periodDays}-day usage</th><th scope="col">Daily average</th><th scope="col">Change vs prior period</th><th scope="col">Stock coverage</th></tr></thead>
                <tbody>{rows.map((row) => {
                  const status = materialStatus(row.recommendation?.data);
                  return <tr key={row.id}>
                    <th scope="row">{row.name}</th>
                    <td><span className={`${styles.statusBadge} ${status.tone}`} title={formatUnitText(row.recommendation?.data.Recommendation ?? "")}>{status.label}</span></td>
                    <td>{summaryQuantity(forecastTotal(row), formatUnit(row.unit), convertSummary)}</td>
                    <td>{summaryQuantity(row.recommendation?.data.DailyDemand, formatUnit(row.unit), convertSummary)}</td>
                    <td>{row.metadata.changePercent == null ? 'N/A' : `${row.metadata.changePercent > 0 ? '+' : ''}${number(row.metadata.changePercent)}%`}</td>
                    <td>{row.recommendation?.data.HasInventoryData ? (row.recommendation.data.DaysRemaining == null ? 'N/A' : `${number(row.recommendation.data.DaysRemaining)} days`) : 'No stock data'}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </section>
        </div>
        <section className={styles.panel} style={{ marginTop: 16 }}><h2>{selected.name}: Daily Forecast</h2><div className={styles.tableScroll}><table><thead><tr><th>Date</th><th>Expected usage ({formatUnit(selected.unit)})</th><th>Lower estimate ({formatUnit(selected.unit)})</th><th>Upper estimate ({formatUnit(selected.unit)})</th></tr></thead><tbody>{chartPoints.map((point) => <tr key={point.date}><td>{dateLabel(point.date)}</td><td>{number(Number(point.forecast))}</td><td>{number(Number(point.lower95))}</td><td>{number(Number(point.upper95))}</td></tr>)}</tbody></table></div></section>
      </>}
    </>}
  </div></AdminDashboardLayout>;
}
