export type UserLocation = { latitude: number; longitude: number; accuracy: number; timestamp: number };

export function freshLocation(location: UserLocation | null, now = Date.now()): location is UserLocation {
  return !!location && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90
    && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180
    && Number.isFinite(location.accuracy) && location.accuracy >= 0
    && now >= location.timestamp && now - location.timestamp <= 30000;
}

export function storeDistance(location: UserLocation | null, latitude: unknown, longitude: unknown): number | null {
  if (!freshLocation(location) || latitude == null || longitude == null
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
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext || !navigator.geolocation) {
      reject(new Error("Live location requires HTTPS and device location support."));
      return;
    }
    navigator.geolocation.getCurrentPosition(position => {
      const location = { latitude: position.coords.latitude, longitude: position.coords.longitude,
        accuracy: position.coords.accuracy, timestamp: position.timestamp };
      if (freshLocation(location)) resolve(location);
      else reject(new Error("A fresh location reading is unavailable."));
    }, error => reject(new Error(error.code === 1
      ? "Allow location access to calculate supplier distances."
      : "Your current location is unavailable. Check device location services.")),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
  });
}
