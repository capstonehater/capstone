"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Loader2, MapPin } from "lucide-react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./StoreAvailabilityModal.module.css";

export default function StoreMapPreview({ name, latitude, longitude }: {
  name: string; latitude?: number | string | null; longitude?: number | string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [requested, setRequested] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const preview = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const panelId = useId();
  const lat = Number(latitude), lon = Number(longitude);
  const valid = latitude != null && longitude != null && String(latitude).trim() !== ""
    && String(longitude).trim() !== "" && Number.isFinite(lat) && Math.abs(lat) <= 90
    && Number.isFinite(lon) && Math.abs(lon) <= 180;

  useEffect(() => {
    if (!expanded) return;
    const dismiss = (event: PointerEvent) => {
      if (!preview.current?.contains(event.target as Node)) setExpanded(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setExpanded(false);
        preview.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    preview.current?.addEventListener("keydown", escape);
    const node = preview.current;
    return () => { document.removeEventListener("pointerdown", dismiss); node?.removeEventListener("keydown", escape); };
  }, [expanded]);

  useEffect(() => {
    if (!requested || !valid) return;
    let disposed = false;
    let instance: LeafletMap | undefined;
    let observer: ResizeObserver | undefined;
    setStatus("loading");
    void import("leaflet").then(L => {
      if (disposed || !container.current) return;
      instance = L.map(container.current, { scrollWheelZoom: false }).setView([lat, lon], 16);
      map.current = instance;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(instance);
      L.marker([lat, lon], { icon: L.divIcon({
        className: styles.mapPin,
        html: '<span></span>', iconSize: [28, 36], iconAnchor: [14, 36],
      }) }).addTo(instance).bindTooltip(name, { direction: "top", offset: [0, -30] });
      observer = new ResizeObserver(() => instance?.invalidateSize());
      observer.observe(container.current);
      setStatus("ready");
    }).catch(() => { if (!disposed) setStatus("error"); });
    return () => { disposed = true; observer?.disconnect(); instance?.remove(); map.current = null; };
  }, [requested, valid, lat, lon, name]);

  return <div ref={preview} className={styles.mapPreview}>
    <button type="button" className={styles.mapToggle} disabled={!valid}
      aria-expanded={expanded} aria-controls={panelId}
      title={valid ? `View the registered location of ${name}` : "No registered store coordinates available"}
      onClick={() => { setRequested(true); setExpanded(value => !value); }}>
      <MapPin size={15} aria-hidden="true" />{expanded ? "Hide map" : "View map"}
      <ChevronDown size={15} aria-hidden="true" className={expanded ? styles.mapChevronOpen : undefined} />
    </button>
    <div id={panelId} className={styles.mapDropdown} data-expanded={expanded}
      inert={!expanded} aria-hidden={!expanded}
      onTransitionEnd={event => { if (event.target === event.currentTarget && expanded) map.current?.invalidateSize(); }}>
      <div className={styles.mapClip}>
        {requested && <div className={styles.mapFrame}>
          <div ref={container} className={styles.storeMap} role="region" aria-label={`Map of ${name}'s registered location`} />
          {status !== "ready" && <div className={styles.mapStatus} role="status">
            {status === "loading" ? <><Loader2 size={18} className={styles.stepSpinner} />Loading map…</> : "The map could not load. Close and reopen this store listing to try again."}
          </div>}
          <p className={styles.mapCaption}>Registered store location · {lat.toFixed(6)}, {lon.toFixed(6)}</p>
        </div>}
      </div>
    </div>
  </div>;
}
