"use client";

import { useEffect, useState } from 'react';
import { ChevronDown, LoaderCircle } from 'lucide-react';
import AdminDashboardLayout from '@/components/admin/AdminDashboardLayout';
import { fetchForecast, fetchForecastProducts, fetchForecastRun, generateForecast, type ForecastProduct, type ForecastResponse } from '@/lib/forecasting';
import MaterialDropdown from './MaterialDropdown';
import styles from './forecasting.module.css';

const number = (value: number | null | undefined) => value == null ? 'N/A' : value.toLocaleString('en-PH', { maximumFractionDigits: 2 });
const dateLabel = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
function endDate(start: string) {
  if (!start) return '';
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 6);
  return date.toISOString().slice(0, 10);
}
function tomorrow() {
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const next = new Date(`${local}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export default function ForecastingPage() {
  const [products, setProducts] = useState<ForecastProduct[]>([]);
  const [productId, setProductId] = useState('');
  const [start, setStart] = useState('');
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [runId, setRunId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [chartOpen, setChartOpen] = useState(true);
  const [materialId, setMaterialId] = useState('');
  const [suggestions, setSuggestions] = useState(false);

  useEffect(() => { setStart(tomorrow()); }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([fetchForecastProducts(), fetchForecast(productId)]).then(([catalog, result]) => {
      if (!active) return;
      setProducts(catalog.products);
      setData(result);
      if (result.activeRun) setRunId(result.activeRun.id);
    }).catch((reason: unknown) => { if (active) { setData(null); setError(reason instanceof Error ? reason.message : 'Unable to load forecasts'); } })
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
          if (result.run.status === 'FAILED') setError(result.run.error || 'Forecast generation failed. Please try again.');
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
  const max = Math.max(1, ...chartPoints.map((point) => Number(point.upper95)));
  const position = (value: number, index: number) => `${55 + index * 106},${170 - value / max * 140}`;
  const busy = submitting || Boolean(runId);

  return <AdminDashboardLayout><div className={styles.workspace}>
    <h1 className="sr-only">Forecasting</h1>
    <div className={styles.stats}>
      {[
        ['Materials Forecasted', loading ? '...' : String(rows.length), 'With saved SARIMA results'],
        ['Restock Needed', loading ? '...' : String(restocks.length), 'Based on live stock at generation'],
        ['Critical Restock Alerts', loading ? '...' : String(critical.length), 'Stockout within two forecast days'],
        ['Forecast Period', '7 Days', run ? `${dateLabel(run.startDate)} - ${dateLabel(run.endDate)}` : 'Choose a start date below'],
      ].map(([label, value, detail]) => <section key={label} className={styles.stat}><p>{label}</p><strong>{value}</strong><div className={styles.statDetail}>{detail}</div></section>)}
    </div>
    <form className={styles.filters} onSubmit={async (event) => {
      event.preventDefault(); setSubmitting(true); setError(''); setNotice('');
      try { const result = await generateForecast(start); setRunId(result.run.id); }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to start forecast'); }
      finally { setSubmitting(false); }
    }}>
      <MaterialDropdown products={products} value={productId} onChange={setProductId} />
      <div className={styles.dateGroup}><div className={styles.dates}>
        <label className={styles.dateField}><span className={styles.filterLabel}>Forecast start date</span><input required type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label>
        <span className={styles.dateSeparator} aria-hidden="true">&rarr;</span>
        <label className={styles.dateField}><span className={styles.filterLabel}>End date (automatic)</span><input readOnly type="date" value={endDate(start)} /></label>
      </div><div className={styles.datePresets}><span>Forecast period: 7 calendar days</span><button type="button" onClick={() => setStart(tomorrow())}>Start tomorrow</button></div></div>
      <button disabled={busy || !start} className={styles.generate} type="submit">{busy ? 'Generating...' : 'Generate Forecast'}</button>
      <button type="button" className={styles.suggestionsButton} onClick={() => setRefresh((value) => value + 1)}>Refresh</button>
    </form>
    {error && <p role="alert" className={styles.errorMessage}>{error}</p>}
    {notice && <p role="status" className={styles.message}>{notice}</p>}
    {busy && <p role="status" className={styles.running}><LoaderCircle size={18} className="animate-spin" />SARIMA is training and InventoryRecommendation will interpret the results. This can take several minutes. Existing saved results remain available.</p>}
    {loading ? <p role="status">Loading saved forecasts...</p> : !run ? <section className={styles.panel}><h2>No forecasts yet</h2><p>Choose a start date and generate a forecast to save seven days of raw-material demand and restocking recommendations.</p></section> : <>
      <p className={styles.message}>{data?.scope} Displaying {dateLabel(run.startDate)} - {dateLabel(run.endDate)}. History through {run.historyEnd ? dateLabel(run.historyEnd) : 'N/A'}. Stock snapshot saved {new Date(run.createdAt).toLocaleString('en-PH')}.</p>
      {run.warnings.length > 0 && <details className={styles.dataNotes}><summary>Data sources and model notes ({run.warnings.length})</summary><ul>{run.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
      {!rows.length ? <section className={styles.panel}><h2>No matching forecast</h2><p>This product has no recipe ingredients with saved forecasts. Check its recipe and historical raw-material data.</p></section> : <>
        <section className={styles.panel}>
          <div className={styles.chartHeader}><button className={styles.chartToggle} aria-expanded={chartOpen} aria-controls="demand-chart" onClick={() => setChartOpen(!chartOpen)}>Raw Material Demand Forecast <ChevronDown size={17} /></button>
            <label className={styles.chartMaterial}>Material<select value={selected.materialId} onChange={(event) => setMaterialId(event.target.value)}>{rows.map((row) => <option key={row.id} value={row.materialId}>{row.name} ({row.unit})</option>)}</select></label></div>
          {chartOpen && <div id="demand-chart"><div className={styles.liveChart}>
            <svg viewBox="0 0 750 215" role="img" aria-label={`Seven-day forecast for ${selected.name} in ${selected.unit}; shaded area shows the 95% interval.`}>
              {[0, 0.5, 1].map((fraction) => <g key={fraction}><line x1="55" x2="700" y1={170-fraction*140} y2={170-fraction*140} stroke="#ddd" /><text x="48" y={174-fraction*140} textAnchor="end" fontSize="11" fill="#666">{number(max*fraction)}</text></g>)}
              <polygon points={[...chartPoints.map((point, index) => position(Number(point.upper95), index)), ...chartPoints.map((point, index) => position(Number(point.lower95), index)).reverse()].join(' ')} fill="#17840018" />
              <polyline points={chartPoints.map((point, index) => position(Number(point.forecast), index)).join(' ')} fill="none" stroke="#178400" strokeWidth="2" />
              {chartPoints.map((point, index) => <g key={point.date}><circle cx={55+index*106} cy={170-Number(point.forecast)/max*140} r="4" fill="#178400"><title>{dateLabel(point.date)}: {number(Number(point.forecast))} {selected.unit}</title></circle><text x={55+index*106} y="195" textAnchor="middle" fontSize="12" fill="#666">{point.date.slice(5, 10)}</text></g>)}
            </svg>
          </div><p className={styles.message}>{selected.name} ({selected.unit}) · Shaded area: 95% forecast interval · Validation MAPE: {number(selected.metadata.metrics.mape)}%</p></div>}
        </section>
        <div className={styles.columns}>
          <section className={`${styles.panel} ${styles.insights}`}><h2>Forecast Insights</h2><ul className={styles.insightList}>
            <li>{selected.name}: {number(selected.recommendation?.data.Forecast7Days)} {selected.unit} expected over seven days.</li>
            <li>Average daily usage: {number(selected.recommendation?.data.DailyDemand)} {selected.unit}.</li>
            <li>{selected.recommendation?.data.Recommendation ?? 'No inventory recommendation available.'}</li>
          </ul><button className={styles.suggestionsButton} aria-expanded={suggestions} onClick={() => setSuggestions(!suggestions)}>{suggestions ? 'Hide' : 'View'} Reorder Suggestions</button>
            {suggestions && <div className={styles.suggestions}>{restocks.length ? restocks.map((row) => <p key={row.id}><strong>{row.name}:</strong> {row.recommendation?.data.Recommendation}</p>) : <p>No purchases are recommended for the available stock records.</p>}</div>}
          </section>
          <section className={styles.panel}><h2>Critical Restock Alerts</h2><div className={styles.stockCards}>{critical.length ? critical.map((row) => <div key={row.id} className={`${styles.stockCard} ${styles.criticalCard}`}><div><strong>{row.name}</strong><p>Stock: {number(row.recommendation?.data.CurrentStock)} {row.unit}</p></div><small>Critical</small></div>) : <p>No critical alerts in this forecast.</p>}</div></section>
          <section className={`${styles.panel} ${styles.breakdown}`}><h2>Material Forecast Breakdown</h2><div className={styles.tableScroll}><table><thead><tr><th>Material</th><th>7-day usage</th><th>Daily average</th><th>vs Last 7 Days of History</th><th>Stock coverage</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.name}</td><td>{number(row.recommendation?.data.Forecast7Days)} {row.unit}</td><td>{number(row.recommendation?.data.DailyDemand)} {row.unit}</td><td>{row.metadata.changePercent == null ? 'N/A' : `${row.metadata.changePercent > 0 ? '+' : ''}${number(row.metadata.changePercent)}%`}</td><td>{row.recommendation?.data.HasInventoryData ? `${number(row.recommendation.data.DaysRemaining)} days` : 'No stock data'}</td></tr>)}</tbody></table></div></section>
          <section className={`${styles.panel} ${styles.recommendationsPanel}`}><h2>Restock Recommendations</h2><div className={`${styles.stockCards} ${styles.recommendationsList}`}>{restocks.length ? restocks.map((row) => <div key={row.id} className={`${styles.stockCard} ${row.recommendation?.data.Priority === 'Critical' ? styles.criticalCard : styles.lowCard}`}><div><strong>{row.name}</strong><p>Buy {number(row.recommendation?.data.RecommendedPurchase)} {row.unit}</p><p>Coverage: {number(row.recommendation?.data.DaysRemaining)} days</p></div><small>{row.recommendation?.data.Priority}</small></div>) : <p>No restocking needed.</p>}</div></section>
        </div>
        <section className={styles.panel} style={{ marginTop: 16 }}><h2>{selected.name}: Daily Forecast</h2><div className={styles.tableScroll}><table><thead><tr><th>Date</th><th>Forecast ({selected.unit})</th><th>Lower 95%</th><th>Upper 95%</th></tr></thead><tbody>{chartPoints.map((point) => <tr key={point.date}><td>{dateLabel(point.date)}</td><td>{number(Number(point.forecast))}</td><td>{number(Number(point.lower95))}</td><td>{number(Number(point.upper95))}</td></tr>)}</tbody></table></div></section>
      </>}
    </>}
  </div></AdminDashboardLayout>;
}
