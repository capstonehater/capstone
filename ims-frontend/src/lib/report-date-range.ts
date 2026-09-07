export type QuickDatePreset = "today" | "yesterday" | "this-week" | "monthly" | "custom";

const MANILA_OFFSET = "+08:00";

function formatDateInput(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string) {
  return new Date(`${value}T12:00:00${MANILA_OFFSET}`);
}

function shiftDateInput(value: string, offsetDays: number) {
  const date = parseDateInput(value);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return formatDateInput(date);
}

export function getTodayDateInput() {
  return formatDateInput(new Date());
}

export function shiftManilaDateInput(value: string, offsetDays: number) {
  return shiftDateInput(value, offsetDays);
}

export function getPresetDateRange(preset: Exclude<QuickDatePreset, "custom">) {
  const today = getTodayDateInput();

  if (preset === "today") {
    return { from: today, to: today };
  }

  if (preset === "yesterday") {
    const yesterday = shiftDateInput(today, -1);
    return { from: yesterday, to: yesterday };
  }

  if (preset === "monthly") {
    const monthStart = `${today.slice(0, 8)}01`;
    return { from: monthStart, to: today };
  }

  const weekday = parseDateInput(today).getUTCDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  const monday = shiftDateInput(today, -daysFromMonday);
  return { from: monday, to: today };
}

export function toManilaRangeIso(filters: { from: string; to: string }) {
  return {
    from: `${filters.from}T00:00:00.000${MANILA_OFFSET}`,
    to: `${filters.to}T23:59:59.999${MANILA_OFFSET}`,
  };
}

export function getPresetLabel(preset: QuickDatePreset) {
  switch (preset) {
    case "today":
      return "Today";
    case "yesterday":
      return "Yesterday";
    case "this-week":
      return "This Week";
    case "monthly":
      return "Monthly";
    default:
      return "Custom Range";
  }
}

export function getGrowthLabel(preset: QuickDatePreset) {
  switch (preset) {
    case "today":
      return "Growth vs Yesterday";
    case "yesterday":
      return "Growth vs Previous Day";
    case "this-week":
      return "Growth vs Previous 7 Days";
    case "monthly":
      return "Growth vs Previous Period";
    default:
      return "Growth vs Previous Period";
  }
}

export function getSameWeekGrowthLabel(preset: QuickDatePreset) {
  switch (preset) {
    case "today":
      return "Growth vs Same Day Last Week";
    case "yesterday":
      return "Growth vs Same Day Last Week";
    case "this-week":
      return "Growth vs Same Week Last Week";
    case "monthly":
      return "Growth vs Previous Period";
    default:
      return "Growth vs Same Period Last Week";
  }
}
