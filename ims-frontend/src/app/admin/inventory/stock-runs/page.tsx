import { redirect } from "next/navigation";
export default async function Page({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const { draft } = await searchParams;
  redirect("/admin/inventory?view=stock-runs" + (draft ? "&draft=" + encodeURIComponent(draft) : ""));
}
