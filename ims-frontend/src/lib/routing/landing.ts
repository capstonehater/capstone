import { canAccessRoute, routeHref, type RouteId } from "./routes";
import type { RouteAccess } from "./route-policy";

// Preserve existing priority independently of menu visibility or presentation.
export const landingPriority: readonly RouteId[] = [
  "dashboard", "pos", "inventory", "products", "suppliers", "pos.transactions",
  "reports", "forecasting", "alerts", "users",
];

export function getDefaultLandingRoute(access: RouteAccess): string {
  const id = landingPriority.find(id => canAccessRoute(id, access));
  return routeHref(id ?? "no-access");
}
