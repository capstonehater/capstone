const wholeQuantityFormatter = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 0,
});

// Round stock totals up for display while retaining precise inventory balances.
export function formatStockQuantity(value: string | number): string {
  return wholeQuantityFormatter.format(Math.ceil(Number(value)));
}
