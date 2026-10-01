"use client";
import { PermissionAction } from "@/components/auth/PermissionGuard";

import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { fetchOrder, fetchOrders, refundOrder, type PosOrder, type OrderStatus, type PaymentMethod } from "@/lib/pos";
import { loadQueuedCheckouts, type OfflineCheckoutEntry } from "@/lib/pos-offline";
import TransactionHistoryPanel from "./TransactionHistoryPanel";
import ReceiptModal from "./modals/ReceiptModal";
import OrderReversalModal from "./modals/OrderReversalModal";
import styles from "./TransactionHistory.module.css";
import ActionAlert from "@/components/feedback/ActionAlert";
import AdminSelect from "@/components/admin/AdminSelect";
import DateFilter from "./DateFilter";

type ReversalState = {
  order: PosOrder | null;
  type: "REFUND";
  approverEmail: string;
  approverPassword: string;
  reasonCode: string;
  note: string;
  paymentReference: string;
};

const defaultReversalState = (): ReversalState => ({ order: null, type: "REFUND", approverEmail: "", approverPassword: "", reasonCode: "", note: "", paymentReference: "" });

export default function TransactionHistoryPage() {
  const userId = useAuthStore((state) => state.user?.id);
  const [history, setHistory] = useState<PosOrder[]>([]);
  const [queuedCheckouts, setQueuedCheckouts] = useState<OfflineCheckoutEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [revision, setRevision] = useState(0);
  const [latestReceipt, setLatestReceipt] = useState<PosOrder | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [reversalSubmitting, setReversalSubmitting] = useState(false);
  const [reversalState, setReversalState] = useState<ReversalState>(defaultReversalState());
  const loadHistory = useCallback(async () => { setRevision((value) => value + 1); }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (from && to && from > to) { setError("From date must be on or before To date."); setLoading(false); return; }
      setLoading(true);
      setError(null);
      setQueuedCheckouts(loadQueuedCheckouts());
      void fetchOrders({ createdByUserId: userId, search: search.trim() || undefined, status: (status || undefined) as OrderStatus | undefined, paymentMethod: (payment || undefined) as PaymentMethod | undefined, from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined, to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined })
        .then((orders) => { if (active) setHistory(orders); })
        .catch((reason: unknown) => { if (active) { setHistory([]); setError(reason instanceof Error ? reason.message : "Unable to load transactions."); } })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [userId, search, status, payment, from, to, revision]);

  async function viewOrder(order: PosOrder) {
    try { setLatestReceipt(await fetchOrder(order.id)); setShowReceipt(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load receipt."); }
  }
  const openReversalModal = (order: PosOrder, type: "REFUND") => setReversalState({
    order, type, approverEmail: "", approverPassword: "", reasonCode: "CUSTOMER_REFUND", note: "", paymentReference: "",
  });
  const submitReversal = async () => {
    if (!useAuthStore.getState().can("pos.refund")) return;
    if (!reversalState.order || !reversalState.reasonCode.trim()) return;
    setReversalSubmitting(true); setError(null);
    try {
      const order = await refundOrder(reversalState.order.id, { approverEmail: reversalState.approverEmail.trim(), approverPassword: reversalState.approverPassword, reasonCode: reversalState.reasonCode.trim(), note: reversalState.note || undefined, paymentReference: reversalState.paymentReference || undefined });
      setLatestReceipt(order); setShowReceipt(true); setReversalState(defaultReversalState()); await loadHistory();
      setNotice("Order refund processed successfully.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to process order reversal");
    } finally {
      setReversalSubmitting(false);
    }
  };

  return <section className="space-y-5 text-[#232d46]">
    <header className={styles.pageHeader}><div><h1>TRANSACTION HISTORY</h1><p>Review your transactions and receipts.</p></div><button type="button" disabled={loading} onClick={() => void loadHistory()}>{loading ? "Refreshing..." : "Refresh"}</button></header>
    <div className={styles.filters}>
      <label className={styles.searchLabel}>Search<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transactions" className={styles.searchInput} /></label>
      <AdminSelect label="Status" value={status} onChange={setStatus} options={[{ value: "", label: "All statuses" }, { value: "COMPLETED", label: "Completed" }, { value: "REFUNDED", label: "Refunded" }]} />
      <AdminSelect label="Payment method" value={payment} onChange={setPayment} options={[{ value: "", label: "All methods" }, ...["CASH", "GCASH", "MAYA", "CARD", "OTHER"].map((method) => ({ value: method, label: ({ CASH: "Cash", GCASH: "GCash", MAYA: "Maya", CARD: "Card", OTHER: "Other" } as Record<string, string>)[method] }))]} />
      <DateFilter label="From date" value={from} max={to || undefined} onChange={setFrom} />
      <DateFilter label="To date" value={to} min={from || undefined} onChange={setTo} />
      <button type="button" onClick={() => { setSearch(""); setStatus(""); setPayment(""); setFrom(""); setTo(""); }} className={styles.clearFilters}>Clear filters</button>
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
    {notice && <ActionAlert tone="success" title="Success!" message={notice} onDismiss={() => setNotice(null)} />}
    <TransactionHistoryPanel history={error ? [] : history} queuedCheckouts={queuedCheckouts} loading={loading} onSelectOrder={(order) => void viewOrder(order)} onReverseOrder={openReversalModal} />
    {showReceipt && latestReceipt && <ReceiptModal receipt={latestReceipt} reversalSubmitting={reversalSubmitting} onRefund={(order) => openReversalModal(order, "REFUND")} onClose={() => setShowReceipt(false)} />}
      {reversalState.order ? <PermissionAction permission="pos.refund"><OrderReversalModal order={reversalState.order} type={reversalState.type} approverEmail={reversalState.approverEmail} approverPassword={reversalState.approverPassword} reasonCode={reversalState.reasonCode} note={reversalState.note} paymentReference={reversalState.paymentReference} submitting={reversalSubmitting} onApproverEmailChange={(value) => setReversalState((current) => ({ ...current, approverEmail: value }))} onApproverPasswordChange={(value) => setReversalState((current) => ({ ...current, approverPassword: value }))} onReasonCodeChange={(value) => setReversalState((current) => ({ ...current, reasonCode: value }))} onNoteChange={(value) => setReversalState((current) => ({ ...current, note: value }))} onPaymentReferenceChange={(value) => setReversalState((current) => ({ ...current, paymentReference: value }))} onClose={() => setReversalState(defaultReversalState())} onConfirm={() => void submitReversal()} /></PermissionAction> : null}
  </section>;
}
