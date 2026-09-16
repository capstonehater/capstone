import { apiFetch, apiJsonFetch } from "./api";

export type DecimalString = string;

export type InventoryUnit = {
  id: string;
  code: string;
  name: string;
  dimension: "MASS" | "VOLUME" | "COUNT" | "PACKAGE";
  conversionFactor: DecimalString;
};

export type Supplier = {
  id: string;
  name: string;
  latitude: DecimalString | null;
  longitude: DecimalString | null;
  address: string | null;
  contactInfo: string | null;
};

export type RawMaterial = {
  id: string;
  name: string;
  sku: string;
  reorderPoint: DecimalString;
  isActive: boolean;
  unitId: string;
  unit: InventoryUnit;
  summary: {
    rawMaterialId: string;
    onHandQuantity: DecimalString;
    usableQuantity: DecimalString;
    nearestExpiryDate: string | null;
    activeBatchCount: number;
    updatedAt: string;
  } | null;
};

export type InventorySummaryItem = {
  rawMaterialId: string;
  name: string;
  sku: string;
  reorderPoint: DecimalString;
  isActive: boolean;
  unit: InventoryUnit;
  summary: {
    onHandQuantity: DecimalString;
    usableQuantity: DecimalString;
    nearestExpiryDate: string | null;
    activeBatchCount: number;
    updatedAt: string;
  };
  inventoryValue: DecimalString;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "INACTIVE";
};

export type StockBatch = {
  id: string;
  rawMaterialId: string;
  supplierId: string | null;
  stockRunItemId: string | null;
  initialQuantity: DecimalString;
  remainingQuantity: DecimalString;
  costPerUnit: DecimalString;
  expirationDate: string | null;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
  supplier: Supplier | null;
  stockRunItem: {
    id: string;
    stockRun: {
      id: string;
      name: string;
      status: string;
      postedAt: string | null;
    };
  } | null;
};

export type InventoryTransaction = {
  id: string;
  type:
    | "STOCK_RUN"
    | "CHECKOUT"
    | "ADJUSTMENT"
    | "WASTE"
    | "VOID"
    | "REFUND"
    | "SYSTEM_IMPORT";
  sourceType:
    | "STOCK_RUN"
    | "ORDER"
    | "ORDER_VOID"
    | "ORDER_REFUND"
    | "WASTE"
    | "INVENTORY_ADJUSTMENT"
    | "SYSTEM_IMPORT";
  sourceId: string | null;
  actorUserId: string | null;
  reasonCode: string | null;
  metadata: Record<string, unknown> | null;
  note: string | null;
  occurredAt: string;
  actorUser: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  } | null;
  lines: Array<{
    id: string;
    rawMaterialId: string;
    stockBatchId: string;
    quantityDelta: DecimalString;
    unitCostSnapshot: DecimalString;
    totalCostDelta: DecimalString;
    rawMaterial: {
      id: string;
      name: string;
      sku: string;
    };
    stockBatch: {
      id: string;
      expirationDate: string | null;
      receivedAt: string;
    };
    productVariant: {
      id: string;
      name: string;
      sku: string;
    } | null;
  }>;
};

export type StockRun = {
  id: string;
  name: string;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  totalCost: DecimalString;
  notes: string | null;
  postedAt: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  items: Array<{
    id: string;
    rawMaterialId: string;
    supplierId: string | null;
    quantity: DecimalString;
    costPerUnit: DecimalString;
    expirationDate: string | null;
    receivedAt: string | null;
    note: string | null;
    rawMaterial?: {
      id: string;
      name: string;
      sku: string;
      unit: InventoryUnit;
    };
    supplier?: Supplier | null;
    stockBatch?: {
      id: string;
      remainingQuantity: DecimalString;
    } | null;
  }>;
};

function toQueryString(params: Record<string, string | undefined | null>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function fetchInventorySummary(params: {
  search?: string;
  status?: string;
  supplierId?: string;
  includeArchived?: boolean;
}) {
  const query = toQueryString({
    search: params.search,
    status: params.status,
    supplierId: params.supplierId,
    includeArchived:
      params.includeArchived !== undefined ? String(params.includeArchived) : undefined,
  });

  const response = await apiJsonFetch<{ summaries: InventorySummaryItem[] }>(
    `/inventory/summary${query}`
  );

  return response.summaries;
}

export async function fetchUnits() {
  const response = await apiJsonFetch<{ units: InventoryUnit[] }>("/units");
  return response.units;
}

export async function fetchSuppliers() {
  const response = await apiJsonFetch<{ suppliers: Supplier[] }>("/suppliers");
  return response.suppliers;
}

export async function fetchRawMaterial(rawMaterialId: string) {
  const response = await apiJsonFetch<{ rawMaterial: RawMaterial }>(
    `/raw-materials/${rawMaterialId}`
  );

  return response.rawMaterial;
}

export async function fetchRawMaterialBatches(rawMaterialId: string) {
  const response = await apiJsonFetch<{ batches: StockBatch[] }>(
    `/raw-materials/${rawMaterialId}/batches`
  );

  return response.batches;
}

export async function fetchRawMaterialTransactions(
  rawMaterialId: string,
  params: {
    type?: string;
    from?: string;
    to?: string;
    search?: string;
  } = {}
) {
  const query = toQueryString(params);
  const response = await apiJsonFetch<{ transactions: InventoryTransaction[] }>(
    `/raw-materials/${rawMaterialId}/transactions${query}`
  );

  return response.transactions;
}

export async function fetchStockBatchTransactions(
  stockBatchId: string,
  params: {
    type?: string;
    from?: string;
    to?: string;
    search?: string;
  } = {}
) {
  const query = toQueryString(params);
  const response = await apiJsonFetch<{ transactions: InventoryTransaction[] }>(
    `/stock-batches/${stockBatchId}/transactions${query}`
  );

  return response.transactions;
}

export async function fetchStockRuns(params: {
  status?: string;
  from?: string;
  to?: string;
  search?: string;
}) {
  const query = toQueryString(params);
  const response = await apiJsonFetch<{ stockRuns: StockRun[] }>(
    `/stock-runs${query}`
  );

  return response.stockRuns;
}

export async function fetchStockRun(stockRunId: string) {
  const response = await apiJsonFetch<{ stockRun: StockRun }>(
    `/stock-runs/${stockRunId}`
  );

  return response.stockRun;
}

export async function createRawMaterial(input: {
  name: string;
  sku: string;
  unitId: string;
  reorderPoint: number;
}) {
  const response = await apiJsonFetch<{ rawMaterial: RawMaterial }>("/raw-materials", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.rawMaterial;
}

export async function updateRawMaterial(
  rawMaterialId: string,
  input: {
    name: string;
    sku: string;
    unitId: string;
    reorderPoint: number;
  }
) {
  const response = await apiJsonFetch<{ rawMaterial: RawMaterial }>(
    `/raw-materials/${rawMaterialId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );

  return response.rawMaterial;
}

export async function archiveRawMaterial(rawMaterialId: string) {
  const response = await apiJsonFetch<{ rawMaterial: RawMaterial }>(
    `/raw-materials/${rawMaterialId}`,
    {
      method: "DELETE",
    }
  );

  return response.rawMaterial;
}

export async function createSupplier(input: {
  name: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  contactInfo?: string;
}) {
  const response = await apiJsonFetch<{ supplier: Supplier }>("/suppliers", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.supplier;
}

export async function deleteSupplier(supplierId: string) {
  const response = await apiJsonFetch<{ supplier: Supplier }>(
    `/suppliers/${encodeURIComponent(supplierId)}`,
    { method: "DELETE" }
  );
  return response.supplier;
}

export async function updateSupplier(
  supplierId: string,
  input: {
    name?: string;
    latitude?: number;
    longitude?: number;
    address?: string;
    contactInfo?: string;
  }
) {
  const response = await apiJsonFetch<{ supplier: Supplier }>(
    `/suppliers/${supplierId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );

  return response.supplier;
}

export async function createInventoryAdjustment(input: {
  direction: "INCREASE" | "DECREASE";
  rawMaterialId: string;
  batchId?: string;
  quantity: number;
  reasonCode: string;
  note?: string;
  costPerUnit?: number;
  supplierId?: string;
  expirationDate?: string;
  receivedAt?: string;
}) {
  const response = await apiJsonFetch<{ transaction: InventoryTransaction }>(
    "/inventory/adjustments",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );

  return response.transaction;
}

export async function createInventoryWaste(input: {
  rawMaterialId: string;
  batchId: string;
  quantity: number;
  reasonCode: string;
  note?: string;
}) {
  const response = await apiJsonFetch<{ transaction: InventoryTransaction }>(
    "/inventory/waste",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );

  return response.transaction;
}

export async function createStockRun(input: { name: string; notes?: string }) {
  const response = await apiJsonFetch<{ stockRun: StockRun }>("/stock-runs", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.stockRun;
}

export async function addStockRunItem(
  stockRunId: string,
  input: {
    rawMaterialId: string;
    supplierId?: string;
    quantity: number;
    costPerUnit: number;
    expirationDate?: string;
    receivedAt?: string;
    note?: string;
  }
) {
  const response = await apiJsonFetch<{ stockRunItem: StockRun["items"][number] }>(
    `/stock-runs/${stockRunId}/items`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );

  return response.stockRunItem;
}

export async function deleteStockRunItem(stockRunId: string, stockRunItemId: string) {
  const response = await apiFetch(`/stock-runs/${stockRunId}/items/${stockRunItemId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(
      data && typeof data === "object" && "message" in data && typeof data.message === "string"
        ? data.message
        : "Failed to delete stock-run item"
    );
  }
}

export async function deleteStockRun(stockRunId: string) {
  let response = await apiFetch(`/stock-runs/drafts/${stockRunId}/delete`, {
    method: "POST",
  });

  if (response.status === 404) {
    response = await apiFetch(`/stock-runs/${stockRunId}/draft`, {
      method: "DELETE",
    });
  }

  if (response.status === 404) {
    response = await apiFetch(`/stock-runs/${stockRunId}`, {
      method: "DELETE",
    });
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(
      data && typeof data === "object" && "message" in data && typeof data.message === "string"
        ? data.message
        : "Failed to delete stock run"
    );
  }
}

export async function postStockRun(stockRunId: string) {
  const response = await apiJsonFetch<{ stockRun: StockRun }>(
    `/stock-runs/${stockRunId}/post`,
    {
      method: "POST",
    }
  );

  return response.stockRun;
}
