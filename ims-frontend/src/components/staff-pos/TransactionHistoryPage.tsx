"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { fetchOrder, fetchOrders, refundOrder, type PosOrder, type OrderStatus, type PaymentMethod } from "@/lib/pos";
import { loadQueuedCheckouts, type OfflineCheckoutEntry } from "@/lib/pos-offline";
import TransactionHistoryPanel from "./TransactionHistoryPanel";
import ReceiptModal from "./modals/ReceiptModal";
import OrderReversalModal from "./modals/OrderReversalModal";
import ActionAlert from "@/components/feedback/ActionAlert";

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

  const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal";
  return <section className="space-y-5 text-[#232d46]">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Transaction History</h1><p className="mt-1 text-sm text-slate-500">Search and review your transactions and receipts.</p></div><button type="button" onClick={() => void loadHistory()} className="rounded-lg bg-[#232d46] px-4 py-2 text-sm font-semibold text-white">Refresh</button></div>
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-5">
      <label className="text-sm font-semibold">Search<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transactions" className={inputClass} /></label>
      <label className="text-sm font-semibold">Status<select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}><option value="">All statuses</option><option value="COMPLETED">Completed</option><option value="REFUNDED">Refunded</option></select></label>
      <label className="text-sm font-semibold">Payment method<select value={payment} onChange={(e) => setPayment(e.target.value)} className={inputClass}><option value="">All methods</option>{["CASH", "GCASH", "MAYA", "CARD", "OTHER"].map((method) => <option key={method}>{method}</option>)}</select></label>
      <label className="text-sm font-semibold">From date<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} /></label>
      <label className="text-sm font-semibold">To date<input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={inputClass} /></label>
      <button type="button" onClick={() => { setSearch(""); setStatus(""); setPayment(""); setFrom(""); setTo(""); }} className="justify-self-start text-sm font-semibold underline">Clear filters</button>
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
    {notice && <ActionAlert tone="success" title="Success!" message={notice} onDismiss={() => setNotice(null)} />}
    <TransactionHistoryPanel history={error ? [] : history} queuedCheckouts={queuedCheckouts} loading={loading} onSelectOrder={(order) => void viewOrder(order)} onReverseOrder={openReversalModal} />
    {showReceipt && latestReceipt && <ReceiptModal receipt={latestReceipt} reversalSubmitting={reversalSubmitting} onRefund={(order) => openReversalModal(order, "REFUND")} onClose={() => setShowReceipt(false)} />}
      {reversalState.order ? <OrderReversalModal order={reversalState.order} type={reversalState.type} approverEmail={reversalState.approverEmail} approverPassword={reversalState.approverPassword} reasonCode={reversalState.reasonCode} note={reversalState.note} paymentReference={reversalState.paymentReference} submitting={reversalSubmitting} onApproverEmailChange={(value) => setReversalState((current) => ({ ...current, approverEmail: value }))} onApproverPasswordChange={(value) => setReversalState((current) => ({ ...current, approverPassword: value }))} onReasonCodeChange={(value) => setReversalState((current) => ({ ...current, reasonCode: value }))} onNoteChange={(value) => setReversalState((current) => ({ ...current, note: value }))} onPaymentReferenceChange={(value) => setReversalState((current) => ({ ...current, paymentReference: value }))} onClose={() => setReversalState(defaultReversalState())} onConfirm={() => void submitReversal()} /> : null}
  </section>;
}
