"use client";

import { useEffect, useState } from 'react';
import { PanelTop, PanelsLeftRight } from 'lucide-react';
import { fetchForecast, type ForecastResponse, type ForecastRun, type ForecastSeries } from '@/lib/forecasting';
import GraphSelect from './GraphSelect';
import styles from './forecasting.module.css';

const number = (value: number) => value.toLocaleString('en-PH', { maximumFractionDigits: 2 });
const dateLabel = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
type Period = ForecastResponse['periods'][number];

function WeekChart({ run, series, scale }: { run: ForecastRun | null; series?: ForecastSeries; scale: number }) {
  if (!run || !series) return <p className={styles.graphEmpty}>No saved forecast for this material in this week.</p>;
  const points = series.points;
  const rangeExceedsScale = points.some((point) => Number(point.upper95) > scale);
  const position = (value: number, index: number) => `${55 + index * 106},${170 - value / scale * 140}`;
  return <>
    <div className={styles.liveChart}><svg viewBox="0 0 750 215" role="img" aria-label={`Daily expected usage for ${series.name}, ${dateLabel(run.startDate)} to ${dateLabel(run.endDate)}, in ${series.unit}. Shaded area shows the possible range.`}>
      {[0, 0.5, 1].map((fraction) => <g key={fraction}><line x1="55" x2="700" y1={170-fraction*140} y2={170-fraction*140} stroke="#ddd" /><text x="48" y={174-fraction*140} textAnchor="end" fontSize="11" fill="#666">{number(scale*fraction)}</text></g>)}
      <polygon points={[...points.map((point, index) => position(Math.min(Number(point.upper95), scale), index)), ...points.map((point, index) => position(Math.max(0, Number(point.lower95)), index)).reverse()].join(' ')} fill="#17840018" />
      <polyline points={points.map((point, index) => position(Number(point.forecast), index)).join(' ')} fill="none" stroke="#178400" strokeWidth="2" />
      {points.map((point, index) => <g key={point.date}><circle cx={55+index*106} cy={170-Number(point.forecast)/scale*140} r="4" fill="#178400"><title>{dateLabel(point.date)}: {number(Number(point.forecast))} {series.unit}</title></circle><text x={55+index*106} y="195" textAnchor="middle" fontSize="12" fill="#666">{point.date.slice(5, 10)}</text></g>)}
    </svg></div>
    {rangeExceedsScale && <p className={styles.graphRangeNote}>The possible range extends above the chart. Its full values remain in the saved forecast.</p>}
    <p className={styles.graphTotal}>Seven-day expected usage: <strong>{number(Number(series.recommendation?.data.Forecast7Days ?? points.reduce((sum, point) => sum + Number(point.forecast), 0)))} {series.unit}</strong></p>
  </>;
}

export default function ForecastGraph({ periods, currentRun, productId, materialId, onMaterialChange, materials }: {
  periods: Period[]; currentRun: ForecastRun; productId: string; materialId: string; onMaterialChange: (id: string) => void; materials: ForecastSeries[];
}) {
  const [mode, setMode] = useState<'single' | 'compare'>('single');
  const [singleId, setSingleId] = useState('');
  const [singleSaved, setSingleSaved] = useState<ForecastRun | null>(null);
  const [leftId, setLeftId] = useState(currentRun.id);
  const [rightId, setRightId] = useState(periods.find((period) => period.id !== currentRun.id)?.id ?? currentRun.id);
  const [left, setLeft] = useState<ForecastRun | null>(null);
  const [right, setRight] = useState<ForecastRun | null>(null);
  const [error, setError] = useState('');
  const selected = materials.find((material) => material.materialId === materialId) ?? materials[0];

  useEffect(() => {
    if (!singleId || mode !== 'single') return;
    let active = true;
    fetchForecast(productId, singleId)
      .then((result) => { if (active) { setSingleSaved(result.run); setError(''); } })
      .catch(() => { if (active) setError('Could not load this saved week. Please choose another.'); });
    return () => { active = false; };
  }, [mode, singleId, productId]);

  useEffect(() => {
    if (mode !== 'compare') return;
    let active = true;
    Promise.all([leftId === currentRun.id ? Promise.resolve({ run: currentRun }) : fetchForecast(productId, leftId),
      rightId === currentRun.id ? Promise.resolve({ run: currentRun }) : fetchForecast(productId, rightId)])
      .then(([leftResult, rightResult]) => { if (active) { setLeft(leftResult.run); setRight(rightResult.run); setError(''); } })
      .catch(() => { if (active) setError('Could not load one of the saved weeks. Please choose a week again.'); });
    return () => { active = false; };
  }, [mode, leftId, rightId, currentRun, productId]);

  const singleRun = singleId ? singleSaved?.id === singleId ? singleSaved : null : currentRun;
  const singleSeries = singleRun?.series?.find((series) => series.materialId === selected.materialId);
  const leftRun = left?.id === leftId ? left : null;
  const rightRun = right?.id === rightId ? right : null;
  const leftSeries = leftRun?.series?.find((series) => series.materialId === selected.materialId);
  const rightSeries = rightRun?.series?.find((series) => series.materialId === selected.materialId);
  const shown = mode === 'compare' ? [leftSeries, rightSeries] : [singleSeries];
  // The comparison should show expected usage even if one interval has a very large outlier.
  const scale = Math.max(1, ...shown.flatMap((series) => series?.points.map((point) => Number(point.forecast) * 1.2) ?? []));
  const weekOptions = periods.map((period) => ({ value: period.id, label: `${dateLabel(period.startDate)} – ${dateLabel(period.endDate)}` }));
  const materialOptions = materials.map((row) => ({ value: row.materialId, label: `${row.name} (${row.unit})` }));
  return <section className={styles.panel}>
    <div className={styles.graphHeader}>
      <div className={styles.viewControls} role="group" aria-label="Graph view">
        <button type="button" className={mode === 'single' ? styles.viewActive : ''} aria-pressed={mode === 'single'} onClick={() => setMode('single')} title="Single view"><PanelTop size={19} aria-hidden="true" /><span>Single</span></button>
        <button type="button" className={mode === 'compare' ? styles.viewActive : ''} aria-pressed={mode === 'compare'} onClick={() => { setLeftId(currentRun.id); setRightId(periods.find((period) => period.id !== currentRun.id)?.id ?? currentRun.id); setMode('compare'); }} title="Compare two weeks"><PanelsLeftRight size={19} aria-hidden="true" /><span>Compare</span></button>
      </div>
      <h2>Expected daily usage</h2>
      <GraphSelect label="Material" value={selected.materialId} options={materialOptions} onChange={onMaterialChange} className={styles.graphMaterialSelect} />
    </div>
    {mode === 'single' ? <>
      {error && <p role="alert" className={styles.errorMessage}>{error}</p>}
      <div className={styles.graphGrid}><div className={styles.graphWeek}><GraphSelect label="Saved week" value={singleId} onChange={setSingleId} options={[{ value: '', label: `Latest: ${dateLabel(currentRun.startDate)} – ${dateLabel(currentRun.endDate)}` }, ...weekOptions.filter((option) => option.value !== currentRun.id)]} />{singleRun ? <WeekChart run={singleRun} series={singleSeries} scale={scale} /> : <p className={styles.graphEmpty}>Loading saved forecast...</p>}</div></div>
    </> : <>
      {periods.length < 2 && <p className={styles.graphHint}>Only one saved week is available. Another week will appear automatically after the next forecast.</p>}
      {error && <p role="alert" className={styles.errorMessage}>{error}</p>}
      <div className={`${styles.graphGrid} ${styles.graphCompare}`}>
        <div className={styles.graphWeek}><GraphSelect label="First week" value={leftId} onChange={setLeftId} options={weekOptions} />{leftRun ? <WeekChart run={leftRun} series={leftSeries} scale={scale} /> : <p className={styles.graphEmpty}>Loading saved forecast...</p>}</div>
        <div className={styles.graphWeek}><GraphSelect label="Second week" value={rightId} onChange={setRightId} options={weekOptions} />{rightRun ? <WeekChart run={rightRun} series={rightSeries} scale={scale} /> : <p className={styles.graphEmpty}>Loading saved forecast...</p>}</div>
      </div>
      {leftId === rightId && <p className={styles.graphHint}>Choose different weeks to compare changes.</p>}
    </>}
    <p className={styles.message}>The green line shows expected usage in {selected.unit}. The shaded area shows a possible range; wider means less certain.{mode === 'compare' ? ' Both graphs use the same scale.' : ''}</p>
    <details className={styles.dataNotes}><summary>Technical accuracy details</summary><p>Shading represents the model’s 95% forecast interval.{mode === 'single' && singleSeries ? ` Historical validation error (MAPE): ${singleSeries.metadata.metrics.mape == null ? 'N/A' : `${number(singleSeries.metadata.metrics.mape)}%`}.` : ''} This measures past prediction error, not guaranteed future accuracy.</p></details>
  </section>;
}
