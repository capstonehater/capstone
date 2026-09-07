import type { PosCheckoutPayload, PosMenuResponse } from "./pos";

const MENU_CACHE_KEY = "ims-pos-menu-cache";
const CHECKOUT_QUEUE_KEY = "ims-pos-checkout-queue";

export type OfflineCheckoutStatus = "PENDING" | "SYNCING" | "FAILED";

export type OfflineCheckoutEntry = {
  operationId: string;
  idempotencyKey: string;
  createdAt: string;
  status: OfflineCheckoutStatus;
  error?: string | null;
  payload: PosCheckoutPayload;
  preview: {
    totalAmount: number;
    cartCount: number;
    notes?: string;
  };
};

type CachedMenuSnapshot = {
  cachedAt: string;
  menu: PosMenuResponse;
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function createOfflineOperationId(prefix = "checkout") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function cacheMenuSnapshot(menu: PosMenuResponse) {
  writeJson<CachedMenuSnapshot>(MENU_CACHE_KEY, {
    cachedAt: new Date().toISOString(),
    menu,
  });
}

export function getCachedMenuSnapshot() {
  return readJson<CachedMenuSnapshot | null>(MENU_CACHE_KEY, null);
}

export function loadQueuedCheckouts() {
  return readJson<OfflineCheckoutEntry[]>(CHECKOUT_QUEUE_KEY, []);
}

export function saveQueuedCheckouts(entries: OfflineCheckoutEntry[]) {
  writeJson(CHECKOUT_QUEUE_KEY, entries);
}

export function enqueueQueuedCheckout(entry: OfflineCheckoutEntry) {
  const current = loadQueuedCheckouts();
  saveQueuedCheckouts([...current, entry]);
}

export function updateQueuedCheckout(
  operationId: string,
  updater: (entry: OfflineCheckoutEntry) => OfflineCheckoutEntry
) {
  const nextEntries = loadQueuedCheckouts().map((entry) =>
    entry.operationId === operationId ? updater(entry) : entry
  );
  saveQueuedCheckouts(nextEntries);
}

export function removeQueuedCheckout(operationId: string) {
  const nextEntries = loadQueuedCheckouts().filter(
    (entry) => entry.operationId !== operationId
  );
  saveQueuedCheckouts(nextEntries);
}
