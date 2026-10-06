import { getPresetDateRange, shiftManilaDateInput, type QuickDatePreset } from "./report-date-range";

export function getPosReportDateBounds(preset: QuickDatePreset) {
  if (preset === "custom") return {};
  const range = getPresetDateRange(preset);
  return {
    min: range.from,
    max: preset === "this-week" ? shiftManilaDateInput(range.from, 6) : range.to,
  };
}

export function validatePosReportDateChange(
  preset: QuickDatePreset,
  field: "from" | "to",
  value: string,
  range: { from: string; to: string },
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Please select a valid date.";
  const bounds = getPosReportDateBounds(preset);
  if ((bounds.min && value < bounds.min) || (bounds.max && value > bounds.max)) {
    return "Select a date within the active preset, or choose Custom Date to use another date.";
  }
  const nextRange = { ...range, [field]: value };
  if (nextRange.from > nextRange.to) {
    return "Invalid date range. The From date cannot be later than the To date.";
  }
  return null;
}
