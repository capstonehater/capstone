import { formatUnit } from './units';

export type ReportMaterialQuantity = { unit: string; quantity: string };

const quantityFormatter = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 4 });
const pieceFormatter = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 });

export function formatUsableQuantity(value: string | number) {
  return pieceFormatter.format(Number(value));
}

export function formatReportQuantity(value: string | number, unit?: string) {
  const formatter = unit && formatUnit(unit) === 'pc' ? pieceFormatter : quantityFormatter;
  return formatter.format(Number(value));
}

export function formatReportQuantities(groups: ReportMaterialQuantity[] | undefined) {
  return groups?.length
    ? groups.map(group => `${formatReportQuantity(group.quantity, group.unit)} ${formatUnit(group.unit)}`).join(' · ')
    : 'No material usage';
}
