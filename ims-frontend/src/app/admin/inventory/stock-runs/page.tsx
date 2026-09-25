import InventoryWorkspace from "@/components/admin/inventory/InventoryWorkspace";

export default async function StockRunsPage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const { draft } = await searchParams;
  return <InventoryWorkspace stockRunsOnly initialDraftId={draft} />;
}
