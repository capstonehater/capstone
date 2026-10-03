import InventoryFeature from "@/features/inventory/InventoryFeature";
export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ view?: string; draft?: string; action?: string }> }) {
  return <InventoryFeature searchParams={await searchParams} />;
}
