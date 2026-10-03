import { routeHref, type LegacyRouteId, type RouteId } from "./routes";

type RouteAlias = {
  target: RouteId;
  query?: Readonly<Record<string, string>>;
  preserveQuery?: true | readonly string[];
};

// Every supported role-prefixed URL maps explicitly to its canonical feature.
export const routeAliases = {
  "legacy.dashboard.admin": { target: "dashboard", preserveQuery: true },
  "legacy.inventory.admin": { target: "inventory", preserveQuery: true },
  "legacy.inventory.materials": { target: "inventory", query: { view: "materials" }, preserveQuery: ["draft"] },
  "legacy.inventory.materials.add": { target: "inventory", query: { view: "materials", action: "create-material" } },
  "legacy.inventory.materials.createStockRun": { target: "inventory", query: { view: "materials", action: "stock-run-create" } },
  "legacy.inventory.materials.recordWaste": { target: "inventory", query: { view: "materials", action: "waste" } },
  "legacy.inventory.stockRuns": { target: "inventory", query: { view: "stock-runs" }, preserveQuery: ["draft"] },
  "legacy.inventory.lowStock": { target: "inventory", query: { view: "low-stock" } },
  "legacy.inventory.nearExpiry": { target: "inventory", query: { view: "near-expiry" } },
  "legacy.inventory.wasteInsights": { target: "inventory", query: { view: "waste" } },
  "legacy.inventory.highValue": { target: "inventory", query: { view: "value" } },
  "legacy.inventory.supplierSpend": { target: "inventory", query: { view: "supplier" } },
  "legacy.suppliers.inventory": { target: "suppliers", preserveQuery: true },
  "legacy.suppliers": { target: "suppliers", preserveQuery: true },
  "legacy.products": { target: "products", preserveQuery: true },
  "legacy.reports": { target: "reports", preserveQuery: true },
  "legacy.reports.inventory": { target: "reports.inventory", preserveQuery: true },
  "legacy.reports.pos": { target: "reports.pos", preserveQuery: true },
  "legacy.forecasting": { target: "forecasting", preserveQuery: true },
  "legacy.alerts": { target: "alerts", preserveQuery: true },
  "legacy.users": { target: "users", preserveQuery: true },
  "legacy.roles": { target: "roles", preserveQuery: true },
  "legacy.settings.admin": { target: "settings", preserveQuery: true },
  "legacy.settings.staff": { target: "settings", preserveQuery: true },
  "legacy.settings.manager": { target: "settings", preserveQuery: true },
  "legacy.pos": { target: "pos", preserveQuery: true },
  "legacy.dashboard.staff": { target: "pos", preserveQuery: true },
  "legacy.pos.transactions": { target: "pos.transactions", preserveQuery: true },
} as const satisfies Record<LegacyRouteId, RouteAlias>;

export function legacyRouteHref(id: LegacyRouteId, params: Record<string, string | string[] | undefined> = {}): string {
  const alias: RouteAlias = routeAliases[id];
  const query = new URLSearchParams();
  if (alias.preserveQuery === true) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) for (const entry of Array.isArray(value) ? value : [value]) query.append(key, entry);
    }
  } else if (alias.preserveQuery) {
    for (const key of alias.preserveQuery) {
      const value = params[key];
      if (value !== undefined) for (const entry of Array.isArray(value) ? value : [value]) query.append(key, entry);
    }
  }
  for (const [key, value] of Object.entries(alias.query ?? {})) query.set(key, value);
  const suffix = query.toString();
  return routeHref(alias.target) + (suffix ? `?${suffix}` : "");
}
