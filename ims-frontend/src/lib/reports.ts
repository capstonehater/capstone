import { apiJsonFetch } from "./api";
import type {
  DecimalString,
  InventoryUnit,
  InventorySummaryItem,
  StockRun,
  Supplier,
} from "./inventory";
import type { OrderStatus, PaymentMethod, PosMenuCategory, PosOrder } from "./pos";

type ReportFilters = {
  from?: string;
  to?: string;
  limit?: number;
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

function buildReportQuery(filters: ReportFilters) {
  return toQueryString({
    from: filters.from,
    to: filters.to,
    limit: filters.limit ? String(filters.limit) : undefined,
  });
}

export type SalesOverviewReport = {
  period: {
    from: string | null;
    to: string | null;
  };
  summary: {
    orderCount: number;
    totalSales: DecimalString;
    totalDiscounts: DecimalString;
    totalTax: DecimalString;
    totalCogs: DecimalString;
    grossMargin: DecimalString;
    averageOrderValue: DecimalString;
  };
  paymentBreakdown: Array<{
    method: string;
    amount: DecimalString;
  }>;
  topVariants: Array<{
    productVariantId: string;
    productName: string;
    variantName: string;
    sku: string;
    quantitySold: number;
    revenue: DecimalString;
    cogs: DecimalString;
    grossMargin: DecimalString;
    marginRate: number;
  }>;
  recentOrders: Array<{
    id: string;
    completedAt: string;
    totalAmount: DecimalString;
    totalCogsAmount: DecimalString;
    createdBy: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
  }>;
};

export type VariantMarginReport = {
  period: {
    from: string | null;
    to: string | null;
  };
  totals: {
    quantitySold: number;
    revenue: DecimalString;
    cogs: DecimalString;
    grossMargin: DecimalString;
  };
  variants: Array<{
    productVariantId: string;
    productName: string;
    variantName: string;
    sku: string;
    quantitySold: number;
    revenue: DecimalString;
    cogs: DecimalString;
    grossMargin: DecimalString;
    marginRate: number;
  }>;
};

export type WasteSummaryReport = {
  period: {
    from: string | null;
    to: string | null;
  };
  totals: {
    eventCount: number;
    quantity: DecimalString;
    cost: DecimalString;
  };
  byReason: Array<{
    reasonCode: string;
    quantity: DecimalString;
    cost: DecimalString;
    eventCount: number;
  }>;
  byMaterial: Array<{
    rawMaterialId: string;
    name: string;
    sku: string;
    quantity: DecimalString;
    cost: DecimalString;
    eventCount: number;
  }>;
  recentWaste: Array<{
    id: string;
    occurredAt: string;
    reasonCode: string | null;
    note: string | null;
    actorUser: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    } | null;
    quantity: DecimalString;
    cost: DecimalString;
  }>;
};

export type StockRunSpendReport = {
  period: {
    from: string | null;
    to: string | null;
  };
  totals: {
    runCount: number;
    totalSpend: DecimalString;
    averageRunCost: DecimalString;
  };
  bySupplier: Array<{
    supplierId: string | null;
    supplierName: string;
    totalSpend: DecimalString;
    lineCount: number;
  }>;
  recentRuns: Array<{
    id: string;
    name: string;
    postedAt: string | null;
    totalCost: DecimalString;
    itemCount: number;
    createdBy: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
  }>;
};

export type InventoryHealthReport = {
  summary: {
    totalMaterials: number;
    inStockCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    inactiveCount: number;
    totalInventoryValue: DecimalString;
    activeBatchCount: number;
    nearExpiryBatchCount: number;
  };
  highValueMaterials: InventorySummaryItem[];
  lowStockMaterials: InventorySummaryItem[];
  outOfStockMaterials: InventorySummaryItem[];
  nearExpiryBatches: Array<{
    id: string;
    expirationDate: string | null;
    remainingQuantity: DecimalString;
    costPerUnit: DecimalString;
    rawMaterial: {
      id: string;
      name: string;
      sku: string;
    };
    supplier: Supplier | null;
  }>;
};

export type InventoryKpiSummaryReport = {
  period: {
    from: string;
    to: string;
  };
  summary: {
    foodCostPercentage: DecimalString | null;
    wastePercentage: DecimalString | null;
    inventoryTurnoverRate: DecimalString | null;
  };
  totals: {
    revenue: DecimalString;
    cogs: DecimalString;
    checkoutCost: DecimalString;
    wasteCost: DecimalString;
    totalInventoryUsedCost: DecimalString;
    averageInventory: DecimalString | null;
    snapshotDayCount: number;
    expectedSnapshotDayCount: number;
  };
};

export type InventoryAvailabilityRiskReport = {
  period: {
    from: string;
    to: string;
  };
  definitions: {
    stockoutRate: string;
    menuItemAvailabilityRate: string;
    topSellingItemAvailability: string;
  };
  summary: {
    stockoutRatePercentage: DecimalString | null;
    materialsWithStockoutCount: number;
    trackedMaterialCount: number;
    overlappingStockoutEventCount: number;
    menuItemAvailabilityRate: DecimalString | null;
    trackedVariantCount: number;
    untrackedVariantCount: number;
    topSellingItemAvailabilityPercentage: DecimalString | null;
    trackedTopSellingVariantCount: number;
    totalTopSellingVariantCount: number;
  };
  stockoutMaterials: Array<{
    rawMaterial: {
      id: string;
      name: string;
      sku: string;
      unit: InventoryUnit;
    };
    stockoutDurationHours: DecimalString;
    stockoutRatePercentage: DecimalString;
    overlappingStockoutEventCount: number;
    currentlyOutOfStock: boolean;
    blockingContexts: string[];
  }>;
  topSellingVariants: Array<{
    productVariant: {
      id: string;
      name: string;
      sku: string;
      product: {
        id: string | null;
        name: string;
        category: {
          id: string;
          name: string;
        } | null;
      };
    };
    quantitySold: number;
    revenue: DecimalString;
    availabilityPercentage: DecimalString | null;
    sellableDurationHours: DecimalString | null;
    downtimeDurationHours: DecimalString | null;
    eventCount: number;
    trackedFromRangeStart: boolean;
  }>;
};

export type PosDashboardReport = {
  period: {
    from: string;
    to: string;
  };
  summary: {
    grossSales: DecimalString;
    netSales: DecimalString;
    discounts: DecimalString;
    transactionCount: number;
    averageOrderValue: DecimalString;
  };
  comparisons: {
    previousPeriod: {
      from: string;
      to: string;
      netSales: DecimalString;
      growthRate: number | null;
    };
    samePeriodLastWeek: {
      from: string;
      to: string;
      netSales: DecimalString;
      growthRate: number | null;
    };
  };
  topProduct: {
    productName: string;
    quantitySold: number;
    revenue: DecimalString;
  } | null;
  trend: {
    granularity: "hourly" | "daily";
    points: Array<{
      bucketKey: string;
      label: string;
      netSales: DecimalString;
      transactionCount: number;
    }>;
  };
  recentOrders: Array<{
    id: string;
    displayOrderNumber: string;
    completedAt: string;
    totalAmount: DecimalString;
    subtotalAmount: DecimalString;
    discountAmount: DecimalString;
    taxAmount: DecimalString;
    createdBy: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
    itemCount: number;
    quantitySold: number;
    paymentMethods: PaymentMethod[];
  }>;
};

export type PosTransactionHistoryReport = {
  period: {
    from: string | null;
    to: string | null;
  };
  filters: {
    search: string | null;
    staffSearch: string | null;
    paymentMethod: PaymentMethod | null;
    status: OrderStatus | null;
  };
  orders: PosOrder[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type PosTransactionHistoryFilters = {
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  staffSearch?: string;
  paymentMethod?: PaymentMethod;
  status?: OrderStatus;
};

export type PosSalesAnalyticsGroupBy = "daily" | "weekly" | "monthly";

export type PosSalesAnalyticsReport = {
  period: {
    from: string;
    to: string;
  };
  filters: {
    groupBy: PosSalesAnalyticsGroupBy;
    staffSearch: string | null;
    paymentMethod: PaymentMethod | null;
  };
  summary: {
    grossSales: DecimalString;
    netSales: DecimalString;
    discounts: DecimalString;
    refunds: DecimalString;
    transactionCount: number;
    averageTicketSize: DecimalString;
  };
  comparison: {
    previousPeriod: {
      from: string;
      to: string;
      grossSales: DecimalString;
      netSales: DecimalString;
      discounts: DecimalString;
      refunds: DecimalString;
      transactionCount: number;
      averageTicketSize: DecimalString;
      growthRate: number | null;
    };
  };
  groups: Array<{
    bucketKey: string;
    label: string;
    grossSales: DecimalString;
    netSales: DecimalString;
    discounts: DecimalString;
    refunds: DecimalString;
    transactionCount: number;
    averageTicketSize: DecimalString;
  }>;
};

export type PosSalesAnalyticsFilters = {
  from?: string;
  to?: string;
  groupBy?: PosSalesAnalyticsGroupBy;
  staffSearch?: string;
  paymentMethod?: PaymentMethod;
};

export type PosPaymentReportsReport = {
  period: {
    from: string;
    to: string;
  };
  summary: {
    completedTransactionCount: number;
    totalCollected: DecimalString;
    cashTotal: DecimalString;
    cardTotal: DecimalString;
    ewalletTotal: DecimalString;
    otherTotal: DecimalString;
    splitPaymentTransactionCount: number;
    splitPaymentCollected: DecimalString;
  };
  breakdown: Array<{
    method: PaymentMethod;
    amount: DecimalString;
    paymentCount: number;
    orderCount: number;
    shareOfCollected: number | null;
  }>;
  splitPaymentOrders: Array<{
    id: string;
    completedAt: string;
    totalAmount: DecimalString;
    createdBy: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
    payments: Array<{
      id: string;
      method: PaymentMethod;
      amount: DecimalString;
      reference: string | null;
    }>;
  }>;
};

export type PosRefundsVoidsReport = {
  period: {
    from: string;
    to: string;
  };
  filters: {
    staffSearch: string | null;
  };
  summary: {
    refundCount: number;
    refundedAmount: DecimalString;
    voidCount: number;
    voidedAmount: DecimalString;
    totalReversalCount: number;
  };
  byReason: Array<{
    type: "REFUND" | "VOID";
    reasonCode: string;
    count: number;
    amount: DecimalString;
  }>;
  byStaff: Array<{
    responsibleStaff: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
    reversalCount: number;
    refundCount: number;
    voidCount: number;
    refundedAmount: DecimalString;
    voidedAmount: DecimalString;
  }>;
  reversals: Array<{
    id: string;
    orderId: string;
    type: "REFUND" | "VOID";
    amount: DecimalString;
    reasonCode: string;
    note: string | null;
    paymentReference: string | null;
    occurredAt: string;
    responsibleStaff: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
    reversalActor: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
    orderStatus: OrderStatus;
    approvalContext: {
      approvedByUserId: string | null;
      approvedByEmail: string | null;
      requestedByUserId: string | null;
      requestedBy: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
      } | null;
    };
  }>;
};

export type PosRefundsVoidsFilters = {
  from?: string;
  to?: string;
  staffSearch?: string;
};

export type ReportCategory = PosMenuCategory;

export type PosProductPerformanceReport = {
  period: {
    from: string;
    to: string;
  };
  filters: {
    categoryId: string | null;
  };
  categoryAttributionMode: "CURRENT_RELATIONSHIP";
  summary: {
    totalProductsConsidered: number;
    sellingProductsCount: number;
    totalQuantitySold: number;
    totalRevenue: DecimalString;
    totalGrossMargin: DecimalString;
  };
  products: Array<{
    productId: string;
    productName: string;
    category: {
      id: string;
      name: string;
    };
    variantCount: number;
    quantitySold: number;
    orderCount: number;
    revenue: DecimalString;
    cogs: DecimalString;
    grossMargin: DecimalString;
    contributionPercentage: number | null;
    marginRate: number | null;
  }>;
  topSellersByQuantity: Array<{
    productId: string;
    productName: string;
    category: {
      id: string;
      name: string;
    };
    variantCount: number;
    quantitySold: number;
    orderCount: number;
    revenue: DecimalString;
    cogs: DecimalString;
    grossMargin: DecimalString;
    contributionPercentage: number | null;
    marginRate: number | null;
  }>;
  topProductsByRevenue: Array<{
    productId: string;
    productName: string;
    category: {
      id: string;
      name: string;
    };
    variantCount: number;
    quantitySold: number;
    orderCount: number;
    revenue: DecimalString;
    cogs: DecimalString;
    grossMargin: DecimalString;
    contributionPercentage: number | null;
    marginRate: number | null;
  }>;
  topProductsByGrossMargin: Array<{
    productId: string;
    productName: string;
    category: {
      id: string;
      name: string;
    };
    variantCount: number;
    quantitySold: number;
    orderCount: number;
    revenue: DecimalString;
    cogs: DecimalString;
    grossMargin: DecimalString;
    contributionPercentage: number | null;
    marginRate: number | null;
  }>;
  slowMovingProducts: Array<{
    productId: string;
    productName: string;
    category: {
      id: string;
      name: string;
    };
    variantCount: number;
    quantitySold: number;
    orderCount: number;
    revenue: DecimalString;
    cogs: DecimalString;
    grossMargin: DecimalString;
    contributionPercentage: number | null;
    marginRate: number | null;
  }>;
  topCategories: Array<{
    categoryId: string;
    categoryName: string;
    quantitySold: number;
    revenue: DecimalString;
    grossMargin: DecimalString;
    contributionPercentage: number | null;
  }>;
};

export type PosProductPerformanceFilters = {
  from?: string;
  to?: string;
  categoryId?: string;
};

export type PosStaffPerformanceReport = {
  period: {
    from: string;
    to: string;
  };
  summary: {
    staffCount: number;
    totalNetSales: DecimalString;
    totalTransactions: number;
    totalDiscounts: DecimalString;
    totalRefundsHandled: number;
    totalVoidsHandled: number;
  };
  staff: Array<{
    staff: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
    grossSales: DecimalString;
    netSales: DecimalString;
    discounts: DecimalString;
    transactionCount: number;
    refundCount: number;
    refundedAmount: DecimalString;
    voidCount: number;
    voidedAmount: DecimalString;
    averageOrderValue: DecimalString;
  }>;
  comparison: {
    topByNetSales: {
      staff: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
      };
      grossSales: DecimalString;
      netSales: DecimalString;
      discounts: DecimalString;
      transactionCount: number;
      refundCount: number;
      refundedAmount: DecimalString;
      voidCount: number;
      voidedAmount: DecimalString;
      averageOrderValue: DecimalString;
    } | null;
    topByTransactions: {
      staff: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
      };
      grossSales: DecimalString;
      netSales: DecimalString;
      discounts: DecimalString;
      transactionCount: number;
      refundCount: number;
      refundedAmount: DecimalString;
      voidCount: number;
      voidedAmount: DecimalString;
      averageOrderValue: DecimalString;
    } | null;
    topByRefundsHandled: {
      staff: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
      };
      grossSales: DecimalString;
      netSales: DecimalString;
      discounts: DecimalString;
      transactionCount: number;
      refundCount: number;
      refundedAmount: DecimalString;
      voidCount: number;
      voidedAmount: DecimalString;
      averageOrderValue: DecimalString;
    } | null;
  };
};

export type PosPeakDayType = "all" | "weekday" | "weekend";

export type PosPeakHoursReport = {
  period: {
    from: string;
    to: string;
  };
  filters: {
    dayType: PosPeakDayType;
  };
  summary: {
    totalTransactions: number;
    totalNetSales: DecimalString;
    busiestHour: {
      hour: number;
      label: string;
      grossSales: DecimalString;
      netSales: DecimalString;
      transactionCount: number;
      averageTicketSize: DecimalString;
    } | null;
    slowestHour: {
      hour: number;
      label: string;
      grossSales: DecimalString;
      netSales: DecimalString;
      transactionCount: number;
      averageTicketSize: DecimalString;
    } | null;
  };
  hourly: Array<{
    hour: number;
    label: string;
    grossSales: DecimalString;
    netSales: DecimalString;
    transactionCount: number;
    averageTicketSize: DecimalString;
  }>;
  busiestHours: Array<{
    hour: number;
    label: string;
    grossSales: DecimalString;
    netSales: DecimalString;
    transactionCount: number;
    averageTicketSize: DecimalString;
  }>;
  slowestHours: Array<{
    hour: number;
    label: string;
    grossSales: DecimalString;
    netSales: DecimalString;
    transactionCount: number;
    averageTicketSize: DecimalString;
  }>;
};

export type PosPeakHoursFilters = {
  from?: string;
  to?: string;
  dayType?: PosPeakDayType;
};

export type PosInventoryLinkedReport = {
  period: {
    from: string;
    to: string;
  };
  filters: {
    materialSearch: string | null;
    variantSearch: string | null;
    drilldownVariantId: string | null;
  };
  summary: {
    salesLinkedTransactionCount: number;
    totalMaterialConsumptionQuantity: DecimalString;
    totalConsumptionCost: DecimalString;
    distinctMaterialsConsumed: number;
    distinctVariantsSold: number;
    lowStockConsumedMaterialCount: number;
  };
  materials: Array<{
    rawMaterial: {
      id: string;
      name: string;
      sku: string;
      reorderPoint: DecimalString;
      unit: InventoryUnit;
    };
    consumedQuantity: DecimalString;
    consumptionCost: DecimalString;
    movementLineCount: number;
    orderCount: number;
    variantCount: number;
    currentOnHandQuantity: DecimalString;
    currentUsableQuantity: DecimalString;
    isLowStock: boolean;
    activeLowStockAlert: {
      id: string;
      severity: string;
      title: string;
      message: string;
      lastTriggeredAt: string;
    } | null;
  }>;
  lowStockMaterials: Array<{
    rawMaterial: {
      id: string;
      name: string;
      sku: string;
      reorderPoint: DecimalString;
      unit: InventoryUnit;
    };
    consumedQuantity: DecimalString;
    consumptionCost: DecimalString;
    movementLineCount: number;
    orderCount: number;
    variantCount: number;
    currentOnHandQuantity: DecimalString;
    currentUsableQuantity: DecimalString;
    isLowStock: boolean;
    activeLowStockAlert: {
      id: string;
      severity: string;
      title: string;
      message: string;
      lastTriggeredAt: string;
    } | null;
  }>;
  variants: Array<{
    productVariant: {
      id: string;
      name: string;
      sku: string;
      product: {
        id: string | null;
        name: string;
        category: {
          id: string;
          name: string;
        } | null;
      };
    };
    quantitySold: number;
    revenue: DecimalString;
    cogs: DecimalString;
    grossMargin: DecimalString;
    orderCount: number;
    materialConsumptionQuantity: DecimalString;
    materialConsumptionCost: DecimalString;
  }>;
  recentSalesLinkedMovements: Array<{
    transactionId: string;
    orderId: string | null;
    occurredAt: string;
    consumedQuantity: DecimalString;
    consumptionCost: DecimalString;
    rawMaterialCount: number;
    variantCount: number;
    movementLineCount: number;
  }>;
  selectedVariantBreakdown: {
    productVariant: {
      id: string;
      name: string;
      sku: string;
      product: {
        id: string | null;
        name: string;
        category: {
          id: string;
          name: string;
        } | null;
      };
    };
    summary: {
      quantitySold: number;
      revenue: DecimalString;
      cogs: DecimalString;
      grossMargin: DecimalString;
      materialConsumptionQuantity: DecimalString;
      materialConsumptionCost: DecimalString;
    };
    materials: Array<{
      rawMaterial: {
        id: string;
        name: string;
        sku: string;
        reorderPoint: DecimalString;
        unit: InventoryUnit;
      };
      consumedQuantity: DecimalString;
      consumptionCost: DecimalString;
      movementLineCount: number;
      currentUsableQuantity: DecimalString;
      isLowStock: boolean;
    }>;
  } | null;
};

export type PosInventoryLinkedFilters = {
  from?: string;
  to?: string;
  materialSearch?: string;
  variantSearch?: string;
  drilldownVariantId?: string;
};

export type PosAuditExceptionKind = "REFUND" | "VOID" | "DISCOUNT";

export type PosAuditExceptionsReport = {
  period: {
    from: string;
    to: string;
  };
  filters: {
    staffSearch: string | null;
    reasonSearch: string | null;
    status: OrderStatus | null;
    exceptionType: "ALL" | PosAuditExceptionKind;
  };
  summary: {
    totalExceptions: number;
    refundCount: number;
    refundedAmount: DecimalString;
    voidCount: number;
    voidedAmount: DecimalString;
    discountCount: number;
    discountedAmount: DecimalString;
  };
  rows: Array<{
    id: string;
    kind: PosAuditExceptionKind;
    occurredAt: string;
    orderId: string;
    orderStatus: OrderStatus;
    amount: DecimalString;
    reasonCode: string | null;
    note: string | null;
    responsibleUser: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
    relatedUser: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    } | null;
    approvalContext: {
      requestedByUserId: string | null;
      requestedBy: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
      } | null;
      approvedByUserId: string | null;
      approvedByEmail: string | null;
    };
    paymentReference: string | null;
    discountDetails: {
      discountCode: string | null;
      discountRate: DecimalString;
      discountAmount: DecimalString;
    } | null;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type PosAuditExceptionsFilters = {
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  staffSearch?: string;
  reasonSearch?: string;
  status?: OrderStatus;
  exceptionType?: "ALL" | PosAuditExceptionKind;
};

async function fetchReport<T>(endpoint: string, filters: ReportFilters = {}) {
  const query = buildReportQuery(filters);
  const response = await apiJsonFetch<{ report: T }>(`${endpoint}${query}`);
  return response.report;
}

export async function fetchSalesOverview(filters: ReportFilters = {}) {
  return fetchReport<SalesOverviewReport>("/reports/sales-overview", filters);
}

export async function fetchVariantMargin(filters: ReportFilters = {}) {
  return fetchReport<VariantMarginReport>("/reports/variant-margin", filters);
}

export async function fetchWasteSummary(filters: ReportFilters = {}) {
  return fetchReport<WasteSummaryReport>("/reports/waste-summary", filters);
}

export async function fetchStockRunSpend(filters: ReportFilters = {}) {
  return fetchReport<StockRunSpendReport>("/reports/stock-run-spend", filters);
}

export async function fetchInventoryHealth(filters: ReportFilters = {}) {
  return fetchReport<InventoryHealthReport>("/reports/inventory-health", filters);
}

export async function fetchInventoryKpiSummary(filters: ReportFilters = {}) {
  return fetchReport<InventoryKpiSummaryReport>("/reports/inventory-kpi-summary", filters);
}

export async function fetchInventoryAvailabilityRisk(filters: ReportFilters = {}) {
  return fetchReport<InventoryAvailabilityRiskReport>(
    "/reports/inventory-availability-risk",
    filters,
  );
}

export async function fetchPosDashboard(filters: ReportFilters = {}) {
  return fetchReport<PosDashboardReport>("/reports/pos-dashboard", filters);
}

export async function fetchPosTransactionHistory(
  filters: PosTransactionHistoryFilters = {},
) {
  const query = toQueryString({
    from: filters.from,
    to: filters.to,
    page: filters.page ? String(filters.page) : undefined,
    pageSize: filters.pageSize ? String(filters.pageSize) : undefined,
    search: filters.search,
    staffSearch: filters.staffSearch,
    paymentMethod: filters.paymentMethod,
    status: filters.status,
  });

  const response = await apiJsonFetch<{ report: PosTransactionHistoryReport }>(
    `/reports/pos-transaction-history${query}`,
  );
  return response.report;
}

export async function fetchPosOrderDetail(orderId: string) {
  const response = await apiJsonFetch<{ order: PosOrder }>(`/orders/${orderId}`);
  return response.order;
}

export async function fetchPosSalesAnalytics(
  filters: PosSalesAnalyticsFilters = {},
) {
  const query = toQueryString({
    from: filters.from,
    to: filters.to,
    groupBy: filters.groupBy,
    staffSearch: filters.staffSearch,
    paymentMethod: filters.paymentMethod,
  });

  const response = await apiJsonFetch<{ report: PosSalesAnalyticsReport }>(
    `/reports/pos-sales-analytics${query}`,
  );
  return response.report;
}

export async function fetchPosPaymentReports(filters: ReportFilters = {}) {
  return fetchReport<PosPaymentReportsReport>("/reports/pos-payment-reports", filters);
}

export async function fetchPosRefundsVoids(
  filters: PosRefundsVoidsFilters = {},
) {
  const query = toQueryString({
    from: filters.from,
    to: filters.to,
    staffSearch: filters.staffSearch,
  });

  const response = await apiJsonFetch<{ report: PosRefundsVoidsReport }>(
    `/reports/pos-refunds-voids${query}`,
  );
  return response.report;
}

export async function fetchReportCategories() {
  const response = await apiJsonFetch<{ categories: ReportCategory[] }>("/categories");
  return response.categories;
}

export async function fetchPosProductPerformance(
  filters: PosProductPerformanceFilters = {},
) {
  const query = toQueryString({
    from: filters.from,
    to: filters.to,
    categoryId: filters.categoryId,
  });

  const response = await apiJsonFetch<{ report: PosProductPerformanceReport }>(
    `/reports/pos-product-performance${query}`,
  );
  return response.report;
}

export async function fetchPosStaffPerformance(filters: ReportFilters = {}) {
  return fetchReport<PosStaffPerformanceReport>("/reports/pos-staff-performance", filters);
}

export async function fetchPosPeakHours(filters: PosPeakHoursFilters = {}) {
  const query = toQueryString({
    from: filters.from,
    to: filters.to,
    dayType: filters.dayType,
  });

  const response = await apiJsonFetch<{ report: PosPeakHoursReport }>(
    `/reports/pos-peak-hours${query}`,
  );
  return response.report;
}

export async function fetchPosInventoryLinked(
  filters: PosInventoryLinkedFilters = {},
) {
  const query = toQueryString({
    from: filters.from,
    to: filters.to,
    materialSearch: filters.materialSearch,
    variantSearch: filters.variantSearch,
    drilldownVariantId: filters.drilldownVariantId,
  });

  const response = await apiJsonFetch<{ report: PosInventoryLinkedReport }>(
    `/reports/pos-inventory-linked${query}`,
  );
  return response.report;
}

export async function fetchPosAuditExceptions(
  filters: PosAuditExceptionsFilters = {},
) {
  const query = toQueryString({
    from: filters.from,
    to: filters.to,
    page: filters.page ? String(filters.page) : undefined,
    pageSize: filters.pageSize ? String(filters.pageSize) : undefined,
    staffSearch: filters.staffSearch,
    reasonSearch: filters.reasonSearch,
    status: filters.status,
    exceptionType: filters.exceptionType,
  });

  const response = await apiJsonFetch<{ report: PosAuditExceptionsReport }>(
    `/reports/pos-audit-exceptions${query}`,
  );
  return response.report;
}
