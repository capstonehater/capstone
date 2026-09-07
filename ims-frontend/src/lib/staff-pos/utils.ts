import { DISCOUNT_OPTIONS, TAX_RATE } from "./data";
import { CartItem, DiscountType, SelectedAddon } from "./types";

export function peso(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value);
}

export function computeAddonTotal(addons: SelectedAddon[]) {
  return addons.reduce((sum, addon) => sum + addon.price * addon.quantity, 0);
}

export function getDiscountConfig(discount: DiscountType) {
  return (
    DISCOUNT_OPTIONS.find((option) => option.value === discount) ||
    DISCOUNT_OPTIONS[0]
  );
}

export function toNumber(value: string) {
  return Number(value) || 0;
}

export function roundUpToPeso(value: number) {
  return Math.ceil(value);
}

export function extractIncludedVat(grossAmount: number) {
  return grossAmount - grossAmount / (1 + TAX_RATE);
}

export function computeTotals(cart: CartItem[], discount: DiscountType) {
  // prices already include VAT
  const subtotal = cart.reduce((sum, item) => sum + item.lineSubtotal, 0);

  const discountConfig = getDiscountConfig(discount);
  const discountAmount = subtotal * discountConfig.rate;

  // apply discount first
  const discountedSubtotal = subtotal - discountAmount;

  // only this part gets rounded up
  const total = roundUpToPeso(discountedSubtotal);

  // VAT is extracted from the rounded total but NOT rounded itself
  const tax = extractIncludedVat(total);

  return {
    subtotal,
    discountConfig,
    discountAmount,
    tax,
    total,
  };
}

export function buildUnitPrice(params: {
  basePrice: number;
  sizePriceModifier: number;
  tempPriceModifier: number;
  addons: SelectedAddon[];
}) {
  return (
    params.basePrice +
    params.sizePriceModifier +
    params.tempPriceModifier +
    computeAddonTotal(params.addons)
  );
}

export function isToday(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}