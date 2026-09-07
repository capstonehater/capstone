export const MANILA_TIMEZONE = 'Asia/Manila';
const MANILA_OFFSET = '+08:00';

export function formatManilaBusinessDateInput(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function getTodayManilaBusinessDateInput(date = new Date()) {
  return formatManilaBusinessDateInput(date);
}

export function parseBusinessDateToDateOnlyUtc(value: string) {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1, 0, 0, 0, 0));
}

export function getManilaBusinessDateRange(value: string) {
  return {
    from: new Date(`${value}T00:00:00.000${MANILA_OFFSET}`),
    to: new Date(`${value}T23:59:59.999${MANILA_OFFSET}`),
  };
}

export function shiftManilaBusinessDateInput(
  value: string,
  offsetDays: number,
) {
  const date = parseBusinessDateToDateOnlyUtc(value);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return formatManilaBusinessDateInput(date);
}

export function getManilaWeekStartBusinessDate(value: string) {
  const weekday = parseBusinessDateToDateOnlyUtc(value).getUTCDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  return shiftManilaBusinessDateInput(value, -daysFromMonday);
}
