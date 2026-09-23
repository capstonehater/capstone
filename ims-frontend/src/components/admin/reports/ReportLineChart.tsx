"use client";

import { useId } from "react";

type ChartPoint = {
  key: string;
  label: string;
  value: number;
  detail?: string;
};

type Props = {
  points: ChartPoint[];
  valueFormatter?: (value: number) => string;
  emptyLabel?: string;
  lineColorClassName?: string;
};

const CHART_WIDTH = 720;
const CHART_HEIGHT = 240;
const PADDING_X = 28;
const PADDING_Y = 20;

function clampNumber(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return value;
}

export default function ReportLineChart({
  points,
  valueFormatter = (value) => value.toLocaleString(),
  emptyLabel = "No chart data is available for the current filters.",
  lineColorClassName = "text-[#f45a1f]",
}: Props) {
  const fillId = useId();
  if (points.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  const safePoints = points.map((point) => ({
    ...point,
    value: clampNumber(point.value),
  }));
  const maxValue = Math.max(...safePoints.map((point) => point.value), 0);
  const minValue = Math.min(...safePoints.map((point) => point.value), 0);
  const valueRange = Math.max(maxValue - minValue, 1);
  const chartInnerWidth = CHART_WIDTH - PADDING_X * 2;
  const chartInnerHeight = CHART_HEIGHT - PADDING_Y * 2;

  const plottedPoints = safePoints.map((point, index) => {
    const x =
      safePoints.length === 1
        ? CHART_WIDTH / 2
        : PADDING_X + (index / (safePoints.length - 1)) * chartInnerWidth;
    const y =
      PADDING_Y +
      chartInnerHeight -
      ((point.value - minValue) / valueRange) * chartInnerHeight;

    return {
      ...point,
      x,
      y,
    };
  });

  const polyline = plottedPoints.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="min-w-0 w-full max-w-full space-y-4">
      <div className="min-w-0 w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className={`block h-auto w-full max-w-full ${lineColorClassName}`}
          role="img"
          aria-label="Line chart"
        >
          <defs>
            <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          <line
            x1={PADDING_X}
            y1={CHART_HEIGHT - PADDING_Y}
            x2={CHART_WIDTH - PADDING_X}
            y2={CHART_HEIGHT - PADDING_Y}
            stroke="currentColor"
            strokeOpacity="0.16"
            strokeWidth="1"
          />

          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={polyline}
          />

          <polygon
            fill={`url(#${fillId})`}
            points={`${polyline} ${plottedPoints[plottedPoints.length - 1]?.x ?? 0},${CHART_HEIGHT - PADDING_Y} ${plottedPoints[0]?.x ?? 0},${CHART_HEIGHT - PADDING_Y}`}
          />

          {plottedPoints.map((point) => (
            <g key={point.key}>
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill="white"
                stroke="currentColor"
                strokeWidth="2"
              />
              <title>
                {`${point.label}: ${valueFormatter(point.value)}${point.detail ? ` (${point.detail})` : ""}`}
              </title>
            </g>
          ))}
        </svg>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(112px,100%),1fr))] gap-2 text-xs text-slate-500">
        {plottedPoints.map((point) => (
          <div
            key={point.key}
            className="min-w-0 break-words rounded-2xl border border-slate-200 bg-white px-3 py-2"
          >
            <div className="font-semibold text-slate-700">{point.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {valueFormatter(point.value)}
            </div>
            {point.detail ? <div className="mt-1 text-slate-500">{point.detail}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
