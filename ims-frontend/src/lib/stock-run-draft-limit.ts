import type { StockRun } from "./inventory";

export function findUnfinishedStockRun(runs: StockRun[]) {
  return runs.filter(run => run.status === "DRAFT")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))[0] ?? null;
}

export function unfinishedStockRunMessage(run: Pick<StockRun, "name" | "reference" | "id">) {
  return `Complete the first draft "${run.name}" (${run.reference || run.id}) before creating another stock run. Post the draft to complete it, or delete it if it is no longer needed.`;
}
