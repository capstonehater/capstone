"use client";
import { PermissionAction } from "@/components/auth/PermissionGuard";

import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import {
  ArrowLeft, Search, ShoppingCart, Trash2, Minus, Plus,
  StickyNote, Pencil, Loader2, Maximize2, Minimize2,
  Coffee, Cookie, Sandwich, Utensils, CupSoda, CakeSlice,
} from "lucide-react";
import type {
  ConfiguredPosCartItemInput, PaymentMethod, PosCartItem, PosCheckoutPayload,
  PosMenuCategory, PosMenuProduct, PosOrder,
} from "@/lib/pos";
import {
  checkoutPos, fetchPosMenu, refundOrder, updateCashPayment,
} from "@/lib/pos";
import {
  cacheMenuSnapshot, createOfflineOperationId, getCachedMenuSnapshot,
} from "@/lib/pos-offline";
import { calculateIncludedVat, formatPeso } from "@/lib/pos-utils";
import ProductImage from "@/components/ProductImage";
import ProductConfiguratorModal from "./modals/ProductConfiguratorModal";
import VoidConfirmationModal from "./modals/VoidConfirmationModal";
import PaymentModal, { type PaymentState } from "./modals/PaymentModal";
import ReceiptModal from "./modals/ReceiptModal";
import ActionAlert from "@/components/feedback/ActionAlert";
import OrderReversalModal from "./modals/OrderReversalModal";
import styles from "./StaffPOSPage.module.css";
import focusStyles from "./FocusMode.module.css";
import { usePOSFocusMode } from "./StaffDashboardLayout";
import AdminSelect from "@/components/admin/AdminSelect";

type DiscountOption = { value: string; label: string; rate: number };
type ReversalState = {
  order: PosOrder | null;
  type: "REFUND";
  approverEmail: string;
  approverPassword: string;
  reasonCode: string;
  note: string;
  paymentReference: string;
};

const DISCOUNT_OPTIONS: DiscountOption[] = [
  { value: "none", label: "No Discount", rate: 0 },
  { value: "senior", label: "Senior Citizen (20%)", rate: 0.2 },
  { value: "pwd", label: "PWD (20%)", rate: 0.2 },
  { value: "staff-meal", label: "Staff Meal (10%)", rate: 0.1 },
];

function buildCartItem(payload: ConfiguredPosCartItemInput, existing?: PosCartItem | null): PosCartItem {
  const unitModifierTotal = payload.modifierSelections.reduce((sum, modifier) => sum + modifier.unitPriceAdjustment * modifier.quantity, 0);
  const unitPrice = payload.basePrice + unitModifierTotal;
  return {
    cartId: existing?.cartId ?? `${payload.productVariantId}-${Date.now()}`,
    productId: payload.productId,
    productName: payload.productName,
    categoryName: payload.categoryName,
    productVariantId: payload.productVariantId,
    variantName: payload.variantName,
    sku: payload.sku,
    quantity: existing?.quantity ?? 1,
    note: payload.note,
    basePrice: payload.basePrice,
    modifierSelections: payload.modifierSelections,
    unitModifierTotal,
    unitPrice,
    lineSubtotal: unitPrice * (existing?.quantity ?? 1),
  };
}

const getDiscountConfig = (discountValue: string) => DISCOUNT_OPTIONS.find((option) => option.value === discountValue) ?? DISCOUNT_OPTIONS[0];
const defaultReversalState = (): ReversalState => ({ order: null, type: "REFUND", approverEmail: "", approverPassword: "", reasonCode: "", note: "", paymentReference: "" });

function categoryIcon(categoryName: string) {
  const name = categoryName.toLowerCase();
  if (name.includes("pasta")) return Utensils;
  if (name.includes("coffee") || name.includes("tea")) return Coffee;
  if (name.includes("pastr") || name.includes("bread")) return Cookie;
  if (name.includes("cake") || name.includes("dessert")) return CakeSlice;
  if (name.includes("sandwich") || name.includes("burger")) return Sandwich;
  if (name.includes("drink") || name.includes("beverage") || name.includes("smoothie")) return CupSoda;
  return Utensils;
}

export default function StaffPOSPage() {
  const { focusMode, toggleFocusMode } = usePOSFocusMode();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [choosingCategory, setChoosingCategory] = useState(true);
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [menuProducts, setMenuProducts] = useState<PosMenuProduct[]>([]);
  const [menuCategories, setMenuCategories] = useState<PosMenuCategory[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [reversalSubmitting, setReversalSubmitting] = useState(false);
  const [configuratorProduct, setConfiguratorProduct] = useState<PosMenuProduct | null>(null);
  const [editingCartItem, setEditingCartItem] = useState<PosCartItem | null>(null);
  const [transactionNote, setTransactionNote] = useState("");
  const [discount, setDiscount] = useState("none");
  const [payments, setPayments] = useState<PaymentState>({ cash: "", gcash: "", maya: "", card: "" });
  const [latestReceipt, setLatestReceipt] = useState<PosOrder | null>(null);
  const [cashCorrectionOrder, setCashCorrectionOrder] = useState<PosOrder | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [voidTargetItem, setVoidTargetItem] = useState<PosCartItem | null>(null);
  const [reversalState, setReversalState] = useState<ReversalState>(defaultReversalState());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const discountConfig = getDiscountConfig(discount);
  // Apply admin enablement and stock availability to both live and cached menus.
  const availableProducts = useMemo(() => menuProducts
    .filter((product) => product.isEnabled)
    .map((product) => ({
      ...product,
      variants: product.variants.filter((variant) => variant.isEnabled && variant.availability?.isSellable === true),
    }))
    .filter((product) => product.variants.length > 0), [menuProducts]);
  const categories = useMemo(() => ["All", ...new Set(menuCategories.map((item) => item.name))], [menuCategories]);
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return availableProducts.filter((product) => {
      const matchCategory = category === "All" || product.category.name === category;
      const matchSearch = !term ? true : [product.name, product.category.name, ...product.variants.map((variant) => variant.sku)].join(" ").toLowerCase().includes(term);
      return matchCategory && matchSearch;
    });
  }, [category, availableProducts, search]);
  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.lineSubtotal, 0);
    const discountAmount = subtotal * discountConfig.rate;
    const total = subtotal - discountAmount;
    return { subtotal, discountAmount, total, tax: calculateIncludedVat(total) };
  }, [cart, discountConfig.rate]);

  const closeConfigurator = () => { setConfiguratorProduct(null); setEditingCartItem(null); };
  const resetTransaction = () => {
    setCart([]); setTransactionNote(""); setDiscount("none");
    setPayments({ cash: "", gcash: "", maya: "", card: "" }); closeConfigurator(); setVoidTargetItem(null);
  };

  async function loadMenu() {
    setMenuLoading(true);
    try {
      const response = await fetchPosMenu();
      setMenuProducts(response.products);
      setMenuCategories(response.categories);
      cacheMenuSnapshot(response);
      setError(null);
    } catch (nextError) {
      const cachedSnapshot = getCachedMenuSnapshot();
      if (cachedSnapshot) {
        setMenuProducts(cachedSnapshot.menu.products);
        setMenuCategories(cachedSnapshot.menu.categories);
        setNotice(`Using cached menu from ${new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(cachedSnapshot.cachedAt))}.`);
      } else {
        setError(nextError instanceof Error ? nextError.message : "Failed to load POS menu");
      }
    } finally {
      setMenuLoading(false);
    }
  }

  useEffect(() => { void loadMenu(); }, []);

  const addConfiguredItem = (payload: ConfiguredPosCartItemInput) => { setCart((current) => [...current, buildCartItem(payload)]); closeConfigurator(); };
  const updateConfiguredItem = (payload: ConfiguredPosCartItemInput) => {
    if (!editingCartItem) return;
    const updatedItem = buildCartItem(payload, editingCartItem);
    setCart((current) => current.map((item) => item.cartId === editingCartItem.cartId ? updatedItem : item));
    closeConfigurator();
  };
  const openEditItem = (cartItem: PosCartItem) => {
    const product = availableProducts.find((item) => item.id === cartItem.productId);
    if (!product || !product.variants.some((variant) => variant.id === cartItem.productVariantId)) {
      setError("This item is no longer available. Remove it from the cart and choose an available item.");
      return;
    }
    setEditingCartItem(cartItem); setConfiguratorProduct(product);
  };
  const updateQty = (cartId: string, nextQty: number) => {
    if (nextQty < 1) return;
    setCart((current) => current.map((item) => item.cartId === cartId ? { ...item, quantity: nextQty, lineSubtotal: item.unitPrice * nextQty } : item));
  };
  const handleCancelTransaction = () => { if (cart.length && window.confirm("Cancel the current transaction?")) resetTransaction(); };
  const buildCheckoutPayload = (idempotencyKey: string): PosCheckoutPayload => ({
    idempotencyKey,
    items: cart.map((item) => ({
      productVariantId: item.productVariantId,
      quantity: item.quantity,
      note: item.note || undefined,
      modifiers: item.modifierSelections.map((modifier) => ({ modifierId: modifier.modifierId, quantity: modifier.quantity })),
    })),
    payments: ([["CASH", payments.cash], ["GCASH", payments.gcash], ["MAYA", payments.maya], ["CARD", payments.card]] as Array<[PaymentMethod, string]>)
      .map(([method, value]) => ({ method, amount: Number(value || 0) }))
      .filter((payment) => payment.amount > 0),
    discountCode: discountConfig.value !== "none" ? discountConfig.label : undefined,
    discountRate: discountConfig.rate,
    notes: transactionNote || undefined,
  });
  const returnToPayment = () => {
    if (!latestReceipt || checkoutLoading) return;
    const cash = latestReceipt.payments.filter(payment => payment.method === "CASH");
    if (cash.length !== 1) return;
    const saved: PaymentState = { cash: "", gcash: "", maya: "", card: "" };
    for (const [key, method] of [["cash", "CASH"], ["gcash", "GCASH"], ["maya", "MAYA"], ["card", "CARD"]] as const) {
      saved[key] = String(latestReceipt.payments.filter(payment => payment.method === method).reduce((sum, payment) => sum + Number(payment.amount), 0));
    }
    setPayments(saved); setCashCorrectionOrder(latestReceipt); setError(null); setShowReceipt(false); setShowPayment(true);
  };
  const closePayment = () => {
    if (checkoutLoading) return;
    setShowPayment(false);
    if (cashCorrectionOrder) { setCashCorrectionOrder(null); setShowReceipt(true); setPayments({ cash: "", gcash: "", maya: "", card: "" }); }
  };
  const handleConfirmPayment = async () => {
    if (checkoutLoading || !useAuthStore.getState().can("pos.checkout")) return;
    if (cashCorrectionOrder) {
      setCheckoutLoading(true); setError(null);
      try {
        const previousCash = cashCorrectionOrder.payments.find(payment => payment.method === "CASH")!;
        const order = await updateCashPayment(cashCorrectionOrder.id, Number(payments.cash), Number(previousCash.amount));
        setLatestReceipt(order); setCashCorrectionOrder(null); setShowPayment(false); setShowReceipt(true);
        setPayments({ cash: "", gcash: "", maya: "", card: "" });
      } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Unable to update cash payment."); }
      finally { setCheckoutLoading(false); }
      return;
    }
    if (!cart.length) return setError("No transaction to process.");
    const totalPaid = ([payments.cash, payments.gcash, payments.maya, payments.card]).reduce((sum, value) => sum + Number(value || 0), 0);
    if (totalPaid < totals.total) return setError("Incomplete payment. Please settle the full amount before checkout.");
    const operationId = createOfflineOperationId("checkout");
    const payload = buildCheckoutPayload(operationId);
    setCheckoutLoading(true); setError(null);
    try {
      const response = await checkoutPos(payload);
      setLatestReceipt(response.order); setShowPayment(false); setShowReceipt(true); resetTransaction();  setNotice(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to complete checkout");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const openReversalModal = (order: PosOrder, type: "REFUND") => setReversalState({
    order, type, approverEmail: "", approverPassword: "", reasonCode: "CUSTOMER_REFUND", note: "", paymentReference: "",
  });
  const submitReversal = async () => {
    if (!useAuthStore.getState().can("pos.refund")) return;
    if (!reversalState.order || !reversalState.reasonCode.trim()) return;
    setReversalSubmitting(true); setError(null);
    try {
      const order = await refundOrder(reversalState.order.id, { approverEmail: reversalState.approverEmail.trim(), approverPassword: reversalState.approverPassword, reasonCode: reversalState.reasonCode.trim(), note: reversalState.note || undefined, paymentReference: reversalState.paymentReference || undefined });
      setLatestReceipt(order); setShowReceipt(true); setReversalState(defaultReversalState());
      setNotice("Order refund processed successfully.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to process order reversal");
    } finally {
      setReversalSubmitting(false);
    }
  };

  return (
    <div className={`${styles.posPage} w-full text-slate-900`} data-focus-mode={focusMode ? "true" : undefined} data-pos-scroll={!choosingCategory && (category === "All" || focusMode) ? "true" : undefined}>
      <div className={`${styles.posContent} flex w-full flex-col gap-4`} data-choosing-category={choosingCategory ? "true" : undefined}>
        <header className={`${focusStyles.posHeader} ${focusMode ? focusStyles.posHeaderFocused : ""}`}>
          <div className={focusStyles.posHeaderDetails} inert={focusMode} aria-hidden={focusMode}>
            <div className={focusStyles.retractInner}>
              <h1 className="text-2xl font-bold">Staff POS</h1>
              <p>Create orders, accept payments, and manage daily sales.</p>
            </div>
          </div>
          <button type="button" className={`${focusStyles.toggle} ${focusStyles.posHeaderToggle}`} aria-pressed={focusMode} onClick={toggleFocusMode}>
            {focusMode ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
            {focusMode ? "Exit Focus Mode" : "Focus Mode"}
          </button>
        </header>

        {notice ? <ActionAlert tone="success" title="Success!" message={notice} onDismiss={() => setNotice(null)} /> : null}
        {error ? <ActionAlert tone="error" title="Action failed" message={error} onDismiss={() => setError(null)} /> : null}

        <div key={choosingCategory ? "categories" : "products"} className={`${styles.orderArea} ${choosingCategory ? styles.returnToCategories : styles.openCategory}`}>
        {choosingCategory ? (
          <section aria-labelledby="pos-categories-title" className={`${styles.categoryPanel} min-h-0 w-full py-4`}>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="pos-categories-title" className="text-2xl font-bold text-[#232d46]">Choose a Category</h2>
                <p className="mt-1 text-sm text-slate-500">Select a category to browse products.</p>
              </div>
              {cart.length > 0 && <button type="button" onClick={() => setChoosingCategory(false)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-[#232d46]"><ShoppingCart size={18} />Current Cart ({cart.length}) · {formatPeso(totals.total)}</button>}
            </div>
            {menuLoading ? (
              <p role="status" className="flex items-center gap-2 py-8 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading categories...</p>
            ) : menuCategories.length === 0 ? (
              <p className="py-8 text-slate-500">No menu categories available.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 xl:gap-6">
                {categories.map((item) => (
                  <button key={item} type="button" onClick={() => { setCategory(item); setSearch(""); setChoosingCategory(false); }} className={styles.categoryCard}>
                    {item === "All" ? "All Products" : item}
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : <div className={`${styles.orderWorkspace} grid gap-4 xl:grid-cols-[minmax(0,2.2fr)_minmax(20rem,0.82fr)]`}>
          <section className={`${styles.productPanel} rounded-3xl bg-white p-4 shadow-sm md:p-5`}>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by product, category, or SKU" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-[#232d46]" />
              </div>
              <button type="button" onClick={() => { setChoosingCategory(true); setSearch(""); }} className="order-first inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-[#232d46] hover:bg-slate-50"><ArrowLeft size={18} />Back to Categories</button>
            </div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{category === "All" ? "All Products" : category}</h2>
              <span className="text-xs text-slate-400">{menuLoading ? "Loading..." : `${filteredProducts.length} products`}</span>
            </div>
            {menuLoading ? (
              <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500"><span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading menu</span></div>
            ) : (
              <div className={styles.productGrid} role="region" aria-label="Products" tabIndex={category === "All" || focusMode ? 0 : undefined}>
                {filteredProducts.length === 0 && <p className="col-span-full py-8 text-center text-slate-500">{search.trim() ? "No available products match your search in this category." : "No products are currently available in this category."}</p>}
                {filteredProducts.map((product) => {
                  const CategoryIcon = categoryIcon(product.category.name);
                  const sellableVariants = product.variants.filter((variant) => variant.isEnabled && variant.availability?.isSellable);
                  const cheapestVariant = [...product.variants].sort((left, right) => Number(left.price) - Number(right.price))[0];
                  const isSellable = sellableVariants.length > 0;
                  return (
                    <button key={product.id} onClick={() => { setConfiguratorProduct(product); setEditingCartItem(null); }} type="button" disabled={!product.isEnabled || !isSellable} className={styles.productCard}>
                      <ProductImage src={product.imageUrl} name={product.name} />
                      <div className={styles.productCardBody}>
                        <div className={styles.productCategoryRow}>
                          <span className={styles.productCategory}>{product.category.name}</span>
                          <CategoryIcon size={16} strokeWidth={1.75} aria-hidden="true" />
                        </div>
                        <h3 className={styles.productName}>{product.name}</h3>
                        <p className={styles.productDescription}><span className={styles.availableDot} />Available {product.variants.length} variant{product.variants.length === 1 ? "" : "s"}</p>
                        <div className={styles.productCardFooter}>
                          <p className={styles.productPrice}><strong>{formatPeso(cheapestVariant?.price ?? 0)}</strong><span>{product.variants.length > 1 ? " / from" : " / item"}</span></p>
                          <span className={styles.productAdd} aria-hidden="true"><Plus size={18} /></span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <aside className={styles.cart}>
            <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-[#232d46]" /><h2 className="text-lg font-semibold">Current Cart</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{cart.length} item{cart.length !== 1 ? "s" : ""}</span></div>
            <div className={`${styles.cartItems} mb-4 max-h-[340px] space-y-3 overflow-auto pr-1`}>
              {cart.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">Your cart is empty. Choose a product to start an order.</div> : cart.map((item) => (
                <div key={item.cartId} className={styles.cartItem}>
                  <div className={styles.cartItemHeader}>
                    <div>
                      <h3 className="font-semibold">{item.productName}</h3>
                      <p className="text-xs text-slate-500">{item.variantName}{item.modifierSelections.length ? ` • ${item.modifierSelections.map((modifier) => `${modifier.name} x${modifier.quantity}`).join(", ")}` : ""}</p>
                      {item.note ? <p className="mt-1 text-xs text-[#34445f]">Note: {item.note}</p> : null}
                      <p className="mt-2 text-sm text-slate-500">{formatPeso(item.unitPrice)} each</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditItem(item)} type="button" className="rounded-xl p-2 text-blue-600 hover:bg-blue-50" aria-label={`Edit ${item.productName}`} title="Edit item"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setVoidTargetItem(item)} type="button" className="rounded-xl p-2 text-rose-600 hover:bg-rose-50" aria-label={`Void ${item.productName}`} title="Void item"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className={styles.cartItemBottom}>
                    <div className={styles.quantityControl}>
                      <button onClick={() => updateQty(item.cartId, item.quantity - 1)} type="button" aria-label={`Decrease quantity of ${item.productName}`} className="px-3 py-2 text-slate-600 hover:bg-slate-50"><Minus className="h-4 w-4" /></button>
                      <span className="min-w-10 text-center text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => updateQty(item.cartId, item.quantity + 1)} type="button" aria-label={`Increase quantity of ${item.productName}`} className="px-3 py-2 text-slate-600 hover:bg-slate-50"><Plus className="h-4 w-4" /></button>
                    </div>
                    <p className="font-semibold text-slate-900">{formatPeso(item.lineSubtotal)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.cartSummary}>
              <div>
                <AdminSelect label="Discount" value={discount} onChange={setDiscount} options={DISCOUNT_OPTIONS} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="pos-cart-notes">Transaction Notes</label>
                <div className="relative"><StickyNote aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><textarea id="pos-cart-notes" value={transactionNote} onChange={(e) => setTransactionNote(e.target.value)} placeholder="Example: less sugar, no straw" rows={3} className="block w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-center text-sm outline-none focus:border-[#232d46]" /></div>
              </div>
              <div className={styles.cartTotals}>
                <div className="flex justify-between"><span className="text-slate-500">Subtotal (VAT Inclusive)</span><span>{formatPeso(totals.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>- {formatPeso(totals.discountAmount)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">VAT Included (12%)</span><span>{formatPeso(totals.tax)}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold"><span>Total</span><span>{formatPeso(totals.total)}</span></div>
              </div>
            </div>

            <div className={styles.cartActions}>
              <button onClick={handleCancelTransaction} type="button" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100">Cancel Transaction</button>
              <PermissionAction permission="pos.checkout"><button onClick={() => setShowPayment(true)} type="button" disabled={cart.length === 0} className="rounded-2xl bg-[#232d46] px-4 py-3 text-sm font-semibold text-white hover:bg-[#34445f] disabled:cursor-not-allowed disabled:bg-slate-300">{checkoutLoading ? "Processing..." : "Process Order"}</button></PermissionAction>
            </div>
          </aside>
        </div>}
        </div>
      </div>

      {configuratorProduct ? <ProductConfiguratorModal product={configuratorProduct} initialItem={editingCartItem} onClose={closeConfigurator} onSubmit={editingCartItem ? updateConfiguredItem : addConfiguredItem} submitLabel={editingCartItem ? "Save Changes" : "Add to Cart"} /> : null}
      {voidTargetItem ? <VoidConfirmationModal item={voidTargetItem} onClose={() => setVoidTargetItem(null)} onConfirm={() => { if (!voidTargetItem) return; setCart((current) => current.filter((item) => item.cartId !== voidTargetItem.cartId)); if (editingCartItem?.cartId === voidTargetItem.cartId) closeConfigurator(); setVoidTargetItem(null); }} /> : null}
      {showPayment ? <PermissionAction permission={"pos.checkout"}><PaymentModal total={cashCorrectionOrder ? Number(cashCorrectionOrder.totalAmount) : totals.total} cartCount={cashCorrectionOrder ? cashCorrectionOrder.items.length : cart.length} payments={payments} setPayments={setPayments} onClose={closePayment} cashCorrection={!!cashCorrectionOrder} submitting={checkoutLoading} error={error} onConfirm={() => void handleConfirmPayment()} /></PermissionAction> : null}
      {showReceipt && latestReceipt ? <ReceiptModal receipt={latestReceipt} onBackToPayment={latestReceipt.createdBy.id === useAuthStore.getState().user?.id && latestReceipt.payments.filter(payment => payment.method === "CASH").length === 1 ? returnToPayment : undefined} reversalSubmitting={reversalSubmitting} onRefund={(order) => openReversalModal(order, "REFUND")} onClose={() => setShowReceipt(false)} /> : null}
      {reversalState.order ? <PermissionAction permission={"pos.refund"}><OrderReversalModal order={reversalState.order} type={reversalState.type} approverEmail={reversalState.approverEmail} approverPassword={reversalState.approverPassword} reasonCode={reversalState.reasonCode} note={reversalState.note} paymentReference={reversalState.paymentReference} submitting={reversalSubmitting} onApproverEmailChange={(value) => setReversalState((current) => ({ ...current, approverEmail: value }))} onApproverPasswordChange={(value) => setReversalState((current) => ({ ...current, approverPassword: value }))} onReasonCodeChange={(value) => setReversalState((current) => ({ ...current, reasonCode: value }))} onNoteChange={(value) => setReversalState((current) => ({ ...current, note: value }))} onPaymentReferenceChange={(value) => setReversalState((current) => ({ ...current, paymentReference: value }))} onClose={() => setReversalState(defaultReversalState())} onConfirm={() => void submitReversal()} /></PermissionAction> : null}
    </div>
  );
}
