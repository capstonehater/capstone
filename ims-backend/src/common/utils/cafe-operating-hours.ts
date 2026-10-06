/** Local Asia/Manila hours. Closing time is exclusive. */
export const CAFE_OPERATING_HOURS = {
  openingHour: 13,
  closingHour: 21,
  timezone: 'Asia/Manila',
  label: '1:00 PM–9:00 PM',
} as const;

export function isCafeOperatingHour(hour: number) {
  return hour >= CAFE_OPERATING_HOURS.openingHour && hour < CAFE_OPERATING_HOURS.closingHour;
}
