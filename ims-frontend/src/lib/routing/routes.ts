import { evaluateRoutePolicy, routePolicies as policy, type RouteAccess, type RoutePolicy } from "./route-policy";

type RouteDefinition = { href: string; policy: RoutePolicy };

// Every protected page is registered explicitly, including compatibility pages.
// IDs describe features; hrefs deliberately retain the current URLs in Phase 1.
export const routes = {
  dashboard: { href: "/admin/dashboard", policy: policy.dashboard },
  inventory: { href: "/admin/inventory", policy: policy.inventory },
  "inventory.materials": { href: "/admin/inventory/materials", policy: policy.inventory },
  "inventory.materials.add": { href: "/admin/inventory/materials/add", policy: policy["inventory.create"] },
  "inventory.materials.createStockRun": { href: "/admin/inventory/materials/create-stock-run", policy: policy["inventory.stockRunCreate"] },
  "inventory.materials.recordWaste": { href: "/admin/inventory/materials/record-waste", policy: policy["inventory.waste"] },
  "inventory.stockRuns": { href: "/admin/inventory/stock-runs", policy: policy.inventory },
  "inventory.lowStock": { href: "/admin/inventory/low-stock", policy: policy.inventory },
  "inventory.nearExpiry": { href: "/admin/inventory/near-expiry", policy: policy.inventory },
  "inventory.wasteInsights": { href: "/admin/inventory/waste-insights", policy: policy.inventory },
  "inventory.highValue": { href: "/admin/inventory/high-value", policy: policy.inventory },
  "inventory.supplierSpend": { href: "/admin/inventory/supplier-spend", policy: policy.inventory },
  suppliers: { href: "/admin/inventory/suppliers", policy: policy.suppliers },
  "suppliers.legacy": { href: "/admin/suppliers", policy: policy.suppliers },
  products: { href: "/admin/products", policy: policy.products },
  reports: { href: "/admin/reports", policy: policy.reports },
  "reports.inventory": { href: "/admin/reports/inventory", policy: policy.reports },
  "reports.pos": { href: "/admin/reports/pos", policy: policy.reports },
  forecasting: { href: "/admin/forecasting", policy: policy.forecasting },
  alerts: { href: "/admin/alerts", policy: policy.alerts },
  users: { href: "/admin/users", policy: policy.users },
  roles: { href: "/admin/roles", policy: policy.legacyAdministrator },
  recommendations: { href: "/admin/recommendations", policy: policy.legacyAdministrator },
  settings: { href: "/admin/settings", policy: policy.authenticated },
  "settings.staff": { href: "/staff/settings", policy: policy.authenticated },
  "settings.manager": { href: "/manager/settings", policy: policy.authenticated },
  pos: { href: "/staff/pos", policy: policy.pos },
  "pos.dashboard": { href: "/staff/dashboard", policy: policy.pos },
  "pos.transactions": { href: "/staff/transactions", policy: policy["pos.transactions"] },
  "no-access": { href: "/no-access", policy: policy.authenticated },
} as const satisfies Record<string, RouteDefinition>;

export type RouteId = keyof typeof routes;
export const routeIds = Object.keys(routes) as RouteId[];

export function routeHref(id: RouteId): string {
  return routes[id].href;
}

// Takes usePathname()'s pathname, not a URL/query. Query actions remain guarded
// inside InventoryWorkspace. No implicit descendant policy inheritance.
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
