export function formatPeso(value: number | string) {
  const amount = typeof value === "number" ? value : Number(value || 0);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

export function decimalToNumber(value: number | string | null | undefined) {
  return Number(value ?? 0) || 0;
}

export function calculateIncludedVat(totalAmount: number) {
  if (totalAmount <= 0) {
    return 0;
  }

  return totalAmount - totalAmount / 1.12;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "N/A";

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatName(person: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) {
  const firstName = person.firstName?.trim();
  const lastName = person.lastName?.trim();

  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(" ");
  }

  return person.email ?? "Unknown user";
}
