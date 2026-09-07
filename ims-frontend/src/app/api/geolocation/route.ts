type Place = { place_id?: string; lat?: string; lon?: string; display_name?: string };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim();
  const lat = params.get("lat");
  const lon = params.get("lon");
  const reverse = !query;
  if (reverse && (!lat?.trim() || !lon?.trim() || !Number.isFinite(Number(lat)) ||
      !Number.isFinite(Number(lon)) || Math.abs(Number(lat)) > 90 || Math.abs(Number(lon)) > 180)) {
    return Response.json({ message: "Choose valid coordinates or enter a search location." }, { status: 400 });
  }
  if (query && query.length > 300) {
    return Response.json({ message: "Please use a shorter search." }, { status: 400 });
  }
  const key = process.env.LOCATIONIQ_API_KEY;
  if (!key) {
    return Response.json({ message: "Location search is not configured. You can still pin coordinates on the map." }, { status: 503 });
  }
  const url = new URL("https://us1.locationiq.com/v1/" + (reverse ? "reverse" : "search"));
  url.search = new URLSearchParams({
    key, format: "json",
    ...(reverse ? { lat: lat!, lon: lon! } : { q: query!, limit: "5" }),
  }).toString();
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (response.status === 404) return Response.json({ results: [] });
    if (!response.ok) return Response.json({
      message: response.status === 429 ? "Location lookup is busy. Please try again shortly." : "Location lookup is unavailable. Please try again.",
    }, { status: response.status === 429 ? 429 : 502 });
    const data = await response.json();
    const places: Place[] = Array.isArray(data) ? data : [data];
    const results = places.filter((place) => place.lat && place.lon &&
      Number.isFinite(Number(place.lat)) && Number.isFinite(Number(place.lon)) &&
      Math.abs(Number(place.lat)) <= 90 && Math.abs(Number(place.lon)) <= 180)
      .map((place, index) => ({
        id: String(place.place_id ?? index),
        latitude: Number(place.lat).toFixed(6),
        longitude: Number(place.lon).toFixed(6),
        address: place.display_name ?? "",
      }));
    return Response.json({ results });
  } catch {
    return Response.json({ message: "Location lookup timed out or could not connect. Please try again." }, { status: 502 });
  }
}
