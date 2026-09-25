import { Bell, Boxes, FileText, LayoutDashboard, Package2, Settings, UsersRound, TrendingUp } from "lucide-react";

export const materialActions = [
  { label: "Add Raw Material", href: "/admin/inventory/materials/add", subtitle: "Create a material and define how its stock is measured." },
  { label: "Create Stock-Run Draft", href: "/admin/inventory/materials/create-stock-run", subtitle: "Prepare a receiving draft for incoming inventory." },
  { label: "Record Waste", href: "/admin/inventory/materials/record-waste", subtitle: "Record material losses against a stock batch." },
];

export const adminNavigation = [
  { label: "Main", items: [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, subtitle: "Welcome back! Here's your inventory overview." },
    { label: "Inventory", href: "/admin/inventory", icon: Boxes, subtitle: "Monitor stock, receiving, and waste.", children: [
      { label: "Materials", href: "/admin/inventory/materials", subtitle: "Manage raw materials, stock levels, and availability." },
      { label: "Stock Runs", href: "/admin/inventory/stock-runs", subtitle: "Review stock runs and continue receiving inventory." },
      { label: "Low Stock", href: "/admin/inventory/low-stock", subtitle: "Review materials that need replenishment." },
      { label: "Near Expiry", href: "/admin/inventory/near-expiry", subtitle: "Review materials and batches approaching their expiry dates." },
      { label: "Waste Insights", href: "/admin/inventory/waste-insights", subtitle: "Review recorded waste by reason, quantity, and cost." },
      { label: "High-Value Inventory", href: "/admin/inventory/high-value", subtitle: "Review active materials with usable stock and inventory value." },
      { label: "Supplier Spend", href: "/admin/inventory/supplier-spend", subtitle: "Review posted stock-run spending by supplier." },
    ] },
    { label: "Products", href: "/admin/products", icon: Package2, subtitle: "Manage menu products, variants, and recipes." },
    { label: "Suppliers", href: "/admin/inventory/suppliers", icon: UsersRound, subtitle: "Manage suppliers and store locations." },
  ] },
  { label: "Reports", items: [
    { label: "Reports", href: "/admin/reports", icon: FileText, subtitle: "Review inventory and POS reports.", children: [
      { label: "Inventory Reports", href: "/admin/reports/inventory", subtitle: "Review inventory levels, stock movements, waste, and supplier spending." },
      { label: "POS Reports", href: "/admin/reports/pos", subtitle: "Review daily sales, transaction history, and point-of-sale performance." },
    ] },
    { label: "Forecasting", href: "/admin/forecasting", icon: TrendingUp, subtitle: "Review demand forecasts and inventory recommendations." },
    { label: "Alerts", href: "/admin/alerts", icon: Bell, subtitle: "Review your operational inventory alerts." },
  ] },
  { label: "Management", items: [
    { label: "User", href: "/admin/users", icon: UsersRound, subtitle: "Manage user accounts and access." },
    { label: "Settings", href: "/admin/settings", icon: Settings, subtitle: "Manage your account and security settings." },
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
adminPageInfo["/manager/settings"] = { label: "Account Settings", subtitle: "Manage your account and security settings." };

export const staffPageInfo: Record<string, ShellPageInfo> = {
  "/staff/dashboard": { label: "Staff Dashboard", subtitle: "Welcome back! Here's your POS and daily transaction overview." },
  "/staff/pos": { label: "Staff POS", subtitle: "Create orders, accept payments, and manage daily sales." },
  "/staff/transactions": { label: "Transaction History", subtitle: "Review your transactions and receipts." },
  "/staff/settings": { label: "Account Settings", subtitle: "Manage your account and security settings." },
};

export function getAdminPageInfo(pathname: string): ShellPageInfo | undefined {
  return adminPageInfo[pathname];
}
