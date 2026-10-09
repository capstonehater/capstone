"use client";

import SearchInput from "@/components/ui/SearchInput";
import { useEffect, useRef, useState } from "react";
import { Copy, ExternalLink, Loader2, Navigation } from "lucide-react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { inventoryInputClasses } from "./InventoryField";

type Location = { latitude: string; longitude: string; address: string };
type Result = Location & { id: string };
type Props = Location & { onChange: (location: Location) => void; readOnly?: boolean; error?: string };

const PRECISE_LOCATION_ACCURACY_METERS = 50;
const MAX_LOCATION_AGE_MS = 30000;

function isFreshPosition(position: GeolocationPosition | null): position is GeolocationPosition {
  if (!position) return false;
  const { latitude, longitude, accuracy } = position.coords;
  const age = Date.now() - position.timestamp;
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 &&
    Number.isFinite(accuracy) && accuracy >= 0 &&
    Number.isFinite(age) && age >= 0 && age <= MAX_LOCATION_AGE_MS;
}

export default function SupplierLocationPicker({ latitude, longitude, address, onChange, readOnly = false, error }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const [activeMap, setActiveMap] = useState<LeafletMap | null>(null);
  const fittedUserLocation = useRef(false);
  const marker = useRef<Marker | null>(null);
  const callback = useRef(onChange);
  const selection = useRef({ latitude, longitude, address });
  const request = useRef<AbortController | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [copyStatus, setCopyStatus] = useState({ url: "", message: "" });
  const [currentPosition, setCurrentPosition] = useState<GeolocationPosition | null>(null);
  const [locationStatus, setLocationStatus] = useState("Requesting your current location...");
  const [locationRequest, setLocationRequest] = useState(0);
  const [openingJourney, setOpeningJourney] = useState(false);
  const journeyLoadingDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = journeyLoadingDialog.current;
    if (!dialog) return;
    if (openingJourney && !dialog.open) dialog.showModal();
    else if (!openingJourney && dialog.open) dialog.close();
  }, [openingJourney]);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const lat = Number(latitude);
  const lon = Number(longitude);
  const journeyUrl = latitude.trim() && longitude.trim() &&
    Number.isFinite(lat) && Number.isFinite(lon) &&
    Math.abs(lat) <= 90 && Math.abs(lon) <= 180
      ? "https://www.google.com/maps/dir/?" + new URLSearchParams({
          api: "1",
          ...(isFreshPosition(currentPosition) ? { origin: `${currentPosition.coords.latitude},${currentPosition.coords.longitude}` } : {}),
          destination: lat.toFixed(6) + "," + lon.toFixed(6),
          travelmode: "driving",
          dir_action: "navigate",
        }).toString()
      : "";

  useEffect(() => {
    setCurrentPosition(null);
    setLocationStatus("Requesting your current location...");
    if (!window.isSecureContext || !navigator.geolocation) {
      setLocationStatus("Live location requires HTTPS and a browser with location support. Google Maps will request your starting location.");
      return;
    }
    let disposed = false;
    let refreshing = false;
    const receivePosition = (position: GeolocationPosition) => {
        if (disposed) return;
        if (!isFreshPosition(position)) {
          setCurrentPosition(null);
          setLocationStatus("Waiting for a fresh location reading from your device.");
          return;
        }
        setCurrentPosition(position);
        setLocationStatus("");
      };
    const receiveError = (error: GeolocationPositionError) => {
        if (disposed) return;
        setCurrentPosition(null);
        setLocationStatus(error.code === 1
          ? "Location permission is blocked. Enable location access to use your current position. You can still open Google Maps."
          : error.code === 3 ? "Location request timed out. Retrying automatically..."
          : "Your current location is unavailable. Check device location services or try Refresh location.");
      };
    const options: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 };
    const watchId = navigator.geolocation.watchPosition(receivePosition, receiveError, options);
    // Refresh stationary readings too: watchPosition may only report movement.
    const refreshPosition = () => {
      if (disposed || refreshing || document.visibilityState === "hidden") return;
      refreshing = true;
      navigator.geolocation.getCurrentPosition(
        (position) => { refreshing = false; receivePosition(position); },
        (error) => { refreshing = false; receiveError(error); },
        options,
      );
    };
    const refreshTimer = window.setInterval(refreshPosition, 15000);
    document.addEventListener("visibilitychange", refreshPosition);
    const expiryTimer = window.setInterval(() => {
      setCurrentPosition((position) => position && Date.now() - position.timestamp > MAX_LOCATION_AGE_MS ? null : position);
    }, 1000);
    return () => {
      disposed = true;
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(expiryTimer);
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", refreshPosition);
    };
  }, [locationRequest]);

  useEffect(() => {
    if (!activeMap || !currentPosition) return;
    let disposed = false;
    let removeLayers: (() => void) | undefined;
    void import("leaflet").then((L) => {
      if (disposed) return;
      const point: [number, number] = [currentPosition.coords.latitude, currentPosition.coords.longitude];
      const accuracy = L.circle(point, {
        radius: currentPosition.coords.accuracy,
        color: "#2563eb", weight: 1, fillColor: "#3b82f6", fillOpacity: 0.12,
        interactive: false,
      }).addTo(activeMap);
      const userPin = L.circleMarker(point, {
        radius: 8, color: "white", weight: 3, fillColor: "#2563eb", fillOpacity: 1,
        bubblingMouseEvents: false,
      }).addTo(activeMap).bindTooltip("Your live location", { permanent: true, direction: "top" });
      removeLayers = () => { userPin.remove(); accuracy.remove(); };
      if (!fittedUserLocation.current) {
        const supplier = selection.current;
        const destinationLat = Number(supplier.latitude);
        const destinationLon = Number(supplier.longitude);
        if (supplier.latitude.trim() && supplier.longitude.trim() &&
            Number.isFinite(destinationLat) && Number.isFinite(destinationLon) &&
            Math.abs(destinationLat) <= 90 && Math.abs(destinationLon) <= 180) {
          activeMap.fitBounds(L.latLngBounds([point, [destinationLat, destinationLon]]), { padding: [40, 40], maxZoom: 16 });
        } else activeMap.setView(point, 16);
        fittedUserLocation.current = true;
      }
    }).catch(() => { if (!disposed) setLocationStatus("Your coordinates are available, but the location pin could not load."); });
    return () => { disposed = true; removeLayers?.(); };
  }, [activeMap, currentPosition]);

  const copyJourneyLink = async () => {
    if (!journeyUrl) return;
    if (!isFreshPosition(currentPosition)) {
      setCopyStatus({ url: journeyUrl, message: "Refresh your location before copying driving directions." });
      return;
    }
    try {
      await navigator.clipboard.writeText(journeyUrl);
      setCopyStatus({ url: journeyUrl, message: "Journey link copied." });
    } catch {
      setCopyStatus({ url: journeyUrl, message: "Select the link above and copy it manually." });
    }
  };

  const openJourney = async () => {
    if (!journeyUrl || openingJourney) return;
    if (!window.isSecureContext || !navigator.geolocation) {
      setLocationStatus("Enable location access on HTTPS to start driving from your live coordinates.");
      return;
    }
    setOpeningJourney(!isFreshPosition(currentPosition));
    setLocationStatus(isFreshPosition(currentPosition) ? "" : "Refreshing your coordinates for driving directions...");
    try {
      // The live watcher already supplies recent coordinates; avoid another GPS wait on click.
      const position = isFreshPosition(currentPosition) ? currentPosition : await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, maximumAge: MAX_LOCATION_AGE_MS, timeout: 5000,
        });
      }).catch(() => isFreshPosition(currentPosition) ? currentPosition : null);
      if (!mounted.current) return;
      if (!isFreshPosition(position)) {
        setLocationStatus("No fresh coordinates available. Allow location access and select Refresh location before starting your drive.");
        return;
      }
      setCurrentPosition(position);
      setLocationStatus("");
      const url = new URL(journeyUrl);
      url.searchParams.set("origin", `${position.coords.latitude},${position.coords.longitude}`);
      // Open only once location permission and the route are ready.
      const journeyTab = window.open(url.toString(), "_blank");
      if (journeyTab) journeyTab.opener = null;
      else window.location.assign(url.toString());
    } finally {
      if (mounted.current) setOpeningJourney(false);
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
      const instance = L.map(container.current, {
        dragging: !readOnly,
        touchZoom: !readOnly,
        doubleClickZoom: !readOnly,
        scrollWheelZoom: !readOnly,
        boxZoom: !readOnly,
        keyboard: !readOnly,
        zoomControl: !readOnly,
      }).setView([14.299, 120.958], 13);
      map.current = instance;
      fittedUserLocation.current = false;
      setActiveMap(instance);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        referrerPolicy: "strict-origin-when-cross-origin",
      }).addTo(instance);
      const pin = L.marker([14.299, 120.958], {
        draggable: !readOnly,
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
        if (readOnly) return;
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
      setBusy(false);
      setResults([]);
      setMessage("");
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
      setActiveMap(null);
      marker.current = null;
    };
  }, [readOnly]);

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
    if (readOnly || !query.trim()) return;
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
      <dialog ref={journeyLoadingDialog} aria-labelledby="journey-loading-title" aria-describedby="journey-loading-description"
        aria-busy={openingJourney} onCancel={(event) => event.preventDefault()}
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl backdrop:bg-slate-900/50">
        <Loader2 aria-hidden="true" className="mx-auto h-10 w-10 animate-spin text-[#232d46] motion-reduce:animate-none" />
        <h2 id="journey-loading-title" className="mt-4 text-lg font-semibold text-slate-900">Finding your current location</h2>
        <p id="journey-loading-description" role="status" className="mt-2 text-sm leading-6 text-slate-600">
          Getting a fresh location for your journey. This may take up to 5 seconds. Google Maps will open automatically when your location is ready.
        </p>
      </dialog>
      <label htmlFor="supplier-location-search" className="text-sm font-semibold text-slate-700">Supplier Location<span className="text-red-600" aria-hidden="true"> *</span></label>
      <div className="flex gap-2">
        <SearchInput id="supplier-location-search" className={`${inventoryInputClasses} ${error ? "!border-red-600 !bg-red-50 focus:!border-red-600 focus:!ring-red-600/15" : ""}`} value={query} disabled={readOnly}
          aria-invalid={!!error} aria-describedby={error ? "supplier-location-error" : undefined}
          placeholder="Ex. Waltermart"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} />
        <button type="button" onClick={() => void search()} disabled={readOnly || busy || !query.trim()}
          className="rounded-xl border border-slate-300 px-4 text-sm font-semibold disabled:opacity-50">Search</button>
      </div>
      {error && <p id="supplier-location-error" role="alert" className="text-sm text-red-600">{error}</p>}
      {!readOnly && results.length > 0 && <ul className="max-h-40 overflow-y-auto rounded-xl border border-slate-200">
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
      <p className="text-xs text-slate-500">{readOnly ? "Click Edit to change the supplier location. You can open or copy the journey link below anytime." : "Click the map or drag the pin to fill latitude and longitude."}</p>
      <div ref={container} aria-label="Supplier location map" className="relative z-0 h-72 rounded-xl border border-slate-200" />
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-slate-600">Blue: your location · Orange: supplier</span>
        <button type="button" disabled={!currentPosition} className="rounded-lg border border-slate-300 px-3 py-2 font-semibold disabled:opacity-50"
          onClick={() => {
            if (currentPosition && Date.now() - currentPosition.timestamp <= MAX_LOCATION_AGE_MS) {
              map.current?.setView([currentPosition.coords.latitude, currentPosition.coords.longitude], 17);
            }
          }}>Show my location</button>
        <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 font-semibold"
          onClick={() => { fittedUserLocation.current = false; setLocationRequest((value) => value + 1); }}>Refresh location</button>
      </div>
      <p role="status" className="text-xs text-slate-600">{readOnly ? "" : message}</p>
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
                <p className="mt-1 text-xs leading-5 text-slate-600">Drive from your current location to the selected supplier.</p>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="supplier-journey-link" className="block text-xs font-semibold text-slate-600">Directions link</label>
              <input id="supplier-journey-link" type="url" readOnly value={journeyUrl}
                onFocus={(event) => event.target.select()}
                className="block h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none transition focus:border-[#232d46] focus:ring-2 focus:ring-[#232d46]/15" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => void openJourney()} disabled={openingJourney}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-transparent bg-[#232d46] px-3 py-3 text-center text-sm font-semibold leading-5 text-white !no-underline transition hover:bg-[#1b2438] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#232d46] focus-visible:ring-offset-2 disabled:opacity-50">
                <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span>{openingJourney ? "Locating you..." : "Open Google Maps"}</span>
              </button>
              <button type="button" onClick={() => void copyJourneyLink()} disabled={!currentPosition || openingJourney}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-sm font-semibold leading-5 text-slate-700 transition hover:border-[#232d46] hover:bg-[#f5f5f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#232d46] focus-visible:ring-offset-2 disabled:opacity-50">
                <Copy aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span>Copy journey link</span>
              </button>
            </div>
            {copyStatus.url === journeyUrl && copyStatus.message ? (
              <p role="status" className="text-xs leading-5 text-slate-600">{copyStatus.message}</p>
            ) : null}
          </div>
          <div role="status" className="border-t border-[#232d46]/15 px-4 py-3 text-xs leading-5 text-slate-500 sm:px-5">
            <p>Starting point: your current location. Destination: the selected supplier pin.</p>
            <p>Driving directions use your live location as the starting point.</p>
            {locationStatus && <p>{locationStatus}</p>}
          </div>
        </section>
      ) : <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500">Select a location to generate a Google Maps journey link.</p>}
      <section hidden aria-label="Your live location coordinates" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Your live location</p>
        {currentPosition ? <>
          <dl className="mt-2 grid grid-cols-2 gap-2 tabular-nums">
            <div><dt className="text-xs text-slate-500">Latitude</dt><dd>{currentPosition.coords.latitude.toFixed(6)}</dd></div>
            <div><dt className="text-xs text-slate-500">Longitude</dt><dd>{currentPosition.coords.longitude.toFixed(6)}</dd></div>
          </dl>
          <p className="mt-2 text-xs">Reported accuracy: about {Math.round(currentPosition.coords.accuracy)} m{currentPosition.coords.accuracy > PRECISE_LOCATION_ACCURACY_METERS ? " (approximate location)" : ""}.</p>
          <p className="text-xs">Last updated: {new Date(currentPosition.timestamp).toLocaleTimeString()}.</p>
          {currentPosition.coords.accuracy > PRECISE_LOCATION_ACCURACY_METERS && <p className="mt-1 text-xs">Enable precise location on your device for a more accurate pin.</p>}
        </> : <p className="mt-2 text-xs">Latitude: unavailable · Longitude: unavailable</p>}
        <p role="status" className="mt-2 text-xs">{locationStatus || (currentPosition ? "Updates automatically as your device reports your location." : "Waiting for a fresh location reading...")}</p>
      </section>
    </div>
  );
}
