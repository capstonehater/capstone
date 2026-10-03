type Place = { place_id?: string; lat?: string; lon?: string; display_name?: string };

export const dynamic = "force-dynamic";

async function validateSession(request: Request): Promise<401 | 503 | null> {
  // Match the backend's configurable cookie name, forwarding no other headers.
  const name = process.env.SESSION_COOKIE_NAME?.trim() || "ims_session";
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) return 503;
  const cookies = (request.headers.get("cookie") ?? "").split(";")
    .map((part) => part.trim()).filter((part) => part.split("=", 1)[0] === name);
  if (cookies.length !== 1) return 401;
  let token: string;
  try {
    token = decodeURIComponent(cookies[0].slice(name.length + 1));
    if (!token || /[\x00-\x20\x7f]/.test(token)) return 401;
  } catch { return 401; }

  try {
    // Trusted deployment configuration only; never derive the destination from the request.
    const base = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
    if (!base) return 503;
    const url = new URL(`${base.replace(/\/+$/, "")}/auth/me`);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) return 503;
    const response = await fetch(url, {
      method: "GET",
      headers: { Cookie: `${name}=${encodeURIComponent(token)}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 401 || response.status === 403) return 401;
    if (response.status !== 200) return 503;
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("user" in data) ||
        !data.user || typeof data.user !== "object" || !("id" in data.user) ||
        typeof data.user.id !== "string" || !data.user.id.trim()) return 503;
    return null;
  } catch { return 503; }
}

export async function GET(request: Request) {
  const denied = await validateSession(request);
  const response = denied
    ? Response.json({ message: denied === 401 ? "Authentication required." : "Session validation is unavailable." }, { status: denied })
    : await lookup(request);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

async function lookup(request: Request) {
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
