"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { legacyRouteHref } from "@/lib/routing/route-aliases";
export default function LegacyRoutePage() {
  const router = useRouter();
  useEffect(() => { router.replace(legacyRouteHref("legacy.inventory.materials.add")); }, [router]);
  return null;
}
