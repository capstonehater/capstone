export function getBusinessDate(date = new Date()): Date {
  const businessDate = new Date(date);
  businessDate.setHours(0, 0, 0, 0);
  return businessDate;
}
