import { redirect } from "next/navigation";
import { legacyRouteHref } from "@/lib/routing/route-aliases";
export default async function LegacyRoutePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(legacyRouteHref("legacy.settings.admin", await searchParams));
}
