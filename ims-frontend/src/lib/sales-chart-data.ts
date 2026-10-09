import type { PosSalesAnalyticsReport } from "./reports";

export function salesChartPoints(report: PosSalesAnalyticsReport | null) {
  if (!report?.groups.length) return [];
  const grouping = report.filters.groupBy;
  // API boundaries are UTC instants; buckets use calendar dates in Manila.
  const manilaDate = (value: string) => new Date(new Date(value).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const from = new Date(`${manilaDate(report.period.from)}T00:00:00Z`);
  const to = new Date(`${manilaDate(report.period.to)}T00:00:00Z`);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) return [];
  if (grouping === "weekly") from.setUTCDate(from.getUTCDate() - (from.getUTCDay() + 6) % 7);
  if (grouping === "monthly") from.setUTCDate(1);
  const groups = new Map(report.groups.map((group) => [group.bucketKey, group]));
  const points = [];
  while (from <= to) {
    const date = from.toISOString().slice(0, 10);
    const key = grouping === "monthly" ? `month:${date.slice(0, 7)}` : `${grouping === "weekly" ? "week" : "day"}:${date}`;
    const group = groups.get(key);
    points.push({
      key,
      label: group?.label ?? (grouping === "monthly" ? date.slice(0, 7) : date),
      axisLabel: grouping === "monthly" ? date.slice(0, 7) : date,
      xValue: from.getTime(),
      value: Number(group?.netSales ?? 0),
      detail: `${group?.transactionCount ?? 0} ${(group?.transactionCount ?? 0) === 1 ? "transaction" : "transactions"}`,
    });
    if (grouping === "monthly") from.setUTCMonth(from.getUTCMonth() + 1);
    else from.setUTCDate(from.getUTCDate() + (grouping === "weekly" ? 7 : 1));
  }
  return points;
}
