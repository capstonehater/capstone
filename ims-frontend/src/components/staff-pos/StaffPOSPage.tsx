"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import {
  ArrowLeft, Search, ShoppingCart, Coffee, Cookie, Sandwich, Trash2, Minus, Plus,
  StickyNote, History, Pencil, Loader2, Wifi, WifiOff, RotateCcw,
} from "lucide-react";
import type {
  ConfiguredPosCartItemInput, PaymentMethod, PosCartItem, PosCheckoutPayload,
  PosMenuProduct, PosOrder,
} from "@/lib/pos";
import {
  checkoutPos, fetchOrder, fetchOrders, fetchPosMenu, refundOrder, voidOrder,
} from "@/lib/pos";
import {
  cacheMenuSnapshot, createOfflineOperationId, enqueueQueuedCheckout,
  getCachedMenuSnapshot, loadQueuedCheckouts, removeQueuedCheckout,
  updateQueuedCheckout, type OfflineCheckoutEntry,
} from "@/lib/pos-offline";
import { calculateIncludedVat, formatName, formatPeso } from "@/lib/pos-utils";
import ProductConfiguratorModal from "./modals/ProductConfiguratorModal";
import VoidConfirmationModal from "./modals/VoidConfirmationModal";
import PaymentModal, { type PaymentState } from "./modals/PaymentModal";
import ReceiptModal from "./modals/ReceiptModal";
import TransactionHistoryModal from "./modals/TransactionHistoryModal";
import ActionAlert from "@/components/feedback/ActionAlert";
import OrderReversalModal from "./modals/OrderReversalModal";

type DiscountOption = { value: string; label: string; rate: number };
type ReversalState = {
  order: PosOrder | null;
  type: "VOID" | "REFUND";
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
const defaultReversalState = (): ReversalState => ({ order: null, type: "VOID", approverEmail: "", approverPassword: "", reasonCode: "", note: "", paymentReference: "" });
const isNetworkError = (error: unknown) => error instanceof TypeError || String(error).toLowerCase().includes("failed to fetch") || String(error).toLowerCase().includes("network");

function iconForCategory(categoryName: string) {
  const normalized = categoryName.toLowerCase();
  if (normalized.includes("coffee") || normalized.includes("drinks")) return <Coffee className="h-4 w-4" />;
  if (normalized.includes("pastr")) return <Cookie className="h-4 w-4" />;
  return <Sandwich className="h-4 w-4" />;
}

export default function StaffPOSPage() {
  const user = useAuthStore((state) => state.user);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [choosingCategory, setChoosingCategory] = useState(true);
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [menuProducts, setMenuProducts] = useState<PosMenuProduct[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [reversalSubmitting, setReversalSubmitting] = useState(false);
  const [configuratorProduct, setConfiguratorProduct] = useState<PosMenuProduct | null>(null);
  const [editingCartItem, setEditingCartItem] = useState<PosCartItem | null>(null);
  const [transactionNote, setTransactionNote] = useState("");
  const [discount, setDiscount] = useState("none");
  const [payments, setPayments] = useState<PaymentState>({ cash: "", gcash: "", maya: "", card: "" });
  const [history, setHistory] = useState<PosOrder[]>([]);
  const [latestReceipt, setLatestReceipt] = useState<PosOrder | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [voidTargetItem, setVoidTargetItem] = useState<PosCartItem | null>(null);
  const [queuedCheckouts, setQueuedCheckouts] = useState<OfflineCheckoutEntry[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [reversalState, setReversalState] = useState<ReversalState>(defaultReversalState());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const syncInFlightRef = useRef(false);

  const discountConfig = getDiscountConfig(discount);
  const staffName = user?.name || user?.email || "Staff User";
  const pendingSyncCount = queuedCheckouts.length;
  const categories = useMemo(() => ["All", ...new Set(menuProducts.map((product) => product.category.name))], [menuProducts]);
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return menuProducts.filter((product) => {
      const matchCategory = category === "All" || product.category.name === category;
      const matchSearch = !term ? true : [product.name, product.category.name, ...product.variants.map((variant) => variant.sku)].join(" ").toLowerCase().includes(term);
      return matchCategory && matchSearch;
    });
  }, [category, menuProducts, search]);
  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.lineSubtotal, 0);
    const discountAmount = subtotal * discountConfig.rate;
    const total = subtotal - discountAmount;
    return { subtotal, discountAmount, total, tax: calculateIncludedVat(total) };
  }, [cart, discountConfig.rate]);

  const refreshQueuedCheckouts = () => setQueuedCheckouts(loadQueuedCheckouts());
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
      cacheMenuSnapshot(response);
      setError(null);
    } catch (nextError) {
      const cachedSnapshot = getCachedMenuSnapshot();
      if (cachedSnapshot) {
        setMenuProducts(cachedSnapshot.menu.products);
        setNotice(`Using cached menu from ${new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(cachedSnapshot.cachedAt))}.`);
      } else {
        setError(nextError instanceof Error ? nextError.message : "Failed to load POS menu");
      }
    } finally {
      setMenuLoading(false);
    }
  }

  async function loadHistory() {
    if (!user?.id) return;
    setHistoryLoading(true);
    try {
      setHistory(await fetchOrders({ createdByUserId: user.id }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load order history");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function syncQueuedOrders() {
    if (!navigator.onLine || syncInFlightRef.current) return;
    const queue = loadQueuedCheckouts();
    if (queue.length === 0) return;
    syncInFlightRef.current = true;
    setSyncingQueue(true);
    let syncedCount = 0;
    try {
      for (const entry of queue) {
        updateQueuedCheckout(entry.operationId, (current) => ({ ...current, status: "SYNCING", error: null }));
        refreshQueuedCheckouts();
        try {
          const response = await checkoutPos(entry.payload);
          removeQueuedCheckout(entry.operationId);
          refreshQueuedCheckouts();
          setLatestReceipt(response.order);
          syncedCount += 1;
        } catch (nextError) {
          if (isNetworkError(nextError)) {
            updateQueuedCheckout(entry.operationId, (current) => ({ ...current, status: "PENDING", error: null }));
            refreshQueuedCheckouts();
            break;
          }
          updateQueuedCheckout(entry.operationId, (current) => ({
            ...current,
            status: "FAILED",
            error: nextError instanceof Error ? nextError.message : "Queued checkout failed to sync",
          }));
          refreshQueuedCheckouts();
        }
      }
      if (syncedCount > 0) {
        setNotice(syncedCount === 1 ? "Queued checkout synced successfully." : `${syncedCount} queued checkouts synced successfully.`);
        await loadHistory();
      }
    } finally {
      syncInFlightRef.current = false;
      setSyncingQueue(false);
    }
  }

  useEffect(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    refreshQueuedCheckouts();
    const handleOnline = () => { setIsOnline(true); setNotice("Connection restored. Attempting to sync queued checkouts."); void syncQueuedOrders(); };
    const handleOffline = () => { setIsOnline(false); setNotice("Offline mode enabled. Checkout commands will queue for sync."); };
    const handleStorage = () => refreshQueuedCheckouts();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => { void loadMenu(); }, []);
  useEffect(() => { void loadHistory(); }, [user?.id]);
  useEffect(() => { if (isOnline) void syncQueuedOrders(); }, [isOnline]);

  const addConfiguredItem = (payload: ConfiguredPosCartItemInput) => { setCart((current) => [...current, buildCartItem(payload)]); closeConfigurator(); };
  const updateConfiguredItem = (payload: ConfiguredPosCartItemInput) => {
    if (!editingCartItem) return;
    const updatedItem = buildCartItem(payload, editingCartItem);
    setCart((current) => current.map((item) => item.cartId === editingCartItem.cartId ? updatedItem : item));
    closeConfigurator();
  };
  const openEditItem = (cartItem: PosCartItem) => {
    const product = menuProducts.find((item) => item.id === cartItem.productId);
    if (!product) return;
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
  const queueCheckoutForSync = (payload: PosCheckoutPayload) => {
    enqueueQueuedCheckout({
      operationId: payload.idempotencyKey,
      idempotencyKey: payload.idempotencyKey,
      createdAt: new Date().toISOString(),
      status: "PENDING",
      payload,
      preview: { totalAmount: totals.total, cartCount: cart.length, notes: transactionNote || undefined },
    });
    refreshQueuedCheckouts(); setShowPayment(false); resetTransaction();
    setNotice("Checkout queued locally. It will sync when the connection returns.");
  };

  const handleConfirmPayment = async () => {
    if (!cart.length) return setError("No transaction to process.");
    const totalPaid = ([payments.cash, payments.gcash, payments.maya, payments.card]).reduce((sum, value) => sum + Number(value || 0), 0);
    if (totalPaid < totals.total) return setError("Incomplete payment. Please settle the full amount before checkout.");
    const operationId = createOfflineOperationId("checkout");
    const payload = buildCheckoutPayload(operationId);
    if (!isOnline) return queueCheckoutForSync(payload);
    setCheckoutLoading(true); setError(null);
    try {
      const response = await checkoutPos(payload);
      setLatestReceipt(response.order); setShowPayment(false); setShowReceipt(true); resetTransaction(); await loadHistory(); setNotice(null);
    } catch (nextError) {
      if (isNetworkError(nextError)) queueCheckoutForSync(payload);
      else setError(nextError instanceof Error ? nextError.message : "Failed to complete checkout");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleSelectOrderFromHistory = async (order: PosOrder) => {
    try {
      setLatestReceipt(await fetchOrder(order.id));
      setShowHistory(false);
      setShowReceipt(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load receipt");
    }
  };

  const openReversalModal = (order: PosOrder, type: "VOID" | "REFUND") => setReversalState({
    order, type, approverEmail: "", approverPassword: "", reasonCode: type === "VOID" ? "VOID_APPROVED" : "CUSTOMER_REFUND", note: "", paymentReference: "",
  });
  const submitReversal = async () => {
    if (!reversalState.order || !reversalState.reasonCode.trim()) return;
    setReversalSubmitting(true); setError(null);
    try {
      const order = reversalState.type === "VOID"
        ? await voidOrder(reversalState.order.id, { approverEmail: reversalState.approverEmail.trim(), approverPassword: reversalState.approverPassword, reasonCode: reversalState.reasonCode.trim(), note: reversalState.note || undefined, paymentReference: reversalState.paymentReference || undefined })
        : await refundOrder(reversalState.order.id, { approverEmail: reversalState.approverEmail.trim(), approverPassword: reversalState.approverPassword, reasonCode: reversalState.reasonCode.trim(), note: reversalState.note || undefined, paymentReference: reversalState.paymentReference || undefined });
      setLatestReceipt(order); setShowReceipt(true); setReversalState(defaultReversalState()); await loadHistory();
      setNotice(reversalState.type === "VOID" ? "Order void processed successfully." : "Order refund processed successfully.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to process order reversal");
    } finally {
      setReversalSubmitting(false);
    }
  };

  return (
    <div className="w-full text-slate-900">
      <div className="flex w-full flex-col gap-4">
        <header className="flex flex-col justify-between gap-3 rounded-3xl bg-white p-5 shadow-sm md:flex-row md:items-center">
          <div>
            <p className="text-sm font-medium text-[#f45a1f]">Staff Panel</p>
            <h1 className="text-2xl font-bold">Staff POS</h1>
            <p className="text-sm text-slate-500">Real menu browsing, backend-driven variants and modifiers, and checkout synced to inventory. Signed in as <span className="font-medium text-slate-700">{staffName}</span>.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium ${isOnline ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}{isOnline ? "Online" : "Offline"}</span>
            <span className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">Pending Sync: {pendingSyncCount}</span>
            {pendingSyncCount > 0 ? <button onClick={() => void syncQueuedOrders()} type="button" disabled={!isOnline || syncingQueue} className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"><RotateCcw className={`h-4 w-4 ${syncingQueue ? "animate-spin" : ""}`} />{syncingQueue ? "Syncing..." : "Sync Queue"}</button> : null}
            <button onClick={() => setShowHistory(true)} type="button" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"><History className="h-4 w-4" />My Transactions</button>
          </div>
        </header>

        {!isOnline ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Offline mode is active. Menu browsing stays available from cache, and new checkouts are queued locally until sync succeeds.</div> : null}
        {notice ? <ActionAlert tone="success" title="Success!" message={notice} onDismiss={() => setNotice(null)} /> : null}
        {error ? <ActionAlert tone="error" title="Action failed" message={error} onDismiss={() => setError(null)} /> : null}

        {choosingCategory ? (
          <section aria-labelledby="pos-categories-title" className="min-h-[60dvh] w-full py-4">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="pos-categories-title" className="text-2xl font-bold text-[#232d46]">Choose a Category</h2>
                <p className="mt-1 text-sm text-slate-500">Select a category to browse products.</p>
              </div>
              {cart.length > 0 && <button type="button" onClick={() => setChoosingCategory(false)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-[#232d46]"><ShoppingCart size={18} />Current Cart ({cart.length}) · {formatPeso(totals.total)}</button>}
            </div>
            {menuLoading ? (
              <p role="status" className="flex items-center gap-2 py-8 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading categories...</p>
            ) : menuProducts.length === 0 ? (
              <p className="py-8 text-slate-500">No menu categories available.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 xl:gap-6">
                {categories.map((item) => (
                  <button key={item} type="button" onClick={() => { setCategory(item); setSearch(""); setChoosingCategory(false); }} className="flex min-h-28 items-center justify-center rounded-md border border-white/20 bg-[linear-gradient(115deg,#232d46_0%,#096b94_100%)] px-6 py-6 text-center text-lg font-bold uppercase leading-snug text-white shadow-sm transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-500 motion-reduce:transition-none">
                    {item === "All" ? "All Products" : item}
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : <div className="grid gap-4 xl:grid-cols-[minmax(0,2.2fr)_minmax(20rem,0.82fr)]">
          <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by product, category, or SKU" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-[#f45a1f]" />
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
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
                {filteredProducts.length === 0 && <p className="col-span-full py-8 text-center text-slate-500">No products match your search in this category.</p>}
                {filteredProducts.map((product) => {
                  const sellableVariants = product.variants.filter((variant) => variant.isEnabled && variant.availability?.isSellable);
                  const cheapestVariant = [...product.variants].sort((left, right) => Number(left.price) - Number(right.price))[0];
                  const isSellable = sellableVariants.length > 0;
                  return (
                    <button key={product.id} onClick={() => { setConfiguratorProduct(product); setEditingCartItem(null); }} type="button" disabled={!product.isEnabled || !isSellable} className={`rounded-2xl border p-4 text-left transition ${!product.isEnabled || !isSellable ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-70" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-[#f45a1f] hover:shadow-md"}`}>
                      <div className="mb-3 flex items-center justify-between"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{product.category.name}</span>{iconForCategory(product.category.name)}</div>
                      <h3 className="text-base font-semibold">{product.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{product.variants.length} variant{product.variants.length === 1 ? "" : "s"} • {product.modifierGroups.length} modifier group{product.modifierGroups.length === 1 ? "" : "s"}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-sm font-semibold text-[#f45a1f]">Starts at {formatPeso(cheapestVariant?.price ?? 0)}</p>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isSellable ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{isSellable ? "Available" : "Unavailable"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
            <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-[#f45a1f]" /><h2 className="text-lg font-semibold">Current Cart</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{cart.length} item{cart.length !== 1 ? "s" : ""}</span></div>
            <div className="mb-4 max-h-[340px] space-y-3 overflow-auto pr-1">
              {cart.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">No items yet. Choose a product and configure its real variant and modifiers.</div> : cart.map((item) => (
                <div key={item.cartId} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{item.productName}</h3>
                      <p className="text-xs text-slate-500">{item.variantName}{item.modifierSelections.length ? ` • ${item.modifierSelections.map((modifier) => `${modifier.name} x${modifier.quantity}`).join(", ")}` : ""}</p>
                      {item.note ? <p className="mt-1 text-xs text-amber-700">Note: {item.note}</p> : null}
                      <p className="mt-2 text-sm text-slate-500">{formatPeso(item.unitPrice)} each</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditItem(item)} type="button" className="rounded-xl p-2 text-blue-600 hover:bg-blue-50" title="Edit item"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setVoidTargetItem(item)} type="button" className="rounded-xl p-2 text-rose-600 hover:bg-rose-50" title="Void item"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="inline-flex items-center rounded-2xl border border-slate-200">
                      <button onClick={() => updateQty(item.cartId, item.quantity - 1)} type="button" className="px-3 py-2 text-slate-600 hover:bg-slate-50"><Minus className="h-4 w-4" /></button>
                      <span className="min-w-10 text-center text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => updateQty(item.cartId, item.quantity + 1)} type="button" className="px-3 py-2 text-slate-600 hover:bg-slate-50"><Plus className="h-4 w-4" /></button>
                    </div>
                    <p className="font-semibold text-slate-900">{formatPeso(item.lineSubtotal)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Discount</label>
                <select value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#f45a1f]">{DISCOUNT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Transaction Notes</label>
                <div className="relative"><StickyNote className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><textarea value={transactionNote} onChange={(e) => setTransactionNote(e.target.value)} placeholder="Example: less sugar, no straw" rows={3} className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-[#f45a1f]" /></div>
              </div>
              <div className="space-y-2 border-t border-dashed border-slate-200 pt-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Subtotal (VAT Inclusive)</span><span>{formatPeso(totals.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>- {formatPeso(totals.discountAmount)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">VAT Included (12%)</span><span>{formatPeso(totals.tax)}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold"><span>Total</span><span>{formatPeso(totals.total)}</span></div>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button onClick={handleCancelTransaction} type="button" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100">Cancel Transaction</button>
              <button onClick={() => setShowPayment(true)} type="button" disabled={cart.length === 0} className="rounded-2xl bg-[#f45a1f] px-4 py-3 text-sm font-semibold text-white hover:bg-[#d94f1a] disabled:cursor-not-allowed disabled:bg-slate-300">{checkoutLoading ? "Processing..." : isOnline ? "Process Order" : "Queue Checkout"}</button>
            </div>
          </aside>
        </div>}
      </div>

      {configuratorProduct ? <ProductConfiguratorModal product={configuratorProduct} initialItem={editingCartItem} onClose={closeConfigurator} onSubmit={editingCartItem ? updateConfiguredItem : addConfiguredItem} submitLabel={editingCartItem ? "Save Changes" : "Add to Cart"} /> : null}
      {voidTargetItem ? <VoidConfirmationModal item={voidTargetItem} onClose={() => setVoidTargetItem(null)} onConfirm={() => { if (!voidTargetItem) return; setCart((current) => current.filter((item) => item.cartId !== voidTargetItem.cartId)); if (editingCartItem?.cartId === voidTargetItem.cartId) closeConfigurator(); setVoidTargetItem(null); }} /> : null}
      {showPayment ? <PaymentModal total={totals.total} cartCount={cart.length} payments={payments} setPayments={setPayments} onClose={() => setShowPayment(false)} onConfirm={() => void handleConfirmPayment()} /> : null}
      {showReceipt && latestReceipt ? <ReceiptModal receipt={latestReceipt} reversalSubmitting={reversalSubmitting} onVoid={(order) => openReversalModal(order, "VOID")} onRefund={(order) => openReversalModal(order, "REFUND")} onClose={() => setShowReceipt(false)} /> : null}
      {showHistory ? <TransactionHistoryModal history={history} queuedCheckouts={queuedCheckouts} loading={historyLoading} onSelectOrder={(order) => void handleSelectOrderFromHistory(order)} onReverseOrder={(order, type) => openReversalModal(order, type)} onClose={() => setShowHistory(false)} /> : null}
      {reversalState.order ? <OrderReversalModal order={reversalState.order} type={reversalState.type} approverEmail={reversalState.approverEmail} approverPassword={reversalState.approverPassword} reasonCode={reversalState.reasonCode} note={reversalState.note} paymentReference={reversalState.paymentReference} submitting={reversalSubmitting} onApproverEmailChange={(value) => setReversalState((current) => ({ ...current, approverEmail: value }))} onApproverPasswordChange={(value) => setReversalState((current) => ({ ...current, approverPassword: value }))} onReasonCodeChange={(value) => setReversalState((current) => ({ ...current, reasonCode: value }))} onNoteChange={(value) => setReversalState((current) => ({ ...current, note: value }))} onPaymentReferenceChange={(value) => setReversalState((current) => ({ ...current, paymentReference: value }))} onClose={() => setReversalState(defaultReversalState())} onConfirm={() => void submitReversal()} /> : null}
    </div>
  );
}
