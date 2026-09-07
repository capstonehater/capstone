export type SizeOption = {
  label: string;
  priceModifier: number;
};

export type TempOption = {
  label: string;
  priceModifier: number;
};

export type AddonOption = {
  label: string;
  price: number;
};

export type ProductCategory = "Coffee" | "Pastries" | "Snacks";

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  basePrice: number;
  bestseller?: boolean;
  variants: {
    size: SizeOption[];
    temp: TempOption[];
    addons: AddonOption[];
  };
};

export type SelectedAddon = {
  label: string;
  price: number;
  quantity: number;
};

export type CartItem = {
  cartId: string;
  productId: string;
  sku: string;
  name: string;
  size: string;
  temp: string;
  addons: SelectedAddon[];
  note: string;
  qty: number;
  unitPrice: number;
  lineSubtotal: number;
};

export type DiscountType = "none" | "pwd" | "senior";

export type DiscountOption = {
  label: string;
  value: DiscountType;
  rate: number;
};

export type PaymentState = {
  cash: string;
  gcash: string;
  maya: string;
};

export type ReceiptRecord = {
  id: string;
  dateTime: string;
  staffName: string;
  items: CartItem[];
  subtotal: number;
  discountLabel: string;
  discountAmount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  change: number;
  note: string;
  refunded?: boolean;
  refundedAt?: string;
  refundedBy?: string;
};

export type EditingCartItem = {
  cartId: string;
  product: Product;
  currentItem: CartItem;
};

export type ProductConfigPayload = {
  id: string;
  sku: string;
  name: string;
  basePrice: number;
  size: string;
  sizePriceModifier: number;
  temp: string;
  tempPriceModifier: number;
  addons: SelectedAddon[];
  note: string;
};
