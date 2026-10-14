import "./globals.css";
import type { Metadata } from "next";
import AuthBootstrap from "@/components/auth/AuthBootstrap";
import PageScrollReset from "@/components/layout/PageScrollReset";
import AlertNotifications from "@/components/layout/AlertNotifications";

export const metadata: Metadata = {
  title: "Inventory Management System",
  description: "Smart Inventory Management",
  icons: {
    icon: {
      url: "/assets/slvcn-icon-64.png",
      type: "image/png",
      sizes: "64x64",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PageScrollReset />
        <AuthBootstrap />
        {children}
        <AlertNotifications />
      </body>
    </html>
  );
}
