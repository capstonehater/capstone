import { Bell, Boxes, FileText, LayoutDashboard, Package2, Settings, Shield, UsersRound, TrendingUp, ShoppingCart, ClipboardList, type LucideIcon } from "lucide-react";
import { canAccessRoute, routeHref, type RouteId } from "@/lib/routing/routes";
import type { RouteAccess } from "@/lib/routing/route-policy";
import { pageMetadata } from "@/lib/routing/page-metadata";
import { legacyRouteHref } from "@/lib/routing/route-aliases";

type NavigationLink = { routeId: RouteId; label: string };
type NavigationDefinition = NavigationLink & { icon: LucideIcon; children?: readonly NavigationLink[] };
export type NavigationItem = NavigationLink & {
  icon: LucideIcon;
  href: string;
  children?: (NavigationLink & { href: string })[];
};

// Presentation only. Authorization belongs to the registry, even for hidden pages.
export const navigationGroups: readonly { label: string; items: readonly NavigationDefinition[] }[] = [
  { label: "Main", items: [
    { routeId: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { routeId: "inventory", label: "Inventory", icon: Boxes },
    { routeId: "products", label: "Products", icon: Package2 },
    { routeId: "suppliers", label: "Suppliers", icon: UsersRound },
  ] },
  { label: "Point of Sale", items: [
    { routeId: "pos", label: "POS", icon: ShoppingCart },
    { routeId: "pos.transactions", label: "Transaction History", icon: ClipboardList },
  ] },
  { label: "Reports", items: [
    { routeId: "reports", label: "Reports", icon: FileText, children: [
      { routeId: "reports.inventory", label: "Inventory Reports" },
      { routeId: "reports.pos", label: "POS Reports" },
    ] },
    { routeId: "forecasting", label: "Forecasting", icon: TrendingUp },
    { routeId: "alerts", label: "Alerts", icon: Bell },
  ] },
  { label: "Management", items: [
    { routeId: "users", label: "User", icon: UsersRound },
    { routeId: "roles", label: "Roles & Permissions", icon: Shield },
    { routeId: "settings", label: "My Account", icon: Settings },
  ] },
];

export const adminNavigation: { label: string; items: NavigationItem[] }[] = navigationGroups.map(group => ({
  label: group.label,
  items: group.items.map(item => ({
    ...item, href: routeHref(item.routeId),
    children: item.children?.map(child => ({ ...child, href: routeHref(child.routeId) })),
  })),
}));

export function canAccessNavigation(item: NavigationLink, access: RouteAccess): boolean {
  return canAccessRoute(item.routeId, access);
}

export function getVisibleNavigation(access: RouteAccess) {
  return adminNavigation.map(group => ({ ...group, items: group.items
    .filter(item => canAccessNavigation(item, access))
    .map(item => ({ ...item, children: item.children?.filter(child => canAccessNavigation(child, access)) }))
  })).filter(group => group.items.length > 0);
}

export const materialActions = (["legacy.inventory.materials.add", "legacy.inventory.materials.createStockRun", "legacy.inventory.materials.recordWaste"] as const)
  .map(routeId => ({ routeId, href: legacyRouteHref(routeId), ...pageMetadata[routeId] }));

// Highlight matching is presentation only, never route admission.
export function matchesShellRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
