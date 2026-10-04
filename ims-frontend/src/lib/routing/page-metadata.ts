import { routeHref, type RouteId } from "./routes";

export type ShellPageInfo = { label: string; subtitle: string };

export const pageMetadata = {
  dashboard: { label: "Dashboard", subtitle: "Welcome back! Here's your inventory overview." },
  inventory: { label: "Inventory", subtitle: "Manage materials, receiving, stock risks, and purchasing in one workspace." },
  products: { label: "Products", subtitle: "Manage menu products, variants, and recipes." },
  suppliers: { label: "Suppliers", subtitle: "Manage suppliers and store locations." },
  pos: { label: "POS", subtitle: "Create orders and accept payments." },
  "pos.transactions": { label: "Transaction History", subtitle: "Review transactions and receipts." },
  reports: { label: "Reports", subtitle: "Review inventory and POS reports." },
  "reports.inventory": { label: "Inventory Reports", subtitle: "Review inventory levels, stock movements, waste, and supplier spending." },
  "reports.pos": { label: "POS Reports", subtitle: "Review daily sales, transaction history, and point-of-sale performance." },
  forecasting: { label: "Forecasting", subtitle: "Review demand forecasts and inventory recommendations." },
  alerts: { label: "Alerts", subtitle: "Review your operational inventory alerts." },
  users: { label: "User", subtitle: "Manage user accounts and access." },
  roles: { label: "Roles & Permissions", subtitle: "Manage user roles and control feature access." },
  settings: { label: "My Account", subtitle: "Manage your account and security settings." },
  recommendations: { label: "Recommendations", subtitle: "Review recommendations for your inventory and purchasing decisions." },
  "legacy.inventory.materials.add": { label: "Add Raw Material", subtitle: "Create a material and define how its stock is measured." },
  "legacy.inventory.materials.createStockRun": { label: "Create Stock-Run Draft", subtitle: "Prepare a receiving draft for incoming inventory." },
  "legacy.inventory.materials.recordWaste": { label: "Record Waste", subtitle: "Record material losses against a stock batch." },
} as const satisfies Partial<Record<RouteId, ShellPageInfo>>;

const adminPageInfo: Record<string, ShellPageInfo> = Object.fromEntries(
  Object.entries(pageMetadata)
    .filter(([id]) => !id.startsWith("legacy."))
    .map(([id, info]) => [routeHref(id as RouteId), info]),
);
export const managerSettingsMetadata = { label: "My Account", subtitle: "Manage your account and security settings." };

// Context-specific titles retained exactly; no policy is attached to titles.
export const staffPageInfo: Record<string, ShellPageInfo> = {
  [routeHref("pos")]: { label: "Staff POS", subtitle: "Create orders, accept payments, and manage daily sales." },
  [routeHref("pos.transactions")]: { label: "Transaction History", subtitle: "Review your transactions and receipts." },
  [routeHref("settings")]: { label: "My Account", subtitle: "Manage your account and security settings." },
};

export function getAdminPageInfo(pathname: string): ShellPageInfo | undefined {
  return adminPageInfo[pathname];
}
