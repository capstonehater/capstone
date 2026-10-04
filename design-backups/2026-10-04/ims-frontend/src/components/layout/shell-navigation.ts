import { Bell, Boxes, FileText, LayoutDashboard, Package2, Settings, Shield, UsersRound, TrendingUp, ShoppingCart, ClipboardList, type LucideIcon } from "lucide-react";

export type NavigationItem = {
  label: string; href: string; subtitle: string; icon: LucideIcon;
  permission?: string; authenticatedOnly?: boolean; administratorOnly?: boolean;
  children?: Omit<NavigationItem, "icon">[];
};
export type NavigationAccess = { can: (permission: string) => boolean; isAuthenticated: boolean; user: { role: string } | null };

// TODO: use a catalog permission for role management once the backend supports it.
// Settings is authenticated self-service, not global settings administration.
export function canAccessNavigation(item: Pick<NavigationItem, "permission" | "authenticatedOnly" | "administratorOnly">, access: NavigationAccess) {
  if (!access.isAuthenticated || !access.user) return false;
  if (item.administratorOnly) return access.user.role === "ADMINISTRATOR";
  return item.authenticatedOnly === true || (!!item.permission && access.can(item.permission));
}
export function getVisibleNavigation(access: NavigationAccess) {
  return adminNavigation.map(group => ({ ...group, items: group.items
    .filter(item => canAccessNavigation(item, access))
    .map(item => ({...item, children: item.children?.filter(child => canAccessNavigation(child, access))}))
  })).filter(group => group.items.length > 0);
}

export const materialActions = [
  { label: "Add Raw Material", href: "/admin/inventory/materials/add", permission: "inventory.create", subtitle: "Create a material and define how its stock is measured." },
  { label: "Create Stock-Run Draft", href: "/admin/inventory/materials/create-stock-run", permission: "stockRuns.create", subtitle: "Prepare a receiving draft for incoming inventory." },
  { label: "Record Waste", href: "/admin/inventory/materials/record-waste", permission: "inventory.waste", subtitle: "Record material losses against a stock batch." },
];

export const adminNavigation: { label: string; items: NavigationItem[] }[] = [
  { label: "Main", items: [
    { label: "Dashboard", href: "/admin/dashboard", permission: "dashboard.view", icon: LayoutDashboard, subtitle: "Welcome back! Here's your inventory overview." },
    { label: "Inventory", href: "/admin/inventory", permission: "inventory.view", icon: Boxes, subtitle: "Manage materials, receiving, stock risks, and purchasing in one workspace." },
    { label: "Products", href: "/admin/products", permission: "products.view", icon: Package2, subtitle: "Manage menu products, variants, and recipes." },
    { label: "Suppliers", href: "/admin/inventory/suppliers", permission: "suppliers.view", icon: UsersRound, subtitle: "Manage suppliers and store locations." },
  ] },
  { label: "Point of Sale", items: [
    { label: "POS", href: "/staff/pos", permission: "pos.view", icon: ShoppingCart, subtitle: "Create orders and accept payments." },
    { label: "Transaction History", href: "/staff/transactions", permission: "pos.orders.view", icon: ClipboardList, subtitle: "Review transactions and receipts." },
  ] },
  { label: "Reports", items: [
    { label: "Reports", href: "/admin/reports", permission: "reports.view", icon: FileText, subtitle: "Review inventory and POS reports.", children: [
      { label: "Inventory Reports", href: "/admin/reports/inventory", permission: "reports.view", subtitle: "Review inventory levels, stock movements, waste, and supplier spending." },
      { label: "POS Reports", href: "/admin/reports/pos", permission: "reports.view", subtitle: "Review daily sales, transaction history, and point-of-sale performance." },
    ] },
    { label: "Forecasting", href: "/admin/forecasting", permission: "forecasting.view", icon: TrendingUp, subtitle: "Review demand forecasts and inventory recommendations." },
    { label: "Alerts", href: "/admin/alerts", permission: "alerts.view", icon: Bell, subtitle: "Review your operational inventory alerts." },
  ] },
  { label: "Management", items: [
    { label: "User", href: "/admin/users", permission: "users.view", icon: UsersRound, subtitle: "Manage user accounts and access." },
    { label: "Roles & Permissions", href: "/admin/roles", administratorOnly: true, icon: Shield, subtitle: "Manage user roles and control feature access." },
    { label: "My Account", href: "/admin/settings", authenticatedOnly: true, icon: Settings, subtitle: "Manage your account and security settings." },
  ] },
];

export function matchesShellRoute(pathname: string, href: string) {
  if (href === "/admin/inventory" && pathname.startsWith("/admin/inventory/suppliers")) {
    return false;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type ShellPageInfo = { label: string; subtitle: string };

const adminPageInfo: Record<string, ShellPageInfo> = Object.fromEntries(
  adminNavigation.flatMap(group => group.items).flatMap(item => [item, ...(item.children ?? [])]).map(item => [item.href, { label: item.label, subtitle: item.subtitle }]),
);
materialActions.forEach(item => { adminPageInfo[item.href] = item; });
adminPageInfo["/admin/suppliers"] = adminPageInfo["/admin/inventory/suppliers"];
adminPageInfo["/admin/recommendations"] = { label: "Recommendations", subtitle: "Review recommendations for your inventory and purchasing decisions." };
adminPageInfo["/manager/settings"] = { label: "My Account", subtitle: "Manage your account and security settings." };

export const staffPageInfo: Record<string, ShellPageInfo> = {
  "/staff/dashboard": { label: "Staff Dashboard", subtitle: "Welcome back! Here's your POS and daily transaction overview." },
  "/staff/pos": { label: "Staff POS", subtitle: "Create orders, accept payments, and manage daily sales." },
  "/staff/transactions": { label: "Transaction History", subtitle: "Review your transactions and receipts." },
  "/staff/settings": { label: "My Account", subtitle: "Manage your account and security settings." },
};

export function getAdminPageInfo(pathname: string): ShellPageInfo | undefined {
  return adminPageInfo[pathname];
}

// Routes share their access policy with navigation; longest path wins for nested pages.
export function getRouteAccess(pathname: string, access: NavigationAccess) {
  const normalized = pathname.replace(/\/$/, "");
  const aliases: Record<string, string> = {
    "/staff/dashboard": "/staff/pos", "/staff/settings": "/admin/settings",
    "/manager/settings": "/admin/settings", "/admin/suppliers": "/admin/inventory/suppliers",
  };
  const path = aliases[normalized] ?? normalized;
  if (path === "/admin/recommendations") return access.isAuthenticated && access.user?.role === "ADMINISTRATOR";
  const items = adminNavigation.flatMap(group => group.items).flatMap(item => [item, ...(item.children ?? [])]);
  const item = items.filter(item => path === item.href || path.startsWith(`${item.href}/`)).sort((a,b) => b.href.length-a.href.length)[0];
  if (!item || !canAccessNavigation(item, access)) return false;
  const action = materialActions.find(action => action.href === path);
  return !action || access.can(action.permission);
}

export function getDefaultLandingRoute(access: NavigationAccess): string {
  // Preserve the operational POS entry for cashiers/staff who also have inventory grants.
  const items = adminNavigation.flatMap(group => group.items);
  const ordered = [items.find(item => item.href === "/admin/dashboard")!, items.find(item => item.href === "/staff/pos")!, ...items];
  return ordered.find(item => !item.authenticatedOnly && !item.administratorOnly && canAccessNavigation(item, access))?.href ?? "/no-access";
}
