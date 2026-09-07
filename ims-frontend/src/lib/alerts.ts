import { apiJsonFetch } from "./api";
import type { DecimalString } from "./pos";

export type AlertType = "NEAR_EXPIRY" | "EXPIRED" | "LOW_STOCK";
export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";
export type AlertState = "ACTIVE" | "ACKNOWLEDGED" | "DISMISSED" | "RESOLVED";

export type AlertRecord = {
  id: string;
  dedupeKey: string;
  type: AlertType;
  severity: AlertSeverity;
  state: AlertState;
  title: string;
  message: string;
  rawMaterialId: string | null;
  stockBatchId: string | null;
  supplierId: string | null;
  expiryDate: string | null;
  remainingQuantity: DecimalString | null;
  metadata: Record<string, unknown> | null;
  firstTriggeredAt: string;
  lastTriggeredAt: string;
  acknowledgedAt: string | null;
  dismissedAt: string | null;
  resolvedAt: string | null;
  rawMaterial: {
    id: string;
    name: string;
    sku: string;
  } | null;
  stockBatch: {
    id: string;
    expirationDate: string | null;
    remainingQuantity: DecimalString;
    costPerUnit: DecimalString;
  } | null;
  supplier: {
    id: string;
    name: string;
  } | null;
  acknowledgedByUser?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
  dismissedByUser?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
};

function toQueryString(params: Record<string, string | undefined | null>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function fetchAlerts(params: {
  type?: AlertType;
  state?: AlertState;
  severity?: AlertSeverity;
  rawMaterialId?: string;
  stockBatchId?: string;
  search?: string;
  limit?: number;
} = {}) {
  const query = toQueryString({
    type: params.type,
    state: params.state,
    severity: params.severity,
    rawMaterialId: params.rawMaterialId,
    stockBatchId: params.stockBatchId,
    search: params.search,
    limit: params.limit ? String(params.limit) : undefined,
  });
  const response = await apiJsonFetch<{ alerts: AlertRecord[] }>(`/alerts${query}`);
  return response.alerts;
}

export async function fetchUnreadAlertCount() {
  return apiJsonFetch<{ count: number }>("/alerts/unread-count");
}

export async function acknowledgeAlert(alertId: string, note?: string) {
  const response = await apiJsonFetch<{ alert: AlertRecord }>(
    `/alerts/${alertId}/acknowledge`,
    {
      method: "POST",
      body: JSON.stringify(note ? { note } : {}),
    }
  );
  return response.alert;
}

export async function dismissAlert(alertId: string, note?: string) {
  const response = await apiJsonFetch<{ alert: AlertRecord }>(
    `/alerts/${alertId}/dismiss`,
    {
      method: "POST",
      body: JSON.stringify(note ? { note } : {}),
    }
  );
  return response.alert;
}
