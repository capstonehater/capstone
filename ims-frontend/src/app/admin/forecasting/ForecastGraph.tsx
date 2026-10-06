"use client";

import { formatUnit } from "@/lib/units";

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, PanelTop, PanelsLeftRight } from 'lucide-react';
import { fetchForecast, forecastPeriodDays, forecastTotal, type ForecastResponse, type ForecastRun, type ForecastSeries } from '@/lib/forecasting';
import GraphSelect from './GraphSelect';
import ForecastNotes from './ForecastNotes';
import styles from './forecasting.module.css';

const number = (value: number) => value.toLocaleString('en-PH', { maximumFractionDigits: 2 });
const dateLabel = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
type Period = ForecastResponse['periods'][number];

function PeriodChart({ run, series, scale }: { run: ForecastRun | null; series?: ForecastSeries; scale: number }) {
  const tooltipId = useId();
  const chartRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(850);
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(entry.contentRect.width);
    });
    observer.observe(chart);
    return () => observer.disconnect();
  }, [run, series]);
  const [hovered, setHovered] = useState<{ key: string; date: string; left: number; top: number } | null>(null);
  useEffect(() => {
    if (!hovered) return;
    const dismiss = () => setHovered(null);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [hovered]);
  if (!run || !series) return <p className={styles.graphEmpty}>No saved forecast for this material in this period.</p>;
  const points = series.points;
  const chartKey = `${run.id}:${series.materialId}`;
  const activePoint = hovered?.key === chartKey ? points.find((point) => point.date === hovered.date) : undefined;
  const showPoint = (element: SVGCircleElement, date: string) => {
    const bounds = element.getBoundingClientRect();
    const tooltipWidth = Math.min(280, window.innerWidth - 24);
    setHovered({ key: chartKey, date,
      left: Math.max(12, Math.min(bounds.left + bounds.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 12)),
      top: Math.max(12, Math.min(bounds.top >= 148 ? bounds.top - 140 : bounds.bottom + 12, window.innerHeight - 140)),
    });
  };
  const rangeExceedsScale = points.some((point) => Number(point.upper95) > scale);
  const leftPadding = Math.min(width * 0.35, Math.max(48, number(scale).length * 9 + 20));
  const rightPadding = 28;
  const plotWidth = Math.max(1, width - leftPadding - rightPadding);
  const labelStep = Math.max(1, Math.ceil((points.length - 1) * 64 / plotWidth));
  const x = (index: number) => points.length === 1 ? leftPadding + plotWidth / 2 : leftPadding + index * plotWidth / (points.length - 1);
  const position = (value: number, index: number) => `${x(index)},${170 - value / scale * 140}`;
  return <>
    <div ref={chartRef} className={styles.liveChart}><svg viewBox={`0 0 ${width} 215`} role="group" aria-label={`Daily expected usage for ${series.name}, ${dateLabel(run.startDate)} to ${dateLabel(run.endDate)}, in ${formatUnit(series.unit)}. Shaded area shows the possible range.`}>
      {[0, 0.5, 1].map((fraction) => <g key={fraction}><line x1={leftPadding} x2={width - rightPadding} y1={170-fraction*140} y2={170-fraction*140} stroke="#ddd" /><text x={leftPadding - 12} y={174-fraction*140} textAnchor="end" fontSize="15" fill="#334155">{number(scale*fraction)}</text></g>)}
      <polygon points={[...points.map((point, index) => position(Math.min(Number(point.upper95), scale), index)), ...points.map((point, index) => position(Math.max(0, Number(point.lower95)), index)).reverse()].join(' ')} fill="#17840018" />
      <polyline points={points.map((point, index) => position(Number(point.forecast), index)).join(' ')} fill="none" stroke="#178400" strokeWidth="2" />
      {points.map((point, index) => <g key={point.date}>
        <circle cx={x(index)} cy={170-Number(point.forecast)/scale*140} r={activePoint?.date === point.date ? 6 : 4} fill="#178400" stroke={activePoint?.date === point.date ? '#fff' : 'none'} strokeWidth="2" pointerEvents="none" />
        <circle className={styles.chartPointTarget} cx={x(index)} cy={170-Number(point.forecast)/scale*140} r="13" fill="transparent" tabIndex={0} role="button"
          aria-label={`${dateLabel(point.date)}: expected usage ${number(Number(point.forecast))} ${formatUnit(series.unit)}; possible range ${number(Number(point.lower95))} to ${number(Number(point.upper95))} ${formatUnit(series.unit)}`}
          aria-describedby={activePoint?.date === point.date ? tooltipId : undefined}
          onPointerEnter={(event) => showPoint(event.currentTarget, point.date)} onPointerLeave={() => setHovered(null)}
          onFocus={(event) => showPoint(event.currentTarget, point.date)} onBlur={() => setHovered(null)}
          onClick={(event) => showPoint(event.currentTarget, point.date)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { event.preventDefault(); setHovered(null); }
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showPoint(event.currentTarget, point.date); }
          }} />
        {index % labelStep === 0 && <text x={x(index)} y="195" textAnchor="middle" fontSize="15" fill="#334155">{point.date.slice(5, 10)}</text>}
      </g>)}
    </svg></div>
    {activePoint && hovered && createPortal(<div id={tooltipId} role="tooltip" className={styles.chartTooltip} style={{ left: hovered.left, top: hovered.top }}>
      <strong>{dateLabel(activePoint.date)}</strong>
      <span>Expected usage</span>
      <b>{number(Number(activePoint.forecast))} {formatUnit(series.unit)}</b>
      <small>95% range: {number(Number(activePoint.lower95))} ? {number(Number(activePoint.upper95))} {formatUnit(series.unit)}</small>
    </div>, document.body)}
    {rangeExceedsScale && <p className={styles.graphRangeNote}>The possible range extends above the chart. Its full values remain in the saved forecast.</p>}
    <p className={styles.graphTotal}>{forecastPeriodDays(run)}-day expected usage: <strong>{number(forecastTotal(series))} {formatUnit(series.unit)}</strong></p>
  </>;
}

export default function ForecastGraph({ periods, currentRun, productId, materialId, onMaterialChange, materials }: {
  periods: Period[]; currentRun: ForecastRun; productId: string; materialId: string; onMaterialChange: (id: string) => void; materials: ForecastSeries[];
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRoot = useRef<HTMLDivElement>(null);
  const helpButton = useRef<HTMLButtonElement>(null);
  const helpId = useId();
  useEffect(() => {
    if (!helpOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!helpRoot.current?.contains(event.target as Node)) setHelpOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [helpOpen]);
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
      .catch(() => { if (active) setError('Could not load this saved period. Please choose another.'); });
    return () => { active = false; };
  }, [mode, singleId, productId]);

  useEffect(() => {
    if (mode !== 'compare') return;
    let active = true;
    Promise.all([leftId === currentRun.id ? Promise.resolve({ run: currentRun }) : fetchForecast(productId, leftId),
      rightId === currentRun.id ? Promise.resolve({ run: currentRun }) : fetchForecast(productId, rightId)])
      .then(([leftResult, rightResult]) => { if (active) { setLeft(leftResult.run); setRight(rightResult.run); setError(''); } })
      .catch(() => { if (active) setError('Could not load one of the saved periods. Please choose a period again.'); });
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
  const materialOptions = materials.map((row) => ({ value: row.materialId, label: `${row.name} (${formatUnit(row.unit)})` }));
  return <section className={styles.panel}>
    <div className={styles.graphHeader}>
      <div className={styles.viewControls} role="group" aria-label="Graph view">
        <button type="button" className={mode === 'single' ? styles.viewActive : ''} aria-pressed={mode === 'single'} onClick={() => setMode('single')} title="Single view"><PanelTop size={19} aria-hidden="true" /><span>Single</span></button>
        <button type="button" className={mode === 'compare' ? styles.viewActive : ''} aria-pressed={mode === 'compare'} onClick={() => { setLeftId(currentRun.id); setRightId(periods.find((period) => period.id !== currentRun.id)?.id ?? currentRun.id); setMode('compare'); }} title="Compare two periods"><PanelsLeftRight size={19} aria-hidden="true" /><span>Compare</span></button>
      </div>
      <div ref={helpRoot} className={styles.titleRow} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHelpOpen(false);
      }} onKeyDown={(event) => {
        if (event.key === 'Escape' && helpOpen) { setHelpOpen(false); helpButton.current?.focus(); }
      }}>
        <h2>Expected daily usage</h2>
        <button ref={helpButton} type="button" className={styles.forecastHelpButton} aria-label="About saved estimates" aria-expanded={helpOpen} aria-controls={helpOpen ? helpId : undefined} onClick={() => setHelpOpen((open) => !open)}>
          <CircleAlert size={20} aria-hidden="true" />
        </button>
        {helpOpen && <div id={helpId} role="region" aria-label="About saved estimates" className={styles.forecastHelp}>
          <p><strong>Saved estimate.</strong> Check live stock before ordering.</p>
        </div>}
      </div>
      <GraphSelect label="Material" value={selected.materialId} options={materialOptions} onChange={onMaterialChange} className={styles.graphMaterialSelect} />
    </div>
    {mode === 'single' ? <>
      {error && <p role="alert" className={styles.errorMessage}>{error}</p>}
      <div className={styles.graphGrid}><div className={styles.graphWeek}><GraphSelect label="Saved period" value={singleId} onChange={setSingleId} options={[{ value: '', label: `Latest: ${dateLabel(currentRun.startDate)} – ${dateLabel(currentRun.endDate)}` }, ...weekOptions.filter((option) => option.value !== currentRun.id)]} />{singleRun ? <PeriodChart run={singleRun} series={singleSeries} scale={scale} /> : <p className={styles.graphEmpty}>Loading saved forecast...</p>}</div></div>
    </> : <>
      {periods.length < 2 && <p className={styles.graphHint}>Only one saved period is available. Another period will appear automatically after the next forecast.</p>}
      {error && <p role="alert" className={styles.errorMessage}>{error}</p>}
      <div className={`${styles.graphGrid} ${styles.graphCompare}`}>
        <div className={styles.graphWeek}><GraphSelect label="First period" value={leftId} onChange={setLeftId} options={weekOptions} />{leftRun ? <PeriodChart run={leftRun} series={leftSeries} scale={scale} /> : <p className={styles.graphEmpty}>Loading saved forecast...</p>}</div>
        <div className={styles.graphWeek}><GraphSelect label="Second period" value={rightId} onChange={setRightId} options={weekOptions} />{rightRun ? <PeriodChart run={rightRun} series={rightSeries} scale={scale} /> : <p className={styles.graphEmpty}>Loading saved forecast...</p>}</div>
      </div>
      {leftId === rightId && <p className={styles.graphHint}>Choose different periods to compare changes.</p>}
    </>}
    {mode === 'single' && singleRun && singleRun.id !== currentRun.id && <ForecastNotes key={singleRun.id} run={singleRun} />}
    {mode === 'compare' && leftRun && <ForecastNotes key={`left-${leftRun.id}`} run={leftRun} />}
    {mode === 'compare' && rightRun && rightRun.id !== leftRun?.id && <ForecastNotes key={`right-${rightRun.id}`} run={rightRun} />}
    <p className={styles.message}>The green line shows expected usage in {formatUnit(selected.unit)}. The shaded area shows a possible range; wider means less certain.{mode === 'compare' ? ' Both graphs use the same scale.' : ''}</p>
    <details className={styles.dataNotes}><summary>Technical accuracy details</summary><p>Shading represents the model’s 95% forecast interval.{mode === 'single' && singleSeries ? ` Historical validation error (MAPE): ${singleSeries.metadata.metrics.mape == null ? 'N/A' : `${number(singleSeries.metadata.metrics.mape)}%`}.` : ''} This measures past prediction error, not guaranteed future accuracy.</p></details>
  </section>;
}
