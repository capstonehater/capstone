"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, ExternalLink, Navigation } from "lucide-react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { inventoryInputClasses } from "./InventoryField";

type Location = { latitude: string; longitude: string; address: string };
type Result = Location & { id: string };
type Props = Location & { onChange: (location: Location) => void };

export default function SupplierLocationPicker({ latitude, longitude, address, onChange }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const callback = useRef(onChange);
  const selection = useRef({ latitude, longitude, address });
  const request = useRef<AbortController | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [copyStatus, setCopyStatus] = useState({ url: "", message: "" });
  const lat = Number(latitude);
  const lon = Number(longitude);
  const journeyUrl = latitude.trim() && longitude.trim() &&
    Number.isFinite(lat) && Number.isFinite(lon) &&
    Math.abs(lat) <= 90 && Math.abs(lon) <= 180
      ? "https://www.google.com/maps/dir/?" + new URLSearchParams({
          api: "1",
          origin: "14.31452,120.941044",
          destination: lat.toFixed(6) + "," + lon.toFixed(6),
          travelmode: "driving",
          dir_action: "navigate",
        }).toString()
      : "";

  const copyJourneyLink = async () => {
    if (!journeyUrl) return;
    try {
      await navigator.clipboard.writeText(journeyUrl);
      setCopyStatus({ url: journeyUrl, message: "Journey link copied." });
    } catch {
      setCopyStatus({ url: journeyUrl, message: "Select the link above and copy it manually." });
    }
  };


  useEffect(() => {
    callback.current = onChange;
    selection.current = { latitude, longitude, address };
  }, [onChange, latitude, longitude, address]);

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    void import("leaflet").then((L) => {
      if (disposed || !container.current) return;
      const instance = L.map(container.current).setView([14.299, 120.958], 13);
      map.current = instance;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(instance);
      const pin = L.marker([14.299, 120.958], {
        draggable: true,
        icon: L.divIcon({
          className: "",
          html: '<div style="width:24px;height:24px;background:#f45a1f;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 5px #0006"></div>',
          iconSize: [24, 30],
          iconAnchor: [12, 30],
        }),
      });
      marker.current = pin;
      const initial = selection.current;
      if (initial.latitude !== "" && initial.longitude !== "" &&
          Number.isFinite(Number(initial.latitude)) && Number.isFinite(Number(initial.longitude))) {
        pin.setLatLng([Number(initial.latitude), Number(initial.longitude)]).addTo(instance);
        instance.setView(pin.getLatLng(), 16);
      }
      const select = async (lat: number, lon: number) => {
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        const location = { latitude: lat.toFixed(6), longitude: lon.toFixed(6), address: "" };
        pin.setLatLng([lat, lon]).addTo(instance);
        callback.current(location);
        setResults([]);
        setBusy(true);
        setMessage("Finding the address...");
        try {
          const response = await fetch("/api/geolocation?" + new URLSearchParams({
            lat: location.latitude, lon: location.longitude,
          }), { signal: controller.signal });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message);
          if (!controller.signal.aborted) {
            callback.current({ ...location, address: data.results[0]?.address ?? "" });
            setMessage(data.results.length ? "" : "No address found. The coordinates are selected.");
          }
        } catch (error) {
          if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Address lookup failed. The coordinates are selected.");
        } finally {
          if (!controller.signal.aborted) setBusy(false);
        }
      };
      instance.on("click", (event) => void select(event.latlng.lat, event.latlng.wrap().lng));
      pin.on("dragend", () => {
        const position = pin.getLatLng().wrap();
        void select(position.lat, position.lng);
      });
      observer = new ResizeObserver(() => instance.invalidateSize());
      observer.observe(container.current);
    }).catch(() => {
      if (!disposed) setMessage("The map could not load. Please reopen the supplier form to try again.");
    });
    return () => {
      disposed = true;
      request.current?.abort();
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !marker.current) return;
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!latitude || !longitude || !Number.isFinite(lat) || !Number.isFinite(lon) ||
        Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      marker.current.remove();
      return;
    }
    marker.current.setLatLng([lat, lon]).addTo(map.current);
    if (!map.current.getBounds().contains([lat, lon])) map.current.setView([lat, lon], 16);
  }, [latitude, longitude]);

  const search = async () => {
    if (!query.trim()) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setResults([]);
    setMessage("");
    try {
      const response = await fetch("/api/geolocation?" + new URLSearchParams({ q: query.trim() }), {
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      if (!controller.signal.aborted) {
        setResults(data.results);
        setMessage(data.results.length ? "Select a search result to place the pin." : "No locations found.");
      }
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Location search failed.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <label htmlFor="supplier-location-search" className="text-sm font-semibold text-slate-700">Supplier location</label>
      <div className="flex gap-2">
        <input id="supplier-location-search" className={inventoryInputClasses} value={query}
          placeholder="Search an address or place"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} />
        <button type="button" onClick={() => void search()} disabled={busy || !query.trim()}
          className="rounded-xl border border-slate-300 px-4 text-sm font-semibold disabled:opacity-50">Search</button>
      </div>
      {results.length > 0 && <ul className="max-h-40 overflow-y-auto rounded-xl border border-slate-200">
        {results.map((result) => <li key={result.id}>
          <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-orange-50"
            onClick={() => {
              request.current?.abort();
              setBusy(false);
              onChange(result);
              map.current?.setView([Number(result.latitude), Number(result.longitude)], 16);
              setResults([]);
              setMessage("");
            }}>{result.address}</button>
        </li>)}
      </ul>}
      <p className="text-xs text-slate-500">Click the map or drag the pin to fill latitude and longitude.</p>
      <div ref={container} aria-label="Supplier location map" className="relative z-0 h-72 rounded-xl border border-slate-200" />
      <p role="status" className="text-xs text-slate-600">{message}</p>
      <p className="text-sm text-slate-700">{address || (latitude && longitude ? "Coordinates selected" : "No location selected")}</p>
      {journeyUrl ? (
        <section aria-labelledby="supplier-journey-title" className="min-w-0 overflow-hidden rounded-2xl border border-[#232d46]/15 bg-[#f5f5f5]">
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#232d46]/15 bg-white text-[#232d46]">
                <Navigation aria-hidden="true" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h4 id="supplier-journey-title" className="text-sm font-semibold leading-5 text-slate-900">Google Maps journey</h4>
                <p className="mt-1 text-xs leading-5 text-slate-600">Plan your drive to the selected supplier location.</p>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="supplier-journey-link" className="block text-xs font-semibold text-slate-600">Directions link</label>
              <input id="supplier-journey-link" type="url" readOnly value={journeyUrl}
                onFocus={(event) => event.target.select()}
                className="block h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none transition focus:border-[#232d46] focus:ring-2 focus:ring-[#232d46]/15" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <a href={journeyUrl} target="_blank" rel="noopener noreferrer"
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-transparent bg-[#232d46] px-3 py-3 text-center text-sm font-semibold leading-5 text-white !no-underline transition hover:bg-[#1b2438] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#232d46] focus-visible:ring-offset-2">
                <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span>Open Google Maps</span>
              </a>
              <button type="button" onClick={() => void copyJourneyLink()}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-sm font-semibold leading-5 text-slate-700 transition hover:border-[#232d46] hover:bg-[#f5f5f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#232d46] focus-visible:ring-offset-2">
                <Copy aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span>Copy journey link</span>
              </button>
            </div>
            {copyStatus.url === journeyUrl && copyStatus.message ? (
              <p role="status" className="text-xs leading-5 text-slate-600">{copyStatus.message}</p>
            ) : null}
          </div>
          <p className="border-t border-[#232d46]/15 px-4 py-3 text-xs leading-5 text-slate-500 sm:px-5">
            Starting point: 14.31452, 120.941044. Destination: the selected supplier pin.
          </p>
        </section>
      ) : <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500">Select a location to generate a Google Maps journey link.</p>}
      <a href="https://locationiq.com" target="_blank" rel="noreferrer" className="text-xs text-slate-500 underline">Search by LocationIQ.com</a>
    </div>
  );
}
