/** Display a recorded duration in readable units, using completed days and hours. */
export function formatStockoutDuration(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "N/A";
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0) return "N/A";
  const totalHours = Math.floor(hours);
  if (totalHours === 0) return hours > 0 ? "Less than 1 hour" : "0 hours";
  const days = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;
  return [[days, "day"], [remainingHours, "hour"]]
    .filter(([count]) => Number(count) > 0)
    .map(([count, unit]) => `${count} ${unit}${count === 1 ? "" : "s"}`)
    .join(", ");
}
