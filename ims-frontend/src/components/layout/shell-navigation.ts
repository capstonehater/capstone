import { Bell, Boxes, FileText, LayoutDashboard, Package2, Settings, UsersRound, TrendingUp } from "lucide-react";

export const adminNavigation = [
  { label: "Main", items: [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, subtitle: "Welcome back! Here's your inventory overview." },
    { label: "Inventory", href: "/admin/inventory", icon: Boxes, subtitle: "Monitor stock, receiving, and waste.", children: [
      { label: "Overview", href: "/admin/inventory#overview" },
      { label: "Materials", href: "/admin/inventory/materials" },
      { label: "Low Stock", href: "/admin/inventory/low-stock" },
      { label: "Near Expiry", href: "/admin/inventory/near-expiry" },
      { label: "Waste Insights", href: "/admin/inventory/waste-insights" },
      { label: "High-Value Inventory", href: "/admin/inventory/high-value" },
      { label: "Supplier Spend", href: "/admin/inventory/supplier-spend" },
    ] },
    { label: "Products", href: "/admin/products", icon: Package2, subtitle: "Manage menu products, variants, and recipes." },
    { label: "Suppliers", href: "/admin/inventory/suppliers", icon: UsersRound, subtitle: "Manage suppliers and store locations." },
  ] },
  { label: "Reports", items: [
    { label: "Reports", href: "/admin/reports", icon: FileText, subtitle: "Review inventory and POS reports." },
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
