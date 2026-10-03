// Type-only: the backend catalog remains the source of supported permission keys.
import type { PermissionKey } from "../../../../ims-backend/src/auth/rbac/permission-catalog";

export type RoutePolicy =
  | { type: "permission"; permissions: readonly [PermissionKey, ...PermissionKey[]] }
  | { type: "authenticated" }
  | { type: "legacy-administrator" };

export type RouteAccess = {
  can: (permission: string) => boolean;
  isAuthenticated: boolean;
  user: { role: string } | null;
};

const permission = (...permissions: [PermissionKey, ...PermissionKey[]]): RoutePolicy => ({ type: "permission", permissions });

// Page admission only. Feature actions/data and the backend keep their own checks.
export const routePolicies = {
  dashboard: permission("dashboard.view"),
  inventory: permission("inventory.view"),
  "inventory.create": permission("inventory.view", "inventory.create"),
  "inventory.stockRunCreate": permission("inventory.view", "stockRuns.create"),
  "inventory.waste": permission("inventory.view", "inventory.waste"),
  suppliers: permission("suppliers.view"),
  products: permission("products.view"),
  reports: permission("reports.view"),
  forecasting: permission("forecasting.view"),
  alerts: permission("alerts.view"),
  users: permission("users.view"),
  pos: permission("pos.view"),
  "pos.transactions": permission("pos.orders.view"),
  authenticated: { type: "authenticated" },
  // No replacement catalog permissions exist for these exceptions yet.
  legacyAdministrator: { type: "legacy-administrator" },
} as const satisfies Record<string, RoutePolicy>;

export function evaluateRoutePolicy(policy: RoutePolicy, access: RouteAccess): boolean {
  if (!access.isAuthenticated || !access.user) return false;
  switch (policy.type) {
    case "authenticated": return true;
    case "legacy-administrator": return access.user.role === "ADMINISTRATOR";
    case "permission": return policy.permissions.every(key => access.can(key));
  }
}
