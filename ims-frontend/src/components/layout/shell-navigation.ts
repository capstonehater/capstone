// Compatibility facade for existing shell consumers. No route policy lives here.
export { adminNavigation, materialActions, canAccessNavigation, getVisibleNavigation, matchesShellRoute } from "./navigation";
export type { NavigationItem } from "./navigation";
export type { RouteAccess as NavigationAccess } from "@/lib/routing/route-policy";
export { getAdminPageInfo, staffPageInfo } from "@/lib/routing/page-metadata";
export type { ShellPageInfo } from "@/lib/routing/page-metadata";
export { getRouteAccess } from "@/lib/routing/routes";
export { getDefaultLandingRoute } from "@/lib/routing/landing";
