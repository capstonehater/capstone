import type { RouteId } from "./routes";

type RouteAlias = {
  target: RouteId;
  behavior: "shared-page" | "redirect";
  query?: { view: string; action?: string };
  preserveQuery?: readonly string[];
};

// Describes existing compatibility behavior only; does not redirect or rewrite.
// Admission always uses the source registration, including extra action grants.
export const routeAliases = {
  "suppliers.legacy": { target: "suppliers", behavior: "shared-page" },
  "pos.dashboard": { target: "pos", behavior: "shared-page" },
  "settings.staff": { target: "settings", behavior: "shared-page" },
  "settings.manager": { target: "settings", behavior: "shared-page" },
  reports: { target: "reports.inventory", behavior: "shared-page" },
  "inventory.materials": { target: "inventory", behavior: "redirect", query: { view: "materials" } },
  "inventory.materials.add": { target: "inventory", behavior: "redirect", query: { view: "materials", action: "create-material" } },
  "inventory.materials.createStockRun": { target: "inventory", behavior: "redirect", query: { view: "materials", action: "stock-run-create" } },
  "inventory.materials.recordWaste": { target: "inventory", behavior: "redirect", query: { view: "materials", action: "waste" } },
  "inventory.stockRuns": { target: "inventory", behavior: "redirect", query: { view: "stock-runs" }, preserveQuery: ["draft"] },
  "inventory.lowStock": { target: "inventory", behavior: "redirect", query: { view: "low-stock" } },
  "inventory.nearExpiry": { target: "inventory", behavior: "redirect", query: { view: "near-expiry" } },
  "inventory.wasteInsights": { target: "inventory", behavior: "redirect", query: { view: "waste" } },
  "inventory.highValue": { target: "inventory", behavior: "redirect", query: { view: "value" } },
  "inventory.supplierSpend": { target: "inventory", behavior: "redirect", query: { view: "supplier" } },
} as const satisfies Partial<Record<RouteId, RouteAlias>>;
