import { evaluateRoutePolicy, routePolicies as policy, type RouteAccess, type RoutePolicy } from "./route-policy";

type RouteDefinition = { href: string; policy: RoutePolicy };

// Canonical feature URLs and explicit legacy registrations are both kept so
// admission is decided by route identity, never inferred from a URL prefix.
export const routes = {
  dashboard: { href: "/dashboard", policy: policy.dashboard },
  inventory: { href: "/inventory", policy: policy.inventory },
  products: { href: "/products", policy: policy.products },
  suppliers: { href: "/suppliers", policy: policy.suppliers },
  reports: { href: "/reports", policy: policy.reports },
  "reports.inventory": { href: "/reports/inventory", policy: policy.reports },
  "reports.pos": { href: "/reports/pos", policy: policy.reports },
  forecasting: { href: "/forecasting", policy: policy.forecasting },
  alerts: { href: "/alerts", policy: policy.alerts },
  users: { href: "/users", policy: policy.users },
  roles: { href: "/roles", policy: policy.legacyAdministrator },
  settings: { href: "/settings", policy: policy.authenticated },
  pos: { href: "/pos", policy: policy.pos },
  "pos.transactions": { href: "/pos/transactions", policy: policy["pos.transactions"] },
  recommendations: { href: "/admin/recommendations", policy: policy.legacyAdministrator },
  "no-access": { href: "/no-access", policy: policy.authenticated },

  "legacy.dashboard.admin": { href: "/admin/dashboard", policy: policy.dashboard },
  "legacy.inventory.admin": { href: "/admin/inventory", policy: policy.inventory },
  "legacy.inventory.materials": { href: "/admin/inventory/materials", policy: policy.inventory },
  "legacy.inventory.materials.add": { href: "/admin/inventory/materials/add", policy: policy["inventory.create"] },
  "legacy.inventory.materials.createStockRun": { href: "/admin/inventory/materials/create-stock-run", policy: policy["inventory.stockRunCreate"] },
  "legacy.inventory.materials.recordWaste": { href: "/admin/inventory/materials/record-waste", policy: policy["inventory.waste"] },
  "legacy.inventory.stockRuns": { href: "/admin/inventory/stock-runs", policy: policy.inventory },
  "legacy.inventory.lowStock": { href: "/admin/inventory/low-stock", policy: policy.inventory },
  "legacy.inventory.nearExpiry": { href: "/admin/inventory/near-expiry", policy: policy.inventory },
  "legacy.inventory.wasteInsights": { href: "/admin/inventory/waste-insights", policy: policy.inventory },
  "legacy.inventory.highValue": { href: "/admin/inventory/high-value", policy: policy.inventory },
  "legacy.inventory.supplierSpend": { href: "/admin/inventory/supplier-spend", policy: policy.inventory },
  "legacy.suppliers.inventory": { href: "/admin/inventory/suppliers", policy: policy.suppliers },
  "legacy.suppliers": { href: "/admin/suppliers", policy: policy.suppliers },
  "legacy.products": { href: "/admin/products", policy: policy.products },
  "legacy.reports": { href: "/admin/reports", policy: policy.reports },
  "legacy.reports.inventory": { href: "/admin/reports/inventory", policy: policy.reports },
  "legacy.reports.pos": { href: "/admin/reports/pos", policy: policy.reports },
  "legacy.forecasting": { href: "/admin/forecasting", policy: policy.forecasting },
  "legacy.alerts": { href: "/admin/alerts", policy: policy.alerts },
  "legacy.users": { href: "/admin/users", policy: policy.users },
  "legacy.roles": { href: "/admin/roles", policy: policy.legacyAdministrator },
  "legacy.settings.admin": { href: "/admin/settings", policy: policy.authenticated },
  "legacy.settings.staff": { href: "/staff/settings", policy: policy.authenticated },
  "legacy.settings.manager": { href: "/manager/settings", policy: policy.authenticated },
  "legacy.pos": { href: "/staff/pos", policy: policy.pos },
  "legacy.dashboard.staff": { href: "/staff/dashboard", policy: policy.pos },
  "legacy.pos.transactions": { href: "/staff/transactions", policy: policy["pos.transactions"] },
} as const satisfies Record<string, RouteDefinition>;

export type RouteId = keyof typeof routes;
export type LegacyRouteId = Extract<RouteId, `legacy.${string}`>;
export const routeIds = Object.keys(routes) as RouteId[];

export function routeHref(id: RouteId): string {
  return routes[id].href;
}

export function resolveRouteId(pathname: string): RouteId | undefined {
  const normalized = pathname.replace(/\/$/, "");
  return routeIds.find(id => routes[id].href === normalized);
}

export function canAccessRoute(id: RouteId, access: RouteAccess): boolean {
  return evaluateRoutePolicy(routes[id].policy, access);
}

export function getRouteAccess(pathname: string, access: RouteAccess): boolean {
  const id = resolveRouteId(pathname);
  return id !== undefined && canAccessRoute(id, access);
}
