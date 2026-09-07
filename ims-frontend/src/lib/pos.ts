import { apiJsonFetch } from "./api";

export type DecimalString = string;
export type PaymentMethod = "CASH" | "GCASH" | "MAYA" | "CARD" | "OTHER";
export type OrderStatus = "COMPLETED" | "VOIDED" | "REFUNDED";
export type AvailabilityBlockingReason =
  | "NONE"
  | "DISABLED_PRODUCT"
  | "DISABLED_VARIANT"
  | "NO_RECIPE"
  | "INSUFFICIENT_STOCK"
  | "NO_VALID_REQUIRED_MODIFIER";

export type PosMenuCategory = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder?: number;
};

export type PosVariantAvailability = {
  productVariantId: string;
  isInStock: boolean;
  isSellable: boolean;
  availableBaseQty: number;
  blockingReason: AvailabilityBlockingReason;
  updatedAt: string;
};

export type PosMenuVariant = {
  id: string;
  name: string;
  sku: string;
  price: DecimalString;
  isEnabled: boolean;
  availability: PosVariantAvailability | null;
};

export type PosMenuModifier = {
  id: string;
  name: string;
  priceAdjustment: DecimalString;
  isAvailable: boolean;
};

export type PosMenuModifierGroup = {
  id: string;
  modifierGroupId: string;
  name: string;
  selectionMode: "SINGLE" | "MULTIPLE";
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  allowQuantity: boolean;
  modifiers: PosMenuModifier[];
};

export type PosMenuProduct = {
  id: string;
  name: string;
  isEnabled: boolean;
  category: {
    id: string;
    name: string;
    parentId: string | null;
  };
  variants: PosMenuVariant[];
  modifierGroups: PosMenuModifierGroup[];
};

export type PosMenuResponse = {
  categories: PosMenuCategory[];
  products: PosMenuProduct[];
};

export type PosCartModifierSelection = {
  modifierGroupId: string;
  modifierGroupName: string;
  modifierId: string;
  name: string;
  quantity: number;
  unitPriceAdjustment: number;
};

export type PosCartItem = {
  cartId: string;
  productId: string;
  productName: string;
  categoryName: string;
  productVariantId: string;
  variantName: string;
  sku: string;
  quantity: number;
  note: string;
  basePrice: number;
  modifierSelections: PosCartModifierSelection[];
  unitModifierTotal: number;
  unitPrice: number;
  lineSubtotal: number;
};

export type ConfiguredPosCartItemInput = {
  productId: string;
  productName: string;
  categoryName: string;
  productVariantId: string;
  variantName: string;
  sku: string;
  note: string;
  basePrice: number;
  modifierSelections: PosCartModifierSelection[];
};

export type PosOrderPayment = {
  id: string;
  method: PaymentMethod;
  amount: DecimalString;
  reference: string | null;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PosOrderItemModifier = {
  id: string;
  orderItemId: string;
  modifierId: string;
  modifierNameSnapshot: string;
  unitPriceAdjustment: DecimalString;
  quantity: number;
  lineTotal: DecimalString;
  createdAt: string;
  updatedAt: string;
};

export type PosOrderItem = {
  id: string;
  orderId: string;
  productVariantId: string;
  quantity: number;
  unitBasePrice: DecimalString;
  unitModifierAmount: DecimalString;
  unitFinalPrice: DecimalString;
  lineSubtotal: DecimalString;
  unitCogsAmount: DecimalString;
  lineCogsAmount: DecimalString;
  note: string | null;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  skuSnapshot: string;
  createdAt: string;
  updatedAt: string;
  modifiers: PosOrderItemModifier[];
};

export type PosOrder = {
  id: string;
  displayOrderNumber: string;
  status: OrderStatus;
  createdByUserId: string;
  idempotencyKey: string;
  subtotalAmount: DecimalString;
  discountCode: string | null;
  discountRate: DecimalString;
  discountAmount: DecimalString;
  taxAmount: DecimalString;
  totalAmount: DecimalString;
  totalCogsAmount: DecimalString;
  notes: string | null;
  completedAt: string;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  items: PosOrderItem[];
  payments: PosOrderPayment[];
  reversal?: PosOrderReversal | null;
};

export type PosOrderReversal = {
  id: string;
  orderId: string;
  actorUserId: string;
  type: "VOID" | "REFUND";
  reasonCode: string;
  note: string | null;
  amount: DecimalString;
  paymentReference: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  actorUser: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
};

export type PosCheckoutPayload = {
  idempotencyKey: string;
  items: Array<{
    productVariantId: string;
    quantity: number;
    note?: string;
    modifiers: Array<{
      modifierId: string;
      quantity: number;
    }>;
  }>;
  payments: Array<{
    method: PaymentMethod;
    amount: number;
    reference?: string;
  }>;
  discountCode?: string;
  discountRate?: number;
  notes?: string;
};

export type ReverseOrderPayload = {
  approverEmail: string;
  approverPassword: string;
  reasonCode: string;
  note?: string;
  paymentReference?: string;
};

function toQueryString(params: Record<string, string | undefined | null>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function fetchPosMenu() {
  return apiJsonFetch<PosMenuResponse>("/pos/menu");
}

export async function checkoutPos(payload: PosCheckoutPayload) {
  return apiJsonFetch<{
    order: PosOrder;
    idempotentReplay: boolean;
  }>("/pos/checkout", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchOrders(params: {
  from?: string;
  to?: string;
  createdByUserId?: string;
  paymentMethod?: PaymentMethod;
  productVariantId?: string;
  status?: OrderStatus;
  search?: string;
} = {}) {
  const query = toQueryString(params);
  const response = await apiJsonFetch<{ orders: PosOrder[] }>(`/orders${query}`);
  return response.orders;
}

export async function fetchOrder(orderId: string) {
  const response = await apiJsonFetch<{ order: PosOrder }>(`/orders/${orderId}`);
  return response.order;
}

export async function voidOrder(orderId: string, payload: ReverseOrderPayload) {
  const response = await apiJsonFetch<{ order: PosOrder }>(`/orders/${orderId}/void`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.order;
}

export async function refundOrder(orderId: string, payload: ReverseOrderPayload) {
  const response = await apiJsonFetch<{ order: PosOrder }>(`/orders/${orderId}/refund`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.order;
}
