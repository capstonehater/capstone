import InventoryWorkspace, { type InventoryView } from "@/components/admin/inventory/InventoryWorkspace";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ view?: string; draft?: string; action?: string }> }) {
  const params = await searchParams;
  const views = ["overview", "materials", "stock-runs", "low-stock", "near-expiry", "waste", "value", "supplier"];
  const view = views.includes(params.view ?? "") ? params.view as InventoryView : "overview";
  const action = params.action === "create-material" || params.action === "stock-run-create" || params.action === "waste" ? params.action : undefined;
  return <InventoryWorkspace key={`${view}:${params.draft ?? ""}:${action ?? ""}`} initialView={view} initialDraftId={params.draft} initialAction={action} />;
}
