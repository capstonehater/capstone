import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";
import type { Metadata } from "next";
import AuthBootstrap from "@/components/auth/AuthBootstrap";

export const metadata: Metadata = {
  title: "Inventory Management System",
  description: "Smart Inventory Management",
  icons: {
    icon: {
      url: "/assets/slvcn-icon.svg",
      type: "image/svg+xml",
      sizes: "any",
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
        <AuthBootstrap />
        {children}
      </body>
    </html>
  );
}
