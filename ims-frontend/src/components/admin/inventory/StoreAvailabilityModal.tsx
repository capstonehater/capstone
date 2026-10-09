"use client";
import ModalCloseButton from "@/components/ModalCloseButton";


import { useEffect, useRef, useState } from "react";
import { Loader2, ChevronDown, ExternalLink, Store, Package, MapPin, Bot } from "lucide-react";
import { apiJsonFetch } from "@/lib/api";
import styles from "./StoreAvailabilityModal.module.css";
import motion from "./InventoryModalMotion.module.css";

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
    confidence?: { level: "Low" | "Moderate"; percentage?: number; reasons: string[]; notice: string };
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
  market_reference?: {
    median_php: number; low_php: number; high_php: number; sample_size: number;
    product: string; fetched_at: string;
    listings: { title: string; url: string; price: number }[];
  } | null;
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
  const [showOtherStores, setShowOtherStores] = useState(false);
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
  const market = savedResults.find(({ payload }) => payload.market_reference)?.payload.market_reference;
  const hasRecommendations = savedResults.some(({ payload }) => payload.recommendation);
  const topResults = hasRecommendations ? savedResults.filter(({ payload }) =>
    payload.recommendation?.rank != null && payload.recommendation.rank <= 3) : savedResults;
  const otherCount = savedResults.length - topResults.length;
  const visibleResults = showOtherStores ? savedResults : topResults;
  const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
  return (
    <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); onClose(); }} aria-labelledby="store-availability-title"
      className={`${styles.dialog} ${motion.panel}`}>
      <div className={styles.surface}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
        <div className={styles.heading}>
          <span className={styles.icon}><Store size={23} aria-hidden="true" /></span>
          <h2 id="store-availability-title">Store Availability</h2>
        </div>
        <ModalCloseButton onClose={onClose} />
        </div>
        <div className={styles.product}><Package size={15} aria-hidden="true" /><span>{search?.productName ?? materialName}</span></div>
      </header>
      <div className={styles.body} tabIndex={0} role="region" aria-label="Store availability results">
        {search?.results[0]?.payload.selected_brand && <p className="mt-2 text-sm font-semibold text-slate-700">Selected brand: {search.results[0].payload.selected_brand} · Same brand searched across stores</p>}
        <p className="mt-2 text-sm text-slate-500">Online listings and price estimates. Confirm branch stock and pack size with the store.</p>
        {search?.completedAt && <p className="mt-2 text-xs text-slate-500">Last checked: {new Date(search.completedAt).toLocaleString()}</p>}
        {!pending && savedResults.length > 0 && <details aria-label="Market price comparison" className="group/market mt-3 rounded-xl border border-blue-200 bg-blue-50">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs text-slate-700 focus-visible:outline-2 focus-visible:outline-[#5274a4] [&::-webkit-details-marker]:hidden">
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><span>Market estimate</span><strong className="text-sm text-slate-900">{market ? money(market.median_php) : "Unavailable"}</strong><span>{market ? "median · not a store quote" : "No comparable prices saved"}</span></span>
            <ChevronDown size={15} aria-hidden="true" className="shrink-0 transition-transform group-open/market:rotate-180" />
          </summary>
          <div className="border-t border-blue-200 px-3 pb-3 pt-2">
          {market ? <>
            <p className="mt-1 text-xs text-slate-700">Range {money(market.low_php)}–{money(market.high_php)} · {market.sample_size} distinct listing{market.sample_size === 1 ? "" : "s"}</p>
            <p className="mt-2 text-xs text-slate-700">For {market.product}. This is a market estimate, not a quote from any registered store. Check pack size, delivery fees and branch stock.</p>
            <p className="mt-1 text-xs text-slate-600">Checked: {new Date(market.fetched_at).toLocaleString()}</p>
            <PricingSources result={{ store_name: "Market", address: "", price: null, price_type: null, status: "UNVERIFIED", source_url: null, fallback_listings: market.listings }} />
          </> : <p className="mt-2 text-xs text-slate-700">No comparable market prices saved. Search again to check the market; no estimate is assumed.</p>}
          </div>
        </details>}
        {hasRecommendations && <p className="mt-3 text-sm font-semibold text-slate-700">Recommended stores · Top 1–3</p>}
        {recommendationNotice && <p className="mt-2 rounded-xl bg-[#e8eef7] p-3 text-sm text-[#232d46]">{recommendationNotice}</p>}
        <div aria-live="polite">
          {(error || search?.error) && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error || search?.error}</p>}
          {loading && <p className="py-12 text-center text-slate-500">Loading saved results…</p>}
          {pending && <p className="flex items-center justify-center gap-2 py-10 text-sm"><Loader2 size={18} className="animate-spin" /> {search?.status === "RANKING" ? "Search results saved. Qwen is reviewing store recommendations." : "Searching registered stores."} You can close this window and return later.</p>}
        </div>
        <div className="mt-4 space-y-4">
          {visibleResults.map(({ id, payload: row }) => (
            <article key={id} className={styles.card}>
              {row.recommendation && <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={styles.rank}>{row.recommendation.rank !== null ? `Top ${row.recommendation.rank}` : "Other registered store"}</span>
                {row.recommendation.source === "rules" ? <span className="text-xs text-slate-700">Rule-based fallback</span> : <span title="AI recommendation" aria-label="AI recommendation" className="inline-flex rounded-full bg-blue-100 p-1.5 text-blue-800"><Bot size={17} aria-hidden="true" /></span>}
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${(row.recommendation.confidence?.percentage ?? 0) >= 60 ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-900"}`}>{typeof row.recommendation.confidence?.percentage === "number" ? `${row.recommendation.confidence.percentage}% confidence` : "Search again to assess confidence"}</span>
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
              {row.recommendation?.confidence && <details className="mt-2 text-xs text-slate-600">
                <summary className="cursor-pointer font-semibold">Why this confidence level?</summary>
                <ul className="mt-2 list-disc space-y-1 pl-4">{row.recommendation.confidence.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                <p className="mt-2">{row.recommendation.confidence.notice}</p>
              </details>}
              <PricingSources result={row} />
            </article>
          ))}
        </div>
        {otherCount > 0 && <button type="button" onClick={() => setShowOtherStores((value) => !value)} aria-expanded={showOtherStores}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#d5ddea] px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-[#e8eef7]">
          {showOtherStores ? "Show Top 1–3 only" : `View ${otherCount} other store${otherCount === 1 ? "" : "s"}`}
          <ChevronDown size={15} aria-hidden="true" className={showOtherStores ? "rotate-180" : ""} />
        </button>}
        {!loading && !pending && !savedResults.length && !error && !search?.error && <p className={styles.empty}>No saved store listings yet. Search to check prices and availability.</p>}
      </div>
      <footer className={styles.footer}>
        <button type="button" onClick={onJourney} className={styles.journey}><MapPin size={16} aria-hidden="true" /><span>Journey? Manage Suppliers → Google Maps</span></button>
        <div className={styles.actions}>
          <button type="button" disabled={loading || pending} onClick={() => void start()} className={styles.search}>{pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}{pending ? "Searching…" : search ? "Search again" : "Search"}</button>
        </div>
      </footer>
      </div>
    </dialog>
  );
}
