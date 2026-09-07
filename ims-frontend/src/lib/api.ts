const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function buildApiUrl(endpoint: string): string {
  return `${API_BASE_URL}${endpoint}`;
}

function getErrorMessage(data: unknown): string {
  if (
    typeof data === "object" &&
    data !== null &&
    "message" in data &&
    typeof data.message === "string"
  ) {
    return data.message;
  }

  return "Request failed";
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const { headers, ...rest } = options;
  const requestHeaders = new Headers(headers);

  if (!requestHeaders.has("Content-Type") && !(rest.body instanceof FormData)) {
    requestHeaders.set("Content-Type", "application/json");
  }

  return fetch(buildApiUrl(endpoint), {
    ...rest,
    credentials: "include",
    headers: requestHeaders,
  });
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
