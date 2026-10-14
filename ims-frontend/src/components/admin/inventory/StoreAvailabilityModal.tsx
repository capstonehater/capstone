"use client";
import ModalCloseButton from "@/components/ModalCloseButton";


import { useEffect, useRef, useState } from "react";
import { Loader2, ChevronDown, ExternalLink, Store, Package, MapPin, Bot, ChartNoAxesCombined, Search as SearchIcon, Check, CircleAlert, Navigation } from "lucide-react";
import { apiJsonFetch } from "@/lib/api";
import { cacheLocation, clearCachedLocation, getCachedLocation, freshLocation, validLocation, storeDistance, type UserLocation } from "@/lib/store-distance";
import styles from "./StoreAvailabilityModal.module.css";
import StoreMapPreview from "./StoreMapPreview";
import motion from "./InventoryModalMotion.module.css";

type StoreResult = {
  store_name?: string | null;
  address: string;
  distance?: number | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
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
  createdAt?: string | null;
  completedAt: string | null;
  results: { id: string; payload: StoreResult }[];
};

function storeName(result: StoreResult): string {
  return typeof result.store_name === "string" && result.store_name.trim()
    ? result.store_name.trim()
    : "Unknown store";
}

function navigationDestination(result: StoreResult): string | null {
  if (result.latitude == null || result.longitude == null
    || String(result.latitude).trim() === "" || String(result.longitude).trim() === "") return null;
  const latitude = Number(result.latitude), longitude = Number(result.longitude);
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90
    || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return null;
  return `${latitude},${longitude}`;
}

function openNavigation(destination: string, location: UserLocation | null) {
  const current = getCachedLocation() ?? (freshLocation(location) ? location : null);
  const origin = current ? `${current.latitude},${current.longitude}` : null;
  if (/Android/i.test(navigator.userAgent) && !origin) {
    // No package is forced; Android resolves the installed navigation handler.
    window.open(`google.navigation:q=${encodeURIComponent(destination)}&mode=d`, "_blank", "noopener,noreferrer");
  } else if (/iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    window.open(`https://maps.apple.com/?${new URLSearchParams({ daddr: destination, dirflg: "d", ...(origin ? { saddr: origin } : {}) })}`, "_blank", "noopener,noreferrer");
  } else {
    window.open(`https://www.google.com/maps/dir/?${new URLSearchParams({
      api: "1", destination, ...(origin ? { origin } : {}), travelmode: "driving", dir_action: "navigate",
    })}`, "_blank", "noopener,noreferrer");
  }
}

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

export default function StoreAvailabilityModal({ materialId, materialName, onClose }: {
  materialId: string; materialName: string; onClose: () => void;
}) {
  const [search, setSearch] = useState<Search | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOtherStores, setShowOtherStores] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [location, setLocation] = useState<UserLocation | null>(() => getCachedLocation());
  const [locationError, setLocationError] = useState("");
  const [locationRequest, setLocationRequest] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const endpoint = `/raw-materials/${encodeURIComponent(materialId)}/store-availability`;

  useEffect(() => {
    setLocation(getCachedLocation());
    setLocationError("");
    if (!window.isSecureContext || !navigator.geolocation) {
      setLocationError("Live location requires HTTPS and device location support.");
      return;
    }
    let disposed = false;
    let refreshing = false;
    const receivePosition = (position: GeolocationPosition) => {
      if (disposed) return;
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude,
        accuracy: position.coords.accuracy, timestamp: position.timestamp };
      if (freshLocation(next)) cacheLocation(next);
      setLocation(freshLocation(next) ? next : getCachedLocation());
      setLocationError("");
    };
    const receiveError = (error: GeolocationPositionError) => {
      if (disposed) return;
      if (error.code === 1) clearCachedLocation();
      setLocation(current => error.code !== 1 && validLocation(current) ? current : null);
      setLocationError(error.code === 1 ? "Allow location access to calculate supplier distances."
        : error.code === 3 ? "Location request timed out. Retrying automatically..."
        : "Your live location is unavailable. Check device location services or refresh your location.");
    };
    const options = { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 };
    const watch = navigator.geolocation.watchPosition(receivePosition, receiveError, options);
    // Stationary devices may stop emitting watch updates; keep distances fresh.
    const refreshPosition = () => {
      if (disposed || refreshing || document.visibilityState === "hidden") return;
      refreshing = true;
      navigator.geolocation.getCurrentPosition(
        position => { refreshing = false; receivePosition(position); },
        error => { refreshing = false; receiveError(error); }, options);
    };
    // Get a quick network/device fix while the high-accuracy watcher refines it.
    if (!getCachedLocation()) {
      navigator.geolocation.getCurrentPosition(receivePosition, receiveError,
        { enableHighAccuracy: false, maximumAge: 30000, timeout: 5000 });
    }
    const refreshLocation = window.setInterval(refreshPosition, 15000);
    document.addEventListener("visibilitychange", refreshPosition);
    const expiry = window.setInterval(() => setLocation(current => {
      const cached = getCachedLocation();
      return cached && (!validLocation(current) || cached.timestamp > current.timestamp)
        ? cached : validLocation(current) ? current : null;
    }), 1000);
    return () => {
      disposed = true;
      navigator.geolocation.clearWatch(watch);
      window.clearInterval(expiry);
      window.clearInterval(refreshLocation);
      document.removeEventListener("visibilitychange", refreshPosition);
    };
  }, [locationRequest]);

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
        if (response.search && ["PENDING", "RANKING"].includes(response.search.status)) {
          setShowResults(true);
          timer = setTimeout(load, 2500);
        }
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
    setLocationError("");
    try {
      // Store search must not wait for a device GPS fix. Distances update live.
      const origin = freshLocation(location) ? location : getCachedLocation();
      const response = await apiJsonFetch<{ search: Search }>(endpoint, {
        method: "POST", body: JSON.stringify(origin ? { latitude: origin.latitude, longitude: origin.longitude } : {}),
      });
      setSearch(response.search);
      setShowResults(true);
      setRefresh((value) => value + 1);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to start search."); }
    finally { setStarting(false); }
  }

  const pending = starting || search?.status === "PENDING" || search?.status === "RANKING";
  const displayingResults = showResults || pending;
  const searchDate = search?.createdAt || search?.completedAt;
  const searchedAt = searchDate && !Number.isNaN(Date.parse(searchDate)) ? new Date(searchDate) : null;
  const locationLoading = !validLocation(location) && !locationError;
  const savedResults = [...(search?.results ?? [])].sort((a, b) =>
    (a.payload.recommendation?.rank ?? Infinity) - (b.payload.recommendation?.rank ?? Infinity)
    || storeName(a.payload).localeCompare(storeName(b.payload)));
  const recommendationNotice = savedResults.find(({ payload }) => payload.recommendation?.notice)?.payload.recommendation?.notice;
  const market = savedResults.find(({ payload }) => payload.market_reference)?.payload.market_reference;
  const hasRecommendations = savedResults.some(({ payload }) => payload.recommendation);
  const topResults = hasRecommendations ? savedResults.filter(({ payload }) =>
    payload.recommendation?.rank != null && payload.recommendation.rank <= 3) : savedResults;
  const otherCount = savedResults.length - topResults.length;
  const visibleResults = displayingResults ? (showOtherStores ? savedResults : topResults) : [];
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
          <details className={styles.headerHint} onKeyDown={(event) => {
            if (event.key === "Escape" && event.currentTarget.open) {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.open = false;
            }
          }}>
            <summary aria-label="About store availability" className={styles.hintButton}>
              <CircleAlert size={18} aria-hidden="true" />
            </summary>
            <div className={styles.hintContent}>
              <p>Online listings and price estimates. Confirm branch stock and pack size with the store.</p>
              {search?.completedAt && <p className={styles.hintTimestamp}>Last checked: {new Date(search.completedAt).toLocaleString()}</p>}
            </div>
          </details>
        </div>
        <ModalCloseButton onClose={onClose} />
        </div>
        <div className={styles.product}><Package size={15} aria-hidden="true" /><span>{search?.productName ?? materialName}</span></div>
        {displayingResults && !pending && searchedAt && <p className="mt-2 text-xs text-slate-600">
          Search date: <time dateTime={searchedAt.toISOString()}>{searchedAt.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</time>
        </p>}
      </header>
      <div className={styles.body} tabIndex={0} role="region" aria-label="Store availability results">
        {displayingResults && search?.results[0]?.payload.selected_brand && <p className="mt-2 text-sm font-semibold text-slate-700">Selected brand: {search.results[0].payload.selected_brand} · Same brand searched across stores</p>}
        {displayingResults && !pending && savedResults.length > 0 && <details aria-label="Market price comparison" className={styles.marketCard}>
          <summary className={styles.marketSummary}>
            <span className={styles.marketIcon}><ChartNoAxesCombined size={22} aria-hidden="true" /></span>
            <span className={styles.marketHeading}>
              <span className={styles.marketLabel}>Market estimate</span>
              <strong className={styles.marketPrice}>{market ? money(market.median_php) : "Unavailable"}</strong>
              <span className={styles.marketCaption}>{market ? "Median price across online listings" : "No comparable prices saved"}</span>
            </span>
            <span className={styles.marketAside}>
              <span className={styles.estimateBadge}>Price reference</span>
              <span className={styles.marketToggle}><span>Details</span><ChevronDown size={16} aria-hidden="true" /></span>
            </span>
          </summary>
          <div className={styles.marketDetails}>
          {market ? <>
            <dl className={styles.marketStats}>
              <div><dt>Price range</dt><dd>{money(market.low_php)} - {money(market.high_php)}</dd></div>
              <div><dt>Sources compared</dt><dd>{market.sample_size} distinct listing{market.sample_size === 1 ? "" : "s"}</dd></div>
            </dl>
            <p className={styles.marketNote}>For {market.product}. This is a market estimate, not a store quote. Confirm pack size, delivery fees and branch stock.</p>
            <p className={styles.marketChecked}>Checked: {new Date(market.fetched_at).toLocaleString()}</p>
            <PricingSources result={{ store_name: "Market", address: "", price: null, price_type: null, status: "UNVERIFIED", source_url: null, fallback_listings: market.listings }} />
          </> : <p className={styles.marketNote}>No comparable market prices saved. Search again to check the market; no estimate is assumed.</p>}
          </div>
        </details>}
        {displayingResults && hasRecommendations && <p className="mt-3 text-sm font-semibold text-slate-700">Recommended stores · Top 1–3</p>}
        {displayingResults && recommendationNotice && <p className="mt-2 rounded-xl bg-[#e8eef7] p-3 text-sm text-[#232d46]">{recommendationNotice}</p>}
        <div aria-live="polite">
          {(error || search?.error) && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error || search?.error}</p>}
          {(!showResults || loading || pending) && <section className={styles.loadingPanel} aria-busy={loading || pending} aria-label={loading ? "Loading saved store information" : pending ? "Store search in progress" : "Start a store search"}>
            <div className={styles.loadingEmblem}>
              <span className={`${styles.loadingRing} ${!loading && !pending ? styles.idleRing : ""}`} aria-hidden="true" />
              <Bot size={28} aria-hidden="true" />
            </div>
            <span className={styles.loadingEyebrow}>Store availability search</span>
            <h3 className={styles.loadingTitle}>{loading ? "Loading store information" : starting && locationLoading ? "Getting your current location" : !pending ? "Find your best store options" : search?.status === "RANKING" ? "Finding your best store options" : "Checking registered stores"}</h3>
            <p className={styles.loadingDescription}>{loading ? "Retrieving saved listings, prices and supplier information..." : starting && locationLoading ? "Waiting for your device location to calculate supplier distances..." : !pending ? "Search registered suppliers for product listings and prices, and compare their distance from your live location." : search?.status === "RANKING" ? "Search evidence is saved. We are comparing results to prepare your recommendations." : "Looking for product listings, prices and availability. Results will appear here as the search progresses."}</p>
            {pending && <ol className={styles.searchSteps} aria-label="Search stages">
              <li className={styles.stepComplete}><span className={styles.stepDot}><Check size={13} aria-hidden="true" /></span><span>Start search</span></li>
              <li className={search?.status === "RANKING" ? styles.stepComplete : styles.stepActive} aria-current={search?.status !== "RANKING" ? "step" : undefined}><span className={styles.stepDot}>{search?.status === "RANKING" ? <Check size={13} aria-hidden="true" /> : <Loader2 size={13} className={styles.stepSpinner} aria-hidden="true" />}</span><span>Check listings</span></li>
              <li className={search?.status === "RANKING" ? styles.stepActive : styles.stepWaiting} aria-current={search?.status === "RANKING" ? "step" : undefined}><span className={styles.stepDot}>{search?.status === "RANKING" ? <Loader2 size={13} className={styles.stepSpinner} aria-hidden="true" /> : "3"}</span><span>Compare stores</span></li>
            </ol>}
            {!pending && !showResults && <div className={styles.introActions}>
              <button type="button" className={styles.search} disabled={loading} onClick={() => void start()}><SearchIcon size={16} aria-hidden="true" />{loading ? "Loading saved search..." : "Search"}</button>
              {search && <button type="button" className={styles.savedSearchButton} onClick={() => setShowResults(true)}>View saved results</button>}
            </div>}
            {pending && <p className={styles.loadingHint}>You can close this window and return later.</p>}
            {(loading || pending) && !savedResults.length && <div className={styles.skeletonList} aria-hidden="true">{[0, 1].map(index => <div key={index} className={styles.skeletonCard}><span className={styles.skeletonIcon} /><div><span className={styles.skeletonLine} /><span className={styles.skeletonLineShort} /></div><span className={styles.skeletonPrice} /></div>)}</div>}
          </section>}
        </div>
        <div className={styles.resultsList}>
          <div className={styles.locationToolbar}>
          <p className={styles.locationNotice} role="status">
            {locationLoading ? <Loader2 size={14} className={styles.stepSpinner} aria-hidden="true" /> : <MapPin size={14} aria-hidden="true" />}
            {validLocation(location) ? `${freshLocation(location) ? "Live location" : "Last known location ? updating in the background"}. Accuracy: approximately ${Math.ceil(location.accuracy)} m. Distances are straight-line estimates.` : locationError || "Loading your current location and supplier distances..."}
          </p>
          <button type="button" className={styles.refreshLocation} onClick={() => setLocationRequest(value => value + 1)}>Refresh location</button>
          </div>
          {visibleResults.map(({ id, payload: row }) => {
            const distance = storeDistance(location, row.latitude, row.longitude);
            const destination = navigationDestination(row);
            const navigationNotice = !destination ? "Navigation unavailable: supplier coordinates are not registered."
              : "";
            return (
            <article key={id} className={styles.card}>
              <div className={styles.cardTop}>
              {row.recommendation && <div className={styles.recommendationBadges}>
                <span className={styles.rank}>{row.recommendation.rank !== null ? `Top ${row.recommendation.rank}` : "Other registered store"}</span>
                {row.recommendation.source === "rules" ? <span className="text-xs text-slate-700">Rule-based fallback</span> : <span title="AI recommendation" aria-label="AI recommendation" className="inline-flex rounded-full bg-blue-100 p-1.5 text-blue-800"><Bot size={17} aria-hidden="true" /></span>}
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${(row.recommendation.confidence?.percentage ?? 0) >= 60 ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-900"}`}>{typeof row.recommendation.confidence?.percentage === "number" ? `${row.recommendation.confidence.percentage}% confidence` : "Search again to assess confidence"}</span>
              </div>}
              <div className={styles.storeActions}>
              <StoreMapPreview name={storeName(row)} latitude={row.latitude} longitude={row.longitude} />
              <button type="button" className={styles.navigation} disabled={!destination}
                aria-label={`Navigation to ${storeName(row)} (opens in a new tab)`}
                title={navigationNotice || "Open driving navigation from your current location in a new tab"}
                onClick={() => { if (destination) openNavigation(destination, location); }}>
                <Navigation size={15} aria-hidden="true" />Navigation
              </button>
              </div>
              </div>
              {navigationNotice && <p className={styles.navigationNotice}>{navigationNotice}</p>}
              <div className={styles.storeHeading}>
                <div className="min-w-0">
                  <h4 className={styles.storeName}>{storeName(row)}</h4>
                  <p className="mt-1 text-xs text-slate-700">{row.address}</p>
                  <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-700" aria-busy={!!destination && locationLoading}>
                    {destination && locationLoading && <Loader2 size={14} className={styles.stepSpinner} aria-hidden="true" />}
                    {destination && locationLoading ? "Calculating distance from your current location..." : distance !== null
                      ? `${new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(distance)} km from your ${freshLocation(location) ? "current" : "last known"} location (straight-line)`
                      : "Distance unavailable. Allow live location access and check the supplier coordinates."}
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
          ); })}
        </div>
        {displayingResults && otherCount > 0 && <button type="button" onClick={() => setShowOtherStores((value) => !value)} aria-expanded={showOtherStores}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#d5ddea] px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-[#e8eef7]">
          {showOtherStores ? "Show Top 1–3 only" : `View ${otherCount} other store${otherCount === 1 ? "" : "s"}`}
          <ChevronDown size={15} aria-hidden="true" className={showOtherStores ? "rotate-180" : ""} />
        </button>}
        {showResults && !loading && !pending && !savedResults.length && !error && !search?.error && <p className={styles.empty}>No saved store listings yet. Search to check prices and availability.</p>}
      </div>
      {displayingResults && search && <footer className={styles.footer}>
        <div className={styles.actions}>
          <button type="button" disabled={loading || pending} onClick={() => void start()} className={styles.search}>{pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}{pending ? "Searching…" : search ? "Search again" : "Search"}</button>
        </div>
      </footer>}
      </div>
    </dialog>
  );
}
