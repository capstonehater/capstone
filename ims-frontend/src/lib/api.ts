const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/backend").replace(/\/+$/, "");

// Share only pending browser reads; never retain completed responses or share
// cookie-authenticated requests between server users.
const pendingReads = new Map<string, Promise<Response>>();

function buildApiUrl(endpoint: string): string {
  return `${API_BASE_URL}${endpoint}`;
}

function getErrorMessage(data: unknown): string {
  if (
    typeof data === "object" &&
    data !== null &&
    "message" in data
  ) {
    if (typeof data.message === "string") return data.message;
    if (Array.isArray(data.message)) {
      const messages = data.message.filter((message): message is string => typeof message === "string");
      if (messages.length) return messages.join(" ");
    }
  }

  return "Request failed";
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const { headers, ...rest } = options;
  const requestHeaders = new Headers(headers);

  if (rest.body != null && !requestHeaders.has("Content-Type") && !(rest.body instanceof FormData)) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const url = buildApiUrl(endpoint);
  const requestOptions: RequestInit = {
    ...rest,
    credentials: "include",
    headers: requestHeaders,
  };
  const method = (rest.method ?? "GET").toUpperCase();
  // Dev Tunnels rewrites Origin to localhost. Preserve the browser origin in
  // a custom header so our proxy can validate it before restoring Origin.
  if (typeof window !== "undefined" && window.location &&
      method !== "GET" && method !== "HEAD") {
    requestHeaders.set("X-IMS-Browser-Origin", window.location.origin);
  }
  if (method !== "GET" && method !== "HEAD") pendingReads.clear();

  // Custom cancellation and other request options keep their independent fetch
  // semantics. The common GET path can safely give each caller its own body.
  const shareRead = typeof window !== "undefined" && method === "GET" &&
    Object.keys(rest).every(key => key === "method" || key === "cache");
  if (!shareRead) return fetch(url, requestOptions);

  const key = JSON.stringify([url, [...requestHeaders.entries()], rest.cache ?? null]);
  let pending = pendingReads.get(key);
  if (!pending) {
    pending = fetch(url, requestOptions).finally(() => {
      if (pendingReads.get(key) === pending) pendingReads.delete(key);
    });
    pendingReads.set(key, pending);
  }
  return (await pending).clone();
}

export async function apiJsonFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await apiFetch(endpoint, options);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getErrorMessage(data));
  }

  return data as T;
}
