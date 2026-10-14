import type { AlertRecord } from "./alerts";

type PresentedAlert = Pick<AlertRecord, "type" | "severity" | "title"> & { remainingQuantity?: string | null };

const wholeQuantity = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });

export function formatAlertQuantity(value: string | null | undefined) {
  if (value == null || value.trim() === "") return "N/A";
  const quantity = Number(value);
  return Number.isFinite(quantity) ? wholeQuantity.format(quantity) : "N/A";
}

export function formatAlertMessage(message: string) {
  // Format quantity fields only; preserve batch references, dates and names.
  return message.replace(
    /(Usable quantity is |reorder point of |with )(-?\d+(?:\.\d+)?)(?= remaining\.| with a reorder point|\.$)/g,
    (_, label: string, quantity: string) => label + formatAlertQuantity(quantity),
  );
}

export function isDepletedAlert(alert: PresentedAlert) {
  if (alert.type !== "LOW_STOCK") return false;
  if (alert.remainingQuantity != null && alert.remainingQuantity.trim() !== "") {
    const quantity = Number(alert.remainingQuantity);
    if (Number.isFinite(quantity)) return quantity <= 0;
  }
  return alert.severity === "CRITICAL";
}

export function alertColor(alert: PresentedAlert) {
  if (alert.type === "EXPIRED") return "expired";
  if (alert.type === "NEAR_EXPIRY") return "nearExpiry";
  return isDepletedAlert(alert) ? "depleted" : "lowStock";
}

export function alertTitle(alert: PresentedAlert) {
  if (alert.type !== "LOW_STOCK") return alert.title;
  return alert.title.replace(/ is (?:running low|depleted)$/i, ` is ${isDepletedAlert(alert) ? "depleted" : "running low"}`);
}
