"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Image as ImageIcon, RefreshCw, Trash2, FileClock } from "lucide-react";
import { clearSettingsStorageCache, fetchSettingsStorageUsage, type SettingsStorageUsage } from "@/lib/settings";
import { clearCachedMenuSnapshot } from "@/lib/pos-offline";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[unit]}`;
}

export default function StorageSettingsCard() {
  const [usage, setUsage] = useState<SettingsStorageUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function clearCache() {
    if (!navigator.onLine) {
      setError("Connect to the internet before clearing the offline menu cache.");
      return;
    }
    setCleaning(true);
    setError(null);
    setNotice(null);
    try {
      const result = await clearSettingsStorageCache();
      setUsage(result.usage);
      let browserBytes = 0;
      try { browserBytes = clearCachedMenuSnapshot(); } catch {
        setNotice(`Temporary files cleared (${formatBytes(result.freedBytes)}). This browser blocked menu cache cleanup.`);
        return;
      }
      const freed = result.freedBytes + browserBytes;
      setNotice(freed ? `Cleared ${formatBytes(freed)} of menu cache and old temporary files.` : "No cached menu or old temporary files to clear.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not clear cached data.");
    } finally {
      setCleaning(false);
    }
  }

  const loadUsage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsage(await fetchSettingsStorageUsage());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load storage usage.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsage(); }, [loadUsage]);

  const sections = usage ? [
    { label: "Database", bytes: usage.databaseBytes, color: "bg-[#232d46]", icon: <Database className="h-4 w-4" /> },
    { label: "Product images", bytes: usage.productImagesBytes, color: "bg-sky-500", icon: <ImageIcon className="h-4 w-4" /> },
    { label: "Profile pictures", bytes: usage.profilePicturesBytes, color: "bg-violet-500", icon: <ImageIcon className="h-4 w-4" /> },
    { label: "Old temporary files", bytes: usage.temporaryBytes ?? 0, color: "bg-amber-500", icon: <FileClock className="h-4 w-4" /> },
  ] : [];

  return (
    <section id="storage" className="rounded-[32px] border border-[#232d46]/10 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#232d46]">Storage Settings</p>
          <h2 className="mt-2 text-xl font-bold text-[#232d46]">Storage usage</h2>
          <p className="mt-1 text-sm text-[#232d46]/70">Database, uploaded images, and old temporary data stored by the app.</p>
        </div>
        <button type="button" onClick={() => void loadUsage()} disabled={loading || cleaning}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-[#232d46]/15 bg-white px-4 py-2 text-sm font-semibold text-[#232d46] hover:bg-[#f5f5f5] disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="mt-6 rounded-[28px] border border-[#232d46]/15 bg-[#f5f5f5] p-5">
        {loading && !usage ? <p className="text-sm text-[#232d46]/70">Measuring stored data...</p> : null}
        {error ? <p role="alert" className="text-sm font-medium text-rose-700">{error}</p> : null}
        {notice ? <p role="status" className="mb-4 text-sm font-medium text-emerald-700">{notice}</p> : null}
        {usage ? <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#232d46]/70">Total tracked data</p>
              <p className="mt-1 text-3xl font-bold text-[#232d46]">{formatBytes(usage.totalBytes)}</p>
            </div>
            <p className="text-xs text-[#232d46]/60">Measured {new Date(usage.measuredAt).toLocaleString()}</p>
          </div>

          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-[#232d46]/10" role="img" aria-label={`Tracked data breakdown: ${sections.map((s) => `${s.label} ${formatBytes(s.bytes)}`).join(", ")}`}>
            {sections.map((section) => <div key={section.label} className={section.color}
              style={{ width: `${usage.totalBytes ? (section.bytes / usage.totalBytes) * 100 : 0}%` }} />)}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {sections.map((section) => <div key={section.label} className="rounded-2xl border border-[#232d46]/10 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#232d46]/70">{section.icon}{section.label}</div>
              <p className="mt-2 text-lg font-bold text-[#232d46]">{formatBytes(section.bytes)}</p>
            </div>)}
          </div>
          <p className="mt-4 text-xs text-[#232d46]/60">Temporary usage includes abandoned forecast files older than 24 hours. Hosting capacity and this browser's menu cache are excluded from the total.</p>
        </> : null}
      </div>
      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-[#232d46]">Cache & temporary files</p>
          <p className="mt-1 text-sm text-[#232d46]/70">Clears this browser's saved menu and abandoned forecast files older than 24 hours.</p>
          <p className="mt-1 text-xs text-[#232d46]/60">Pending sales, recipe drafts, database records, and uploaded images are kept. The offline menu reloads next time POS connects.</p>
        </div>
        <button type="button" onClick={() => void clearCache()} disabled={loading || cleaning}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#232d46] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#232d46]/90 focus:outline-none focus:ring-2 focus:ring-[#232d46]/25 disabled:opacity-60">
          <Trash2 className="h-4 w-4" />{cleaning ? "Clearing..." : "Clear cache & temporary files"}
        </button>
      </div>
    </section>
  );
}
