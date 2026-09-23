"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2, ChevronDown, ExternalLink, Store, Package, MapPin } from "lucide-react";
import { apiJsonFetch } from "@/lib/api";
import styles from "./StoreAvailabilityModal.module.css";

type StoreResult = {
  store_name: string;
  address: string;
  distance?: number | null;
  fetched_at?: string;
  availability?: {
    status: "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
    evidence: { title: string; url: string; snippet: string }[];
  };
  recommendation?: {
    rank: number | null;
    reason: string;
    source: string;
    notice: string | null;
    generated_at: string;
  };
  price: number | null;
  price_type: string | null;
  status: string;
  search_error?: string;
  source_url: string | null;
  fallback_note?: string;
  selected_brand?: string | null;
  search_product?: string;
  fallback_listings?: { title: string; url: string; price?: number | null }[];
  search_sources?: { title: string; url: string }[];
};
type Search = {
  id: string;
  productName: string;
  status: string;
  error: string | null;
  completedAt: string | null;
  results: { id: string; payload: StoreResult }[];
};

function PricingSources({ result }: { result: StoreResult }) {
  const sources = new Map<string, { title: string; url: string; price?: number | null; used: boolean }>();
  function add(source: { title: string; url: string; price?: number | null }, used: boolean) {
    try {
      const url = new URL(source.url);
      if (url.protocol !== "https:" && url.protocol !== "http:") return;
      url.hash = "";
      const key = url.href;
      if (!sources.has(key)) sources.set(key, { ...source, url: key, title: source.title || url.hostname, used });
    } catch { /* Ignore invalid URLs from search results. */ }
  }
  for (const listing of result.fallback_listings ?? []) add(listing, true);
  for (const evidence of result.availability?.evidence ?? []) add(evidence, false);
  if (result.source_url) add({ title: "Primary price source", url: result.source_url }, true);
  for (const source of result.search_sources ?? []) add(source, false);

  if (!sources.size) return <p className="mt-3 text-xs text-slate-600">No source links available.</p>;
  return (
    <details className="group mt-4 rounded-2xl border border-[#d5ddea] bg-white/75">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[#5274a4] [&::-webkit-details-marker]:hidden">
        View product sources ({sources.size})
        <ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <ul className="max-h-64 space-y-2 overflow-y-auto border-t border-[#d5ddea] p-3">
        {Array.from(sources.values()).map((source) => (
          <li key={source.url}>
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="flex items-start justify-between gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-[#e8eef7] focus-visible:outline-2 focus-visible:outline-[#5274a4]">
              <span className="min-w-0">
                <span className="block break-words font-semibold underline">{source.title}</span>
                <span className="mt-1 block break-all text-xs text-slate-500">{new URL(source.url).hostname}</span>
                <span className="mt-1 block text-xs text-slate-600">
                  {source.used ? "Pricing source" : "Other search result · price and relevance unconfirmed"}
                  {typeof source.price === "number" && Number.isFinite(source.price) ? ` · ${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(source.price)}` : ""}
                </span>
              </span>
              <ExternalLink size={15} className="mt-1 shrink-0" aria-label="Opens in a new tab" />
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function StoreAvailabilityModal({ materialId, materialName, onClose, onJourney }: {
  materialId: string; materialName: string; onClose: () => void; onJourney: () => void;
}) {
  const [search, setSearch] = useState<Search | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const endpoint = `/raw-materials/${encodeURIComponent(materialId)}/store-availability`;

  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    node?.showModal();
    return () => { node?.close(); previous?.focus(); };
  }, []);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await apiJsonFetch<{ search: Search | null }>(endpoint, { signal: controller.signal });
        if (disposed) return;
        setSearch(response.search);
        setError(null);
        if (response.search && ["PENDING", "RANKING"].includes(response.search.status)) timer = setTimeout(load, 2500);
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : "Unable to load saved results.");
          timer = setTimeout(load, 5000);
        }
      } finally { if (!disposed) setLoading(false); }
    }
    void load();
    return () => { disposed = true; controller.abort(); clearTimeout(timer); };
  }, [endpoint, refresh]);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const response = await apiJsonFetch<{ search: Search }>(endpoint, { method: "POST" });
      setSearch(response.search);
      setRefresh((value) => value + 1);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to start search."); }
    finally { setStarting(false); }
  }

  const pending = starting || search?.status === "PENDING" || search?.status === "RANKING";
  const savedResults = [...(search?.results ?? [])].sort((a, b) =>
    (a.payload.recommendation?.rank ?? Infinity) - (b.payload.recommendation?.rank ?? Infinity)
    || a.payload.store_name.localeCompare(b.payload.store_name));
  const recommendationNotice = savedResults.find(({ payload }) => payload.recommendation?.notice)?.payload.recommendation?.notice;
  return (
    <dialog ref={dialog} onCancel={onClose} aria-labelledby="store-availability-title"
      className={styles.dialog}>
      <button type="button" onClick={onClose} aria-label="Close store availability" className={styles.close}><X size={20} /></button>
      <div className={styles.surface}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.icon}><Store size={23} aria-hidden="true" /></span>
          <h2 id="store-availability-title">Store Availability</h2>
        </div>
        <div className={styles.product}><Package size={15} aria-hidden="true" /><span>{search?.productName ?? materialName}</span></div>
      </header>
      <div className={styles.body} tabIndex={0} role="region" aria-label="Store availability results">
        {search?.results[0]?.payload.selected_brand && <p className="mt-2 text-sm font-semibold text-slate-700">Selected brand: {search.results[0].payload.selected_brand} · Same brand searched across stores</p>}
        <p className="mt-2 text-sm text-slate-500">Online listings and price estimates. Confirm branch stock and pack size with the store.</p>
        {search?.completedAt && <p className="mt-2 text-xs text-slate-500">Last checked: {new Date(search.completedAt).toLocaleString()}</p>}
        {savedResults.some(({ payload }) => payload.recommendation) && <p className="mt-3 text-sm font-semibold text-slate-700">Saved stock-run recommendations · Top 1–5</p>}
        {recommendationNotice && <p className="mt-2 rounded-xl bg-[#e8eef7] p-3 text-sm text-[#232d46]">{recommendationNotice}</p>}
        <div aria-live="polite">
          {(error || search?.error) && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error || search?.error}</p>}
          {loading && <p className="py-12 text-center text-slate-500">Loading saved results…</p>}
          {pending && <p className="flex items-center justify-center gap-2 py-10 text-sm"><Loader2 size={18} className="animate-spin" /> {search?.status === "RANKING" ? "Search results saved. Qwen is reviewing store recommendations." : "Searching registered stores."} You can close this window and return later.</p>}
        </div>
        <div className="mt-6 space-y-4">
          {savedResults.map(({ id, payload: row }) => (
            <article key={id} className={styles.card}>
              {row.recommendation && <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={styles.rank}>{row.recommendation.rank !== null ? `Top ${row.recommendation.rank}` : "Other registered store"}</span>
                <span className="text-xs text-slate-700">{row.recommendation.source === "rules" ? "Rule-based fallback" : "Qwen recommendation"}</span>
              </div>}
              <div className={styles.storeHeading}>
                <div className="min-w-0">
                  <h4 className={styles.storeName}>{row.store_name}</h4>
                  <p className="mt-1 text-xs text-slate-700">{row.address}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-700">
                    {typeof row.distance === "number" && Number.isFinite(row.distance) && row.distance >= 0
                      ? `${new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(row.distance)} km from your configured location (straight-line)`
                      : "Distance unavailable — check the store location in Manage Suppliers and search again."}
                  </p>
                </div>
                <p className={styles.price}>{row.price === null ? "—" : new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(row.price)}</p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${row.price !== null && row.price_type === "confirmed" ? "bg-green-100 text-green-800" : row.price !== null && row.price_type === "market_estimate" ? "bg-blue-100 text-blue-800" : row.status === "NOT_FOUND" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700"}`}>
                {row.price !== null && row.price_type === "confirmed" ? "Confirmed listing" : row.price !== null && row.price_type === "market_estimate" ? "Market estimate" : row.status === "NOT_FOUND" ? "No listing found" : "Search unavailable"}
              </span>
              {row.price !== null && row.price_type === "market_estimate" && row.availability?.status !== "IN_STOCK" && row.availability?.status !== "OUT_OF_STOCK" && (
                <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">Stock availability unknown</span>
              )}
              </div>
              <p className="mt-2 text-xs text-slate-700">{row.price !== null && row.price_type === "confirmed" ? "Store listing found · branch stock unconfirmed" : row.price !== null && row.price_type === "market_estimate" ? "Market estimate · not a confirmed store price" : row.status === "NOT_FOUND" ? "No matching online listing with a usable price was found." : "Could not check this store. Please try again."}</p>
              {row.price_type !== "market_estimate" && row.fallback_note && <p className="mt-1 text-xs text-slate-700">{row.fallback_note}</p>}
              {row.search_error && <p className="mt-2 text-xs font-semibold text-red-800">{row.search_error}</p>}
              {(row.availability?.status === "IN_STOCK" || row.availability?.status === "OUT_OF_STOCK") && <p className="mt-3 text-xs font-semibold text-slate-800">
                {row.availability?.status === "IN_STOCK" ? "Online listing reports in stock · confirm with the branch"
                  : row.availability?.status === "OUT_OF_STOCK" ? "Online listing reports out of stock"
                  : "Stock availability unknown"}
              </p>}
              {row.fetched_at && <p className="mt-1 text-xs text-slate-600">Evidence saved: {new Date(row.fetched_at).toLocaleString()}</p>}
              {row.recommendation && <p className="mt-3 rounded-xl bg-white/60 p-3 text-sm text-slate-800">{row.recommendation.reason}</p>}
              <PricingSources result={row} />
            </article>
          ))}
        </div>
        {!loading && !pending && !savedResults.length && !error && !search?.error && <p className={styles.empty}>No saved store listings yet. Search to check prices and availability.</p>}
      </div>
      <footer className={styles.footer}>
        <button type="button" onClick={onJourney} className={styles.journey}><MapPin size={16} aria-hidden="true" /><span>Journey? Manage Suppliers → Google Maps</span></button>
        <div className={styles.actions}>
          <button type="button" onClick={onClose} className={styles.cancel}>Close</button>
          <button type="button" disabled={loading || pending} onClick={() => void start()} className={styles.search}>{pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}{pending ? "Searching…" : search ? "Search again" : "Search"}</button>
        </div>
      </footer>
      </div>
    </dialog>
  );
}
