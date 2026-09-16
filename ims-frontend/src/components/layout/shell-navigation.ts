import { Bell, Boxes, FileText, LayoutDashboard, Package2, Settings, UsersRound, TrendingUp } from "lucide-react";

export const adminNavigation = [
  { label: "Main", items: [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, subtitle: "Welcome back! Here's your inventory overview." },
    { label: "Inventory", href: "/admin/inventory", icon: Boxes, subtitle: "Monitor stock, receiving, adjustments, and waste.", children: [
      { label: "Products", href: "/admin/products", icon: Package2 },
      { label: "Suppliers", href: "/admin/inventory#suppliers", icon: UsersRound },
    ] },
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
  return pathname === href || pathname.startsWith(`${href}/`);
}
