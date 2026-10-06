type SupplierDetails = {
  name: string;
  contactInfo: string;
  contactType: "phone" | "email";
  latitude: string;
  longitude: string;
};

export function normalizeSupplierPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("63")) return `+${digits}`;
  if (digits.startsWith("0")) return `+63${digits.slice(1)}`;
  return `+63${digits}`;
}

export function supplierFieldErrors(form: SupplierDetails): { name?: string; contactInfo?: string; location?: string } {
  const errors: { name?: string; contactInfo?: string; location?: string } = {};
  if (!form.name.trim()) errors.name = "Supplier Name is required.";
  else if (form.name.trim().length > 120) errors.name = "Supplier Name must be 120 characters or fewer.";

  const contact = form.contactInfo.trim();
  if (!contact) errors.contactInfo = "Contact Information is required.";
  else if (form.contactType === "email") {
    if (!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(contact)) {
      errors.contactInfo = "Enter a valid email address, such as supplier@example.com.";
    }
  } else {
    if (!/^\+?[\d\s().-]+$/.test(contact) || !/^\+639\d{9}$/.test(normalizeSupplierPhone(contact))) {
      errors.contactInfo = "Enter an 11-digit Philippine mobile number, shown as +63 followed by 10 digits starting with 9.";
    }
  }

  if (!form.latitude.trim() || !form.longitude.trim() ||
      !Number.isFinite(Number(form.latitude)) || !Number.isFinite(Number(form.longitude)) ||
      Math.abs(Number(form.latitude)) > 90 || Math.abs(Number(form.longitude)) > 180) {
    errors.location = "Supplier Location is required. Select a search result or a point on the map.";
  }
  return errors;
}

export function validateSupplierDetails(form: SupplierDetails): string[] {
  return Object.values(supplierFieldErrors(form));
}
