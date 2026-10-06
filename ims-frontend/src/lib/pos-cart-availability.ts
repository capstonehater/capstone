import type { PosCartItem, PosMenuVariant } from "./pos";

// Counts all cart lines for the same variant, even with different notes or add-ons.
export function remainingVariantQuantity(
  variant: PosMenuVariant | undefined,
  cart: Pick<PosCartItem, "cartId" | "productVariantId" | "quantity">[],
  excludingCartId?: string,
): number {
  if (!variant?.isEnabled || !variant.availability?.isSellable) return 0;
  const available = variant.availability.availableBaseQty;
  if (!Number.isFinite(available)) return 0;
  const reserved = cart.reduce((total, item) =>
    item.productVariantId === variant.id && item.cartId !== excludingCartId
      ? total + item.quantity : total, 0);
  return Math.max(0, Math.floor(available) - reserved);
}
