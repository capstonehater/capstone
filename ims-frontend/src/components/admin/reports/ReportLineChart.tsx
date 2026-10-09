"use client";

import { useId } from "react";

type ChartPoint = { key: string; label: string; axisLabel?: string; xValue?: number; value: number; detail?: string };
type Props = {
  points: ChartPoint[];
  valueFormatter?: (value: number) => string;
  emptyLabel?: string;
  lineColorClassName?: string;
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
};

const WIDTH = 800;
const HEIGHT = 330;
const LEFT = 108;
const RIGHT = 28;
const TOP = 38;
const BOTTOM = 66;

export function chartScale(values: number[]) {
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const rough = (maximum - minimum || 1) / 5;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / magnitude;
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * magnitude;
  const low = Math.floor(minimum / step) * step;
  const high = Math.max(low + step, Math.ceil(maximum / step) * step);
  const ticks = Array.from({ length: Math.round((high - low) / step) + 1 }, (_, i) => Number((low + i * step).toPrecision(12)));
  return { low, high, ticks };
}

export default function ReportLineChart({
  points, valueFormatter = (value) => value.toLocaleString(),
  emptyLabel = "No chart data is available for the current filters.",
  lineColorClassName = "text-[#232d46]", title = "Net sales", xAxisLabel = "Period", yAxisLabel = "Net sales (PHP)",
}: Props) {
  const id = useId();
  if (!points.length) return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">{emptyLabel}</div>;
  const safe = points.map((point, index) => ({ ...point, value: Number.isFinite(point.value) ? point.value : 0, axisX: Number.isFinite(point.xValue) ? point.xValue! : index })).sort((a, b) => a.axisX - b.axisX);
  const { low, high, ticks } = chartScale(safe.map((point) => point.value));
  const y = (value: number) => TOP + (high - value) / (high - low) * (HEIGHT - TOP - BOTTOM);
  const firstX = safe[0].axisX;
  const lastX = safe[safe.length - 1].axisX;
  const plotted = safe.map((point) => ({ ...point,
    x: firstX === lastX ? (LEFT + WIDTH - RIGHT) / 2 : LEFT + (point.axisX - firstX) / (lastX - firstX) * (WIDTH - LEFT - RIGHT),
    y: y(point.value),
  }));
  const line = plotted.map((point) => `${point.x},${point.y}`).join(" ");
  const labelIndices = new Set(Array.from({ length: Math.min(5, plotted.length) }, (_, i) => plotted.length === 1 ? 0 : Math.round(i * (plotted.length - 1) / (Math.min(5, plotted.length) - 1))));

  return <div className="min-w-0 w-full max-w-full space-y-4">
    <div className="w-full overflow-x-auto rounded-lg" tabIndex={0} aria-label={`${title} chart; scroll horizontally on small screens`}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={`block h-auto w-full min-w-[600px] ${lineColorClassName}`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
        <title id={`${id}-title`}>{title}</title>
        <desc id={`${id}-description`}>{`${yAxisLabel} by ${xAxisLabel}. The vertical scale includes zero. Exact values appear below the chart.`}</desc>
        <defs><linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.18" /><stop offset="100%" stopColor="currentColor" stopOpacity="0.02" /></linearGradient></defs>
        <text x={LEFT} y={18} fill="#475569" fontSize={12}>{yAxisLabel}</text>
        {ticks.map((tick) => <g key={tick}>
          <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? "#94a3b8" : "#e2e8f0"} strokeWidth={1} />
          <text x={LEFT - 12} y={y(tick)} dy="0.35em" textAnchor="end" fill="#64748b" fontSize={12}>{valueFormatter(tick)}</text>
        </g>)}
        <line x1={LEFT} x2={LEFT} y1={TOP} y2={HEIGHT - BOTTOM} stroke="#cbd5e1" />
        {plotted.length > 1 && <polygon fill={`url(#${id}-fill)`} points={`${line} ${plotted[plotted.length - 1].x},${y(0)} ${plotted[0].x},${y(0)}`} />}
        <polyline fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" points={line} />
        {plotted.map((point, index) => <g key={point.key}>
          <circle cx={point.x} cy={point.y} r={3.5} fill="white" stroke="currentColor" strokeWidth={2} tabIndex={0} aria-label={`${point.label}: ${valueFormatter(point.value)}${point.detail ? ` (${point.detail})` : ""}`}><title>{`${point.label}: ${valueFormatter(point.value)}${point.detail ? ` (${point.detail})` : ""}`}</title></circle>
          {labelIndices.has(index) && <>
            <line x1={point.x} x2={point.x} y1={HEIGHT - BOTTOM} y2={HEIGHT - BOTTOM + 5} stroke="#94a3b8" />
            <text x={point.x} y={HEIGHT - BOTTOM + 23} textAnchor={index === 0 ? "start" : index === plotted.length - 1 ? "end" : "middle"} fill="#64748b" fontSize={12}>{point.axisLabel ?? point.label}</text>
          </>}
        </g>)}
        <text x={(LEFT + WIDTH - RIGHT) / 2} y={HEIGHT - 10} textAnchor="middle" fill="#475569" fontSize={12}>{xAxisLabel}</text>
      </svg>
    </div>
    <div className="flex items-center gap-2 text-xs text-slate-600"><span className={`inline-block h-0.5 w-6 ${lineColorClassName}`} style={{ backgroundColor: "currentColor" }} />{title}</div>
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(112px,100%),1fr))] gap-2 text-xs text-slate-500">
      {plotted.map((point) => <div key={point.key} className="min-w-0 break-words rounded-2xl border border-slate-200 bg-white px-3 py-2">
        <div className="font-semibold text-slate-700">{point.label}</div>
        <div className="mt-1 text-sm font-semibold text-slate-900">{valueFormatter(point.value)}</div>
        {point.detail && <div className="mt-1 text-slate-500">{point.detail}</div>}
      </div>)}
    </div>
  </div>;
}
