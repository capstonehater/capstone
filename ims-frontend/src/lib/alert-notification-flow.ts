import type { AlertNotification } from "./alerts";

export type AlertNotice = { key: string; kind: "summary" | "product" | "pending"; alert?: AlertNotification; count?: number };
type SeenAlert = Pick<AlertNotification, "id" | "firstTriggeredAt" | "severity">;
const memorySeen = new Map<string, Record<string, string>>();
const REMINDER_INTERVAL = 15 * 60 * 1000;

export function suppressAlertNotifications(pathname: string) {
  return pathname === "/alerts" || pathname === "/admin/alerts"
    || pathname === "/pos" || pathname.startsWith("/pos/")
    || pathname === "/staff/pos" || pathname.startsWith("/staff/pos/");
}

export function alertSignature(alert: SeenAlert) {
  // Scheduled reevaluation updates lastTriggeredAt even without a new event.
  return `${alert.firstTriggeredAt}:${alert.severity}`;
}

function readSeen(userId: string): Record<string, string> {
  try {
    const saved = JSON.parse(localStorage.getItem(`alerts-viewed:${userId}`) || "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      return { ...saved, ...memorySeen.get(userId) };
    }
  } catch { /* Keep per-user tracking in memory if browser storage is unavailable. */ }
  return memorySeen.get(userId) ?? {};
}

export function unseenAlerts<T extends SeenAlert>(userId: string, alerts: T[]): T[] {
  const seen = readSeen(userId);
  return alerts.filter(alert => seen[alert.id] !== alertSignature(alert));
}

export function markAlertsSeen(userId: string, alerts: SeenAlert[]) {
  const seen = { ...readSeen(userId) };
  for (const alert of alerts) seen[alert.id] = alertSignature(alert);
  memorySeen.set(userId, seen);
  try { localStorage.setItem(`alerts-viewed:${userId}`, JSON.stringify(seen)); } catch { /* In-memory tracking remains available. */ }
}

/** Read-only notification flow. Displaying/dismissing a toast does not mark an alert seen. */
export function createAlertNotificationFlow(userId: string, startedAt: number) {
  let queue: AlertNotice[] = [];
  let initial = true;
  let lastNotice = startedAt;
  let pendingCount = 0;
  const notified = new Map<string, string>();

  function pending(now: number): AlertNotice {
    lastNotice = now;
    return { key: `pending:${now}`, kind: "pending", count: pendingCount };
  }

  return {
    ingest(snapshot: { alerts: AlertNotification[]; pendingCount: number }, suppressed: boolean, now: number) {
      pendingCount = snapshot.pendingCount;
      const unseen = unseenAlerts(userId, snapshot.alerts);
      const active = new Map(unseen.map(alert => [alert.id, alertSignature(alert)]));
      const fresh = unseen.filter(alert => notified.get(alert.id) !== alertSignature(alert));
      for (const alert of unseen) notified.set(alert.id, alertSignature(alert));
      if (suppressed) {
        queue = [];
        initial = false;
        lastNotice = now;
        return queue;
      }
      queue = queue.filter(notice => notice.kind === "product"
        ? notice.alert && active.get(notice.alert.id) === alertSignature(notice.alert)
        : notice.kind === "summary" ? unseen.length > 0 : pendingCount > 0);
      queue = queue.map(notice => {
        const count = notice.kind === "summary" ? unseen.length : pendingCount;
        return notice.kind === "product" || notice.count === count ? notice : { ...notice, count };
      });
      if (initial && unseen.length) queue.unshift({ key: `summary:${now}`, kind: "summary", count: unseen.length });
      initial = false;
      if (fresh.length) {
        queue = queue.filter(notice => notice.kind !== "pending");
        queue.push(...fresh.map(alert => ({ key: `${alert.id}:${alertSignature(alert)}`, kind: "product" as const, alert })));
        lastNotice = now;
      } else if (!queue.length && pendingCount > 0 && now - lastNotice >= REMINDER_INTERVAL) {
        queue = [pending(now)];
      }
      return queue;
    },
    advance(key: string, now: number) {
      const dismissed = queue.find(notice => notice.key === key);
      queue = queue.filter(notice => notice.key !== key);
      if (dismissed?.kind === "product" && !queue.length && pendingCount > 0) queue = [pending(now)];
      return queue;
    },
    clear(now: number) {
      queue = [];
      lastNotice = now;
      return queue;
    },
  };
}
