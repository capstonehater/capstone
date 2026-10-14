export type UserLocation = { latitude: number; longitude: number; accuracy: number; timestamp: number };

export function freshLocation(location: UserLocation | null, now = Date.now()): location is UserLocation {
  return !!location && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90
    && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180
    && Number.isFinite(location.accuracy) && location.accuracy >= 0
    && now >= location.timestamp && now - location.timestamp <= 30000;
}

export function validLocation(location: UserLocation | null): location is UserLocation {
  return !!location && Number.isFinite(location.timestamp) && location.timestamp <= Date.now()
    && freshLocation(location, location.timestamp);
}

export function preciseLocation(location: UserLocation | null, now = Date.now()): location is UserLocation {
  return freshLocation(location, now) && location.accuracy <= 50;
}

const LOCATION_CACHE_KEY = "ims:user-location:v1";
let cachedLocation: UserLocation | null = null;

export function getCachedLocation(): UserLocation | null {
  if (validLocation(cachedLocation)) return { ...cachedLocation };
  if (typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(LOCATION_CACHE_KEY) || "null");
    if (validLocation(saved)) {
      cachedLocation = saved;
      return { ...saved };
    }
    window.sessionStorage.removeItem(LOCATION_CACHE_KEY);
  } catch { /* Location still works when browser storage is unavailable. */ }
  cachedLocation = null;
  return null;
}

export function cacheLocation(location: UserLocation): void {
  if (!freshLocation(location)) return;
  cachedLocation = { ...location };
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(cachedLocation)); }
  catch { /* Keep the in-memory cache when storage is unavailable. */ }
}

export function clearCachedLocation(): void {
  cachedLocation = null;
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(LOCATION_CACHE_KEY); }
  catch { /* Storage may be disabled. */ }
}

let trackingUsers = 0;
let stopTracking: (() => void) | null = null;

// Start before the availability dialog opens and share one background watcher.
export function trackLocationInBackground(): () => void {
  if (typeof window === "undefined" || !window.isSecureContext || !navigator.geolocation) return () => {};
  trackingUsers++;
  if (!stopTracking) {
    let disposed = false;
    let refreshing = false;
    const receive = (position: GeolocationPosition) => {
      if (disposed) return;
      cacheLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude,
        accuracy: position.coords.accuracy, timestamp: position.timestamp });
    };
    const fail = (error: GeolocationPositionError) => {
      if (!disposed && error.code === 1) clearCachedLocation();
    };
    const options = { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 };
    const watch = navigator.geolocation.watchPosition(receive, fail, options);
    const refresh = () => {
      if (disposed || refreshing || document.visibilityState === "hidden") return;
      refreshing = true;
      navigator.geolocation.getCurrentPosition(
        position => { refreshing = false; receive(position); },
        error => { refreshing = false; fail(error); }, options);
    };
    if (!getCachedLocation()) navigator.geolocation.getCurrentPosition(receive, fail,
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 5000 });
    const timer = window.setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    stopTracking = () => {
      disposed = true;
      navigator.geolocation.clearWatch(watch);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--trackingUsers === 0) { stopTracking?.(); stopTracking = null; }
  };
}

export function storeDistance(location: UserLocation | null, latitude: unknown, longitude: unknown): number | null {
  if (!validLocation(location) || latitude == null || longitude == null
    || String(latitude).trim() === "" || String(longitude).trim() === "") return null;
  const lat = Number(latitude), lon = Number(longitude);
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) return null;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const a = Math.sin(radians(lat - location.latitude) / 2) ** 2
    + Math.cos(radians(location.latitude)) * Math.cos(radians(lat))
    * Math.sin(radians(lon - location.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function readLiveLocation(): Promise<UserLocation> {
  const cached = getCachedLocation();
  if (freshLocation(cached)) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext || !navigator.geolocation) {
      reject(new Error("Live location requires HTTPS and device location support."));
      return;
    }
    navigator.geolocation.getCurrentPosition(position => {
      const location = { latitude: position.coords.latitude, longitude: position.coords.longitude,
        accuracy: position.coords.accuracy, timestamp: position.timestamp };
      if (freshLocation(location)) { cacheLocation(location); resolve(location); }
      else reject(new Error("A fresh location reading is unavailable."));
    }, error => reject(new Error(error.code === 1
      ? "Allow location access to calculate supplier distances."
      : "Your current location is unavailable. Check device location services.")),
    { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 });
  });
}
