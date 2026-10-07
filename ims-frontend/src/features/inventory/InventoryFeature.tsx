import InventoryWorkspace, { type InventoryView } from "@/components/admin/inventory/InventoryWorkspace";

export default function InventoryFeature({ searchParams }: { searchParams: { view?: string; draft?: string; action?: string; material?: string; batch?: string } }) {
  const views = ["overview", "materials", "stock-runs", "low-stock", "near-expiry", "waste", "value", "supplier"] as const;
  const view = views.includes(searchParams.view as typeof views[number]) ? searchParams.view as InventoryView : "overview";
  const action = searchParams.action === "create-material" || searchParams.action === "stock-run-create" || searchParams.action === "waste" ? searchParams.action : undefined;
  return <InventoryWorkspace key={`${view}:${searchParams.draft ?? ""}:${action ?? ""}:${searchParams.material ?? ""}:${searchParams.batch ?? ""}`} initialView={view} initialDraftId={searchParams.draft} initialAction={action} initialMaterialId={searchParams.material} initialBatchId={searchParams.batch} />;
}
