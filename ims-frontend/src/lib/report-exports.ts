import { formatDateTime, formatPeso } from "./pos-utils";
import type { PosOrder } from "./pos";
import type {
  InventoryAvailabilityRiskReport,
  InventoryKpiSummaryReport,
  PosPaymentReportsReport,
  PosInventoryLinkedReport,
  PosAuditExceptionsReport,
  PosPeakHoursReport,
  PosProductPerformanceReport,
  PosRefundsVoidsReport,
  PosSalesAnalyticsReport,
  PosStaffPerformanceReport,
  PosTransactionHistoryReport,
} from "./reports";

export type InventoryReportsExportSnapshot = {
  filters: {
    from: string;
    to: string;
  };
  kpiSummary: InventoryKpiSummaryReport;
  availabilityRisk: InventoryAvailabilityRiskReport;
  inventoryLinked: PosInventoryLinkedExportSnapshot;
};

export type PosTransactionHistoryExportSnapshot = {
  filters: {
    from: string;
    to: string;
    search?: string;
    staffSearch?: string;
    paymentMethod?: string;
    status?: string;
    page: number;
    pageSize: number;
  };
  report: PosTransactionHistoryReport;
};

export type PosSalesAnalyticsExportSnapshot = {
  filters: {
    from: string;
    to: string;
    preset: "today" | "yesterday" | "this-week" | "monthly";
    groupBy: "daily" | "weekly" | "monthly";
    staffSearch?: string;
    paymentMethod?: string;
  };
  report: PosSalesAnalyticsReport;
};

export type PosPaymentReportsExportSnapshot = {
  filters: {
    from: string;
    to: string;
  };
  report: PosPaymentReportsReport;
};

export type PosRefundsVoidsExportSnapshot = {
  filters: {
    from: string;
    to: string;
    staffSearch?: string;
  };
  report: PosRefundsVoidsReport;
};

export type PosProductPerformanceExportSnapshot = {
  filters: {
    from: string;
    to: string;
    categoryId?: string;
    categoryName?: string;
  };
  report: PosProductPerformanceReport;
};

export type PosStaffPerformanceExportSnapshot = {
  filters: {
    from: string;
    to: string;
  };
  report: PosStaffPerformanceReport;
};

export type PosPeakHoursExportSnapshot = {
  filters: {
    from: string;
    to: string;
    dayType: "all" | "weekday" | "weekend";
  };
  report: PosPeakHoursReport;
};

export type PosInventoryLinkedExportSnapshot = {
  filters: {
    from: string;
    to: string;
    materialSearch?: string;
    variantSearch?: string;
    drilldownVariantName?: string;
  };
  report: PosInventoryLinkedReport;
};

export type PosAuditExceptionsExportSnapshot = {
  filters: {
    from: string;
    to: string;
    staffSearch?: string;
    reasonSearch?: string;
    status?: string;
    exceptionType?: string;
    page: number;
    pageSize: number;
  };
  report: PosAuditExceptionsReport;
};

function sanitizeFilenamePart(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function buildRangeBaseName(prefix: string, from: string, to: string) {
  const safeFrom = sanitizeFilenamePart(from || "open");
  const safeTo = sanitizeFilenamePart(to || "open");
  return `${prefix}_${safeFrom}_to_${safeTo}`;
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  if (typeof window === "undefined") {
    throw new Error("Exports are only available in the browser.");
  }

  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function escapeCsvCell(value: unknown) {
  const stringValue =
    value === null || value === undefined ? "" : String(value);
  return `"${stringValue.replaceAll(`"`, `""`)}"`;
}

function createCsvRow(values: unknown[]) {
  return values.map(escapeCsvCell).join(",");
}

function appendCsvSection(lines: string[], title: string, headers: string[], rows: unknown[][]) {
  lines.push(createCsvRow([title]));
  lines.push(createCsvRow(headers));

  if (rows.length === 0) {
    lines.push(createCsvRow(["No rows match the current report view."]));
  } else {
    for (const row of rows) {
      lines.push(createCsvRow(row));
    }
  }

  lines.push("");
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll(`"`, "&quot;")
    .replaceAll("'", "&#39;");
}

function renderHtmlTable(title: string, headers: string[], rows: string[][]) {
  const body =
    rows.length === 0
      ? `<tr><td colspan="${headers.length}" class="empty">No rows match the current report view.</td></tr>`
      : rows
          .map(
            (row) =>
              `<tr>${row
                .map((cell) => `<td>${escapeHtml(cell)}</td>`)
                .join("")}</tr>`,
          )
          .join("");

  return `
    <section class="section">
      <h2>${escapeHtml(title)}</h2>
      <table>
        <thead>
          <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </section>
  `;
}

function renderHtmlSummary(title: string, rows: Array<{ label: string; value: string }>) {
  return `
    <section class="section">
      <h2>${escapeHtml(title)}</h2>
      <div class="summary-grid">
        ${rows
          .map(
            (row) => `
              <div class="summary-card">
                <div class="summary-label">${escapeHtml(row.label)}</div>
                <div class="summary-value">${escapeHtml(row.value)}</div>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function describeOrderItems(order: PosOrder) {
  return order.items
    .map((item) => `${item.quantity}x ${item.productNameSnapshot} (${item.variantNameSnapshot})`)
    .join("; ");
}

function formatPercentExport(value: string | null | undefined) {
  if (!value) {
    return "N/A";
  }

  return `${Number(value).toFixed(2)}%`;
}

function appendInventoryKpiSummaryCsvSection(
  lines: string[],
  report: InventoryKpiSummaryReport,
) {
  appendCsvSection(lines, "KPI Summary", ["Metric", "Value"], [
    ["Food Cost %", formatPercentExport(report.summary.foodCostPercentage)],
    ["Waste %", formatPercentExport(report.summary.wastePercentage)],
    [
      "Inventory Turnover Rate",
      report.summary.inventoryTurnoverRate
        ? Number(report.summary.inventoryTurnoverRate).toFixed(2)
        : "N/A",
    ],
    ["Revenue", report.totals.revenue],
    ["COGS", report.totals.cogs],
    ["Checkout Cost", report.totals.checkoutCost],
    ["Waste Cost", report.totals.wasteCost],
    ["Total Inventory Used Cost", report.totals.totalInventoryUsedCost],
    ["Average Inventory", report.totals.averageInventory ?? "N/A"],
    ["Snapshot Days", `${report.totals.snapshotDayCount} / ${report.totals.expectedSnapshotDayCount}`],
  ]);
}

function renderInventoryKpiSummaryHtml(report: InventoryKpiSummaryReport) {
  return renderHtmlSummary("KPI Summary", [
    { label: "Food Cost %", value: formatPercentExport(report.summary.foodCostPercentage) },
    { label: "Waste %", value: formatPercentExport(report.summary.wastePercentage) },
    {
      label: "Inventory Turnover",
      value: report.summary.inventoryTurnoverRate
        ? Number(report.summary.inventoryTurnoverRate).toFixed(2)
        : "N/A",
    },
    { label: "Revenue", value: formatPeso(report.totals.revenue) },
    { label: "COGS", value: formatPeso(report.totals.cogs) },
    { label: "Checkout Cost", value: formatPeso(report.totals.checkoutCost) },
    { label: "Waste Cost", value: formatPeso(report.totals.wasteCost) },
    {
      label: "Average Inventory",
      value: report.totals.averageInventory
        ? formatPeso(report.totals.averageInventory)
        : "N/A",
    },
    {
      label: "Snapshot Days",
      value: `${report.totals.snapshotDayCount} / ${report.totals.expectedSnapshotDayCount}`,
    },
  ]);
}

function formatHourExport(value: string | null | undefined) {
  if (!value) {
    return "N/A";
  }

  return `${Number(value).toFixed(2)} h`;
}

function appendInventoryAvailabilityRiskCsvSections(
  lines: string[],
  report: InventoryAvailabilityRiskReport,
) {
  appendCsvSection(lines, "Availability & Stock Risk Summary", ["Metric", "Value"], [
    ["Stockout Rate", formatPercentExport(report.summary.stockoutRatePercentage)],
    ["Materials With Stockout", `${report.summary.materialsWithStockoutCount} / ${report.summary.trackedMaterialCount}`],
    ["Overlapping Stockout Events", report.summary.overlappingStockoutEventCount],
    ["Menu Item Availability Rate", formatPercentExport(report.summary.menuItemAvailabilityRate)],
    ["Tracked Variants", report.summary.trackedVariantCount],
    ["Untracked Variants", report.summary.untrackedVariantCount],
    ["Top-Selling Item Availability", formatPercentExport(report.summary.topSellingItemAvailabilityPercentage)],
    ["Tracked Top Sellers", `${report.summary.trackedTopSellingVariantCount} / ${report.summary.totalTopSellingVariantCount}`],
  ]);

  appendCsvSection(lines, "Availability & Stock Risk Definitions", ["Metric", "Definition"], [
    ["Stockout Rate", report.definitions.stockoutRate],
    ["Menu Item Availability Rate", report.definitions.menuItemAvailabilityRate],
    ["Top-Selling Item Availability", report.definitions.topSellingItemAvailability],
  ]);

  appendCsvSection(
    lines,
    "Materials With Recorded Stockout Time",
    ["Material", "SKU", "Unit", "Stockout Time", "Stockout Rate", "Events", "Current State", "Blocking Context"],
    report.stockoutMaterials.map((row) => [
      row.rawMaterial.name,
      row.rawMaterial.sku,
      row.rawMaterial.unit.code,
      formatHourExport(row.stockoutDurationHours),
      formatPercentExport(row.stockoutRatePercentage),
      row.overlappingStockoutEventCount,
      row.currentlyOutOfStock ? "Open" : "Recovered",
      row.blockingContexts.join(" | "),
    ]),
  );

  appendCsvSection(
    lines,
    "Top-Selling Item Availability",
    ["Product", "Variant", "Category", "Qty Sold", "Revenue", "Availability", "Sellable Time", "Downtime", "Coverage", "Events"],
    report.topSellingVariants.map((row) => [
      row.productVariant.product.name,
      row.productVariant.name,
      row.productVariant.product.category?.name ?? "Uncategorized",
      row.quantitySold,
      row.revenue,
      formatPercentExport(row.availabilityPercentage),
      formatHourExport(row.sellableDurationHours),
      formatHourExport(row.downtimeDurationHours),
      row.trackedFromRangeStart ? "Tracked" : "No baseline",
      row.eventCount,
    ]),
  );
}

function renderInventoryAvailabilityRiskHtml(report: InventoryAvailabilityRiskReport) {
  return `
    ${renderHtmlSummary("Availability & Stock Risk Summary", [
      { label: "Stockout Rate", value: formatPercentExport(report.summary.stockoutRatePercentage) },
      { label: "Materials With Stockout", value: `${report.summary.materialsWithStockoutCount} / ${report.summary.trackedMaterialCount}` },
      { label: "Menu Item Availability", value: formatPercentExport(report.summary.menuItemAvailabilityRate) },
      { label: "Tracked Variants", value: `${report.summary.trackedVariantCount} tracked / ${report.summary.untrackedVariantCount} untracked` },
      { label: "Top-Selling Availability", value: formatPercentExport(report.summary.topSellingItemAvailabilityPercentage) },
      { label: "Tracked Top Sellers", value: `${report.summary.trackedTopSellingVariantCount} / ${report.summary.totalTopSellingVariantCount}` },
    ])}

    ${renderHtmlTable(
      "Availability & Stock Risk Definitions",
      ["Metric", "Definition"],
      [
        ["Stockout Rate", report.definitions.stockoutRate],
        ["Menu Item Availability Rate", report.definitions.menuItemAvailabilityRate],
        ["Top-Selling Item Availability", report.definitions.topSellingItemAvailability],
      ],
    )}

    ${renderHtmlTable(
      "Materials With Recorded Stockout Time",
      ["Material", "SKU", "Unit", "Stockout Time", "Stockout Rate", "Events", "Current State", "Blocking Context"],
      report.stockoutMaterials.map((row) => [
        row.rawMaterial.name,
        row.rawMaterial.sku,
        row.rawMaterial.unit.code,
        formatHourExport(row.stockoutDurationHours),
        formatPercentExport(row.stockoutRatePercentage),
        String(row.overlappingStockoutEventCount),
        row.currentlyOutOfStock ? "Open" : "Recovered",
        row.blockingContexts.join(" | "),
      ]),
    )}

    ${renderHtmlTable(
      "Top-Selling Item Availability",
      ["Product", "Variant", "Category", "Qty Sold", "Revenue", "Availability", "Sellable Time", "Downtime", "Coverage", "Events"],
      report.topSellingVariants.map((row) => [
        row.productVariant.product.name,
        row.productVariant.name,
        row.productVariant.product.category?.name ?? "Uncategorized",
        String(row.quantitySold),
        formatPeso(row.revenue),
        formatPercentExport(row.availabilityPercentage),
        formatHourExport(row.sellableDurationHours),
        formatHourExport(row.downtimeDurationHours),
        row.trackedFromRangeStart ? "Tracked" : "No baseline",
        String(row.eventCount),
      ]),
    )}
  `;
}

function appendPosInventoryLinkedCsvSections(
  lines: string[],
  snapshot: PosInventoryLinkedExportSnapshot,
) {
  appendCsvSection(lines, "Inventory-Linked Sales Consumption Summary", ["Metric", "Value"], [
    ["Sales-Linked Transactions", snapshot.report.summary.salesLinkedTransactionCount],
    ["Total Material Consumption Quantity", snapshot.report.summary.totalMaterialConsumptionQuantity],
    ["Total Consumption Cost", snapshot.report.summary.totalConsumptionCost],
    ["Distinct Materials Consumed", snapshot.report.summary.distinctMaterialsConsumed],
    ["Distinct Variants Sold", snapshot.report.summary.distinctVariantsSold],
    ["Low-Stock Consumed Materials", snapshot.report.summary.lowStockConsumedMaterialCount],
  ]);

  appendCsvSection(
    lines,
    "High-Usage Ingredients",
    [
      "Material",
      "SKU",
      "Unit",
      "Consumed Qty",
      "Consumption Cost",
      "Orders",
      "Variants",
      "Usable Qty",
      "Reorder Point",
      "Low Stock",
      "Active Alert",
    ],
    snapshot.report.materials.map((row) => [
      row.rawMaterial.name,
      row.rawMaterial.sku,
      row.rawMaterial.unit.code,
      row.consumedQuantity,
      row.consumptionCost,
      row.orderCount,
      row.variantCount,
      row.currentUsableQuantity,
      row.rawMaterial.reorderPoint,
      row.isLowStock ? "Yes" : "No",
      row.activeLowStockAlert ? row.activeLowStockAlert.severity : "",
    ]),
  );

  appendCsvSection(
    lines,
    "Top Variants by Sales-Linked Consumption",
    [
      "Product",
      "Variant",
      "Category",
      "Qty Sold",
      "Revenue",
      "COGS",
      "Gross Margin",
      "Material Qty",
      "Material Cost",
      "Orders",
    ],
    snapshot.report.variants.map((row) => [
      row.productVariant.product.name,
      row.productVariant.name,
      row.productVariant.product.category?.name ?? "Uncategorized",
      row.quantitySold,
      row.revenue,
      row.cogs,
      row.grossMargin,
      row.materialConsumptionQuantity,
      row.materialConsumptionCost,
      row.orderCount,
    ]),
  );

  appendCsvSection(
    lines,
    "Low-Stock or Reorder-Oriented Materials",
    [
      "Material",
      "SKU",
      "Consumed Qty",
      "Consumption Cost",
      "Usable Qty",
      "Reorder Point",
      "Alert",
    ],
    snapshot.report.lowStockMaterials.map((row) => [
      row.rawMaterial.name,
      row.rawMaterial.sku,
      row.consumedQuantity,
      row.consumptionCost,
      row.currentUsableQuantity,
      row.rawMaterial.reorderPoint,
      row.activeLowStockAlert?.title ?? "",
    ]),
  );

  appendCsvSection(
    lines,
    "Recent Sales-Linked Stock Movements",
    [
      "Transaction",
      "Order",
      "Occurred At",
      "Material Lines",
      "Raw Materials",
      "Variants",
      "Consumed Qty",
      "Consumption Cost",
    ],
    snapshot.report.recentSalesLinkedMovements.map((row) => [
      row.transactionId,
      row.orderId ?? "N/A",
      row.occurredAt,
      row.movementLineCount,
      row.rawMaterialCount,
      row.variantCount,
      row.consumedQuantity,
      row.consumptionCost,
    ]),
  );

  if (snapshot.report.selectedVariantBreakdown) {
    appendCsvSection(
      lines,
      "Selected Variant Material Breakdown",
      ["Material", "SKU", "Unit", "Consumed Qty", "Consumption Cost", "Usable Qty", "Low Stock"],
      snapshot.report.selectedVariantBreakdown.materials.map((row) => [
        row.rawMaterial.name,
        row.rawMaterial.sku,
        row.rawMaterial.unit.code,
        row.consumedQuantity,
        row.consumptionCost,
        row.currentUsableQuantity,
        row.isLowStock ? "Yes" : "No",
      ]),
    );
  }
}

function renderPosInventoryLinkedHtmlSections(snapshot: PosInventoryLinkedExportSnapshot) {
  return `
    ${renderHtmlSummary("Inventory-Linked Sales Consumption Summary", [
      { label: "Sales-Linked Transactions", value: String(snapshot.report.summary.salesLinkedTransactionCount) },
      { label: "Material Consumption Qty", value: String(snapshot.report.summary.totalMaterialConsumptionQuantity) },
      { label: "Consumption Cost", value: formatPeso(snapshot.report.summary.totalConsumptionCost) },
      { label: "Materials Consumed", value: String(snapshot.report.summary.distinctMaterialsConsumed) },
      { label: "Variants Sold", value: String(snapshot.report.summary.distinctVariantsSold) },
      { label: "Low-Stock Materials", value: String(snapshot.report.summary.lowStockConsumedMaterialCount) },
    ])}

    ${renderHtmlTable(
      "High-Usage Ingredients",
      ["Material", "SKU", "Unit", "Consumed Qty", "Consumption Cost", "Orders", "Variants", "Usable Qty", "Reorder Point", "Low Stock"],
      snapshot.report.materials.map((row) => [
        row.rawMaterial.name,
        row.rawMaterial.sku,
        row.rawMaterial.unit.code,
        String(row.consumedQuantity),
        formatPeso(row.consumptionCost),
        String(row.orderCount),
        String(row.variantCount),
        String(row.currentUsableQuantity),
        String(row.rawMaterial.reorderPoint),
        row.isLowStock ? "Yes" : "No",
      ]),
    )}

    ${renderHtmlTable(
      "Top Variants by Sales-Linked Consumption",
      ["Product", "Variant", "Category", "Qty Sold", "Revenue", "COGS", "Gross Margin", "Material Qty", "Material Cost", "Orders"],
      snapshot.report.variants.map((row) => [
        row.productVariant.product.name,
        row.productVariant.name,
        row.productVariant.product.category?.name ?? "Uncategorized",
        String(row.quantitySold),
        formatPeso(row.revenue),
        formatPeso(row.cogs),
        formatPeso(row.grossMargin),
        String(row.materialConsumptionQuantity),
        formatPeso(row.materialConsumptionCost),
        String(row.orderCount),
      ]),
    )}

    ${renderHtmlTable(
      "Low-Stock or Reorder-Oriented Materials",
      ["Material", "SKU", "Consumed Qty", "Consumption Cost", "Usable Qty", "Reorder Point", "Alert"],
      snapshot.report.lowStockMaterials.map((row) => [
        row.rawMaterial.name,
        row.rawMaterial.sku,
        String(row.consumedQuantity),
        formatPeso(row.consumptionCost),
        String(row.currentUsableQuantity),
        String(row.rawMaterial.reorderPoint),
        row.activeLowStockAlert?.title ?? "N/A",
      ]),
    )}

    ${renderHtmlTable(
      "Recent Sales-Linked Stock Movements",
      ["Transaction", "Order", "Occurred At", "Material Lines", "Raw Materials", "Variants", "Consumed Qty", "Consumption Cost"],
      snapshot.report.recentSalesLinkedMovements.map((row) => [
        row.transactionId,
        row.orderId ?? "N/A",
        formatDateTime(row.occurredAt),
        String(row.movementLineCount),
        String(row.rawMaterialCount),
        String(row.variantCount),
        String(row.consumedQuantity),
        formatPeso(row.consumptionCost),
      ]),
    )}

    ${
      snapshot.report.selectedVariantBreakdown
        ? renderHtmlTable(
            "Selected Variant Material Breakdown",
            ["Material", "SKU", "Unit", "Consumed Qty", "Consumption Cost", "Usable Qty", "Low Stock"],
            snapshot.report.selectedVariantBreakdown.materials.map((row) => [
              row.rawMaterial.name,
              row.rawMaterial.sku,
              row.rawMaterial.unit.code,
              String(row.consumedQuantity),
              formatPeso(row.consumptionCost),
              String(row.currentUsableQuantity),
              row.isLowStock ? "Yes" : "No",
            ]),
          )
        : ""
    }
  `;
}

export function buildInventoryReportsCsvContent(snapshot: InventoryReportsExportSnapshot) {
  const lines: string[] = [];

  lines.push(createCsvRow(["Inventory Reports Export"]));
  lines.push(createCsvRow(["Generated At", new Date().toISOString()]));
  lines.push(createCsvRow(["From", snapshot.filters.from]));
  lines.push(createCsvRow(["To", snapshot.filters.to]));
  lines.push(createCsvRow(["Scope", "Current inventory reports page view"]));
  lines.push(createCsvRow(["Variant Search", snapshot.inventoryLinked.filters.variantSearch ?? ""]));
  lines.push(createCsvRow(["Material Search", snapshot.inventoryLinked.filters.materialSearch ?? ""]));
  lines.push(
    createCsvRow([
      "Drill-down Variant",
      snapshot.inventoryLinked.filters.drilldownVariantName ?? "None selected",
    ]),
  );
  lines.push("");

  appendInventoryKpiSummaryCsvSection(lines, snapshot.kpiSummary);
  appendInventoryAvailabilityRiskCsvSections(lines, snapshot.availabilityRisk);
  appendPosInventoryLinkedCsvSections(lines, snapshot.inventoryLinked);

  return `\uFEFF${lines.join("\r\n")}`;
}

export function buildInventoryReportsPdfHtml(
  snapshot: InventoryReportsExportSnapshot,
  filename: string,
) {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(filename)}</title>
        <style>
          @page { size: A4; margin: 16mm; }
          body {
            margin: 0;
            color: #1f2937;
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.45;
            background: #ffffff;
          }
          .page {
            padding: 12px 0 24px;
          }
          h1 {
            margin: 0 0 8px;
            color: #0f172a;
            font-size: 24px;
          }
          .meta {
            margin-bottom: 18px;
            color: #475569;
          }
          .section {
            margin-top: 18px;
            break-inside: avoid;
          }
          h2 {
            margin: 0 0 10px;
            color: #0f172a;
            font-size: 16px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
          .summary-card {
            border: 1px solid #dbe3ee;
            border-radius: 10px;
            padding: 12px;
            background: #f8fafc;
          }
          .summary-label {
            color: #64748b;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }
          .summary-value {
            margin-top: 6px;
            color: #0f172a;
            font-size: 18px;
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #dbe3ee;
            border-radius: 10px;
            overflow: hidden;
          }
          th, td {
            border-bottom: 1px solid #e2e8f0;
            padding: 10px 12px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #f8fafc;
            color: #64748b;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }
          td.empty {
            color: #64748b;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <h1>Inventory Reports</h1>
          <div class="meta">
            <div><strong>Generated:</strong> ${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
            <div><strong>From:</strong> ${escapeHtml(snapshot.filters.from)}</div>
            <div><strong>To:</strong> ${escapeHtml(snapshot.filters.to)}</div>
            <div><strong>Scope:</strong> Current inventory reports page view</div>
            <div><strong>Variant Search:</strong> ${escapeHtml(snapshot.inventoryLinked.filters.variantSearch ?? "None")}</div>
            <div><strong>Material Search:</strong> ${escapeHtml(snapshot.inventoryLinked.filters.materialSearch ?? "None")}</div>
            <div><strong>Drill-down Variant:</strong> ${escapeHtml(snapshot.inventoryLinked.filters.drilldownVariantName ?? "None selected")}</div>
          </div>

          ${renderInventoryKpiSummaryHtml(snapshot.kpiSummary)}
          ${renderInventoryAvailabilityRiskHtml(snapshot.availabilityRisk)}
          ${renderPosInventoryLinkedHtmlSections(snapshot.inventoryLinked)}
        </div>
      </body>
    </html>
  `;
}

export function exportInventoryReportsCsv(snapshot: InventoryReportsExportSnapshot) {
  const filename = `${buildRangeBaseName("inventory-reports", snapshot.filters.from, snapshot.filters.to)}.csv`;
  downloadTextFile(
    filename,
    buildInventoryReportsCsvContent(snapshot),
    "text/csv;charset=utf-8",
  );
  return filename;
}

export function exportInventoryReportsPdf(snapshot: InventoryReportsExportSnapshot) {
  if (typeof window === "undefined") {
    throw new Error("PDF exports are only available in the browser.");
  }

  const filename = `${buildRangeBaseName("inventory-reports", snapshot.filters.from, snapshot.filters.to)}.pdf`;
  const printWindow = window.open("", "_blank", "noopener,noreferrer");

  if (!printWindow) {
    throw new Error("Unable to open a printable report window. Please allow pop-ups and try again.");
  }

  const html = buildInventoryReportsPdfHtml(snapshot, filename);

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 250);

  return filename;
}

export function exportPosTransactionHistoryCsv(snapshot: PosTransactionHistoryExportSnapshot) {
  const filename = `${buildRangeBaseName(
    "pos-transaction-history",
    snapshot.filters.from,
    snapshot.filters.to,
  )}.csv`;

  const lines: string[] = [];
  lines.push(createCsvRow(["POS Transaction History Export"]));
  lines.push(createCsvRow(["Generated At", new Date().toISOString()]));
  lines.push(createCsvRow(["From", snapshot.filters.from]));
  lines.push(createCsvRow(["To", snapshot.filters.to]));
  lines.push(createCsvRow(["Search", snapshot.filters.search ?? ""]));
  lines.push(createCsvRow(["Staff Filter", snapshot.filters.staffSearch ?? ""]));
  lines.push(createCsvRow(["Payment Method", snapshot.filters.paymentMethod ?? ""]));
  lines.push(createCsvRow(["Status", snapshot.filters.status ?? ""]));
  lines.push(createCsvRow(["Page", snapshot.filters.page]));
  lines.push(createCsvRow(["Page Size", snapshot.filters.pageSize]));
  lines.push(createCsvRow(["Scope", "Current filtered page"]));
  lines.push("");

  appendCsvSection(
    lines,
    "Transactions",
    [
      "Order Number",
      "Order ID",
      "Completed At",
      "Staff",
      "Items",
      "Subtotal",
      "Discount",
      "Tax",
      "Total",
      "Payment Methods",
      "Status",
    ],
    snapshot.report.orders.map((order) => [
      order.displayOrderNumber,
      order.id,
      order.completedAt,
      `${order.createdBy.firstName} ${order.createdBy.lastName}`,
      describeOrderItems(order),
      order.subtotalAmount,
      order.discountAmount,
      order.taxAmount,
      order.totalAmount,
      order.payments.map((payment) => payment.method).join(" + "),
      order.status,
    ]),
  );

  downloadTextFile(filename, `\uFEFF${lines.join("\r\n")}`, "text/csv;charset=utf-8");
  return filename;
}

export function exportPosTransactionHistoryPdf(snapshot: PosTransactionHistoryExportSnapshot) {
  if (typeof window === "undefined") {
    throw new Error("PDF exports are only available in the browser.");
  }

  const filename = `pos-transaction-history_${sanitizeFilenamePart(snapshot.filters.from)}_to_${sanitizeFilenamePart(snapshot.filters.to)}.pdf`;
  const printWindow = window.open("", "_blank", "noopener,noreferrer");

  if (!printWindow) {
    throw new Error("Unable to open a printable export window. Please allow pop-ups and try again.");
  }

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(filename)}</title>
        <style>
          @page { size: A4; margin: 16mm; }
          body { margin: 0; color: #1f2937; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.45; background: #ffffff; }
          .page { padding: 12px 0 24px; }
          h1 { margin: 0 0 8px; color: #0f172a; font-size: 24px; }
          .meta { margin-bottom: 18px; color: #475569; }
          .section { margin-top: 18px; break-inside: avoid; }
          h2 { margin: 0 0 10px; color: #0f172a; font-size: 16px; }
          table { width: 100%; border-collapse: collapse; border: 1px solid #dbe3ee; border-radius: 10px; overflow: hidden; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; vertical-align: top; }
          th { background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
          td.empty { color: #64748b; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="page">
          <h1>POS Transaction History</h1>
          <div class="meta">
            <div><strong>Generated:</strong> ${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
            <div><strong>From:</strong> ${escapeHtml(snapshot.filters.from)}</div>
            <div><strong>To:</strong> ${escapeHtml(snapshot.filters.to)}</div>
            <div><strong>Filters:</strong> Search=${escapeHtml(snapshot.filters.search ?? "N/A")} | Staff=${escapeHtml(snapshot.filters.staffSearch ?? "N/A")} | Payment=${escapeHtml(snapshot.filters.paymentMethod ?? "N/A")} | Status=${escapeHtml(snapshot.filters.status ?? "N/A")}</div>
            <div><strong>Page:</strong> ${snapshot.filters.page} of ${snapshot.report.pagination.totalPages || 1}</div>
            <div><strong>Scope:</strong> Current filtered page</div>
          </div>

          ${renderHtmlTable(
            "Transactions",
            ["Order Number", "Order ID", "Completed At", "Staff", "Items", "Subtotal", "Discount", "Tax", "Total", "Payment", "Status"],
            snapshot.report.orders.map((order) => [
              order.displayOrderNumber,
              order.id,
              formatDateTime(order.completedAt),
              `${order.createdBy.firstName} ${order.createdBy.lastName}`,
              describeOrderItems(order),
              formatPeso(order.subtotalAmount),
              formatPeso(order.discountAmount),
              formatPeso(order.taxAmount),
              formatPeso(order.totalAmount),
              order.payments.map((payment) => payment.method).join(" + "),
              order.status,
            ]),
          )}
        </div>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 250);

  return filename;
}

export function exportPosSalesAnalyticsCsv(snapshot: PosSalesAnalyticsExportSnapshot) {
  const filename = `${buildRangeBaseName("pos-sales-analytics", snapshot.filters.from, snapshot.filters.to)}.csv`;
  const lines: string[] = [];

  lines.push(createCsvRow(["POS Sales Analytics Export"]));
  lines.push(createCsvRow(["Generated At", new Date().toISOString()]));
  lines.push(createCsvRow(["From", snapshot.filters.from]));
  lines.push(createCsvRow(["To", snapshot.filters.to]));
  lines.push(createCsvRow(["Preset", snapshot.filters.preset]));
  lines.push(createCsvRow(["Grouping", snapshot.filters.groupBy]));
  lines.push(createCsvRow(["Staff Filter", snapshot.filters.staffSearch ?? ""]));
  lines.push(createCsvRow(["Payment Method", snapshot.filters.paymentMethod ?? ""]));
  lines.push("");

  appendCsvSection(lines, "Summary", ["Metric", "Value"], [
    ["Gross Sales", snapshot.report.summary.grossSales],
    ["Net Sales", snapshot.report.summary.netSales],
    ["Discounts", snapshot.report.summary.discounts],
    ["Refunds", snapshot.report.summary.refunds],
    ["Transaction Count", snapshot.report.summary.transactionCount],
    ["Average Ticket Size", snapshot.report.summary.averageTicketSize],
    [
      "Growth vs Previous Period",
      snapshot.report.comparison.previousPeriod.growthRate === null
        ? "N/A"
        : `${(snapshot.report.comparison.previousPeriod.growthRate * 100).toFixed(1)}%`,
    ],
  ]);

  appendCsvSection(
    lines,
    "Grouped Sales Analytics",
    [
      "Bucket",
      "Gross Sales",
      "Net Sales",
      "Discounts",
      "Refunds",
      "Transaction Count",
      "Average Ticket Size",
    ],
    snapshot.report.groups.map((group) => [
      group.label,
      group.grossSales,
      group.netSales,
      group.discounts,
      group.refunds,
      group.transactionCount,
      group.averageTicketSize,
    ]),
  );

  downloadTextFile(filename, `\uFEFF${lines.join("\r\n")}`, "text/csv;charset=utf-8");
  return filename;
}

export function exportPosSalesAnalyticsPdf(snapshot: PosSalesAnalyticsExportSnapshot) {
  if (typeof window === "undefined") {
    throw new Error("PDF exports are only available in the browser.");
  }

  const filename = `${buildRangeBaseName("pos-sales-analytics", snapshot.filters.from, snapshot.filters.to)}.pdf`;
  const printWindow = window.open("", "_blank", "noopener,noreferrer");

  if (!printWindow) {
    throw new Error("Unable to open a printable export window. Please allow pop-ups and try again.");
  }

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(filename)}</title>
        <style>
          @page { size: A4; margin: 16mm; }
          body { margin: 0; color: #1f2937; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.45; background: #ffffff; }
          .page { padding: 12px 0 24px; }
          h1 { margin: 0 0 8px; color: #0f172a; font-size: 24px; }
          .meta { margin-bottom: 18px; color: #475569; }
          .section { margin-top: 18px; break-inside: avoid; }
          h2 { margin: 0 0 10px; color: #0f172a; font-size: 16px; }
          .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .summary-card { border: 1px solid #dbe3ee; border-radius: 10px; padding: 12px; background: #f8fafc; }
          .summary-label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
          .summary-value { margin-top: 6px; color: #0f172a; font-size: 18px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; border: 1px solid #dbe3ee; border-radius: 10px; overflow: hidden; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; vertical-align: top; }
          th { background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
          td.empty { color: #64748b; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="page">
          <h1>POS Sales Analytics</h1>
          <div class="meta">
            <div><strong>Generated:</strong> ${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
            <div><strong>From:</strong> ${escapeHtml(snapshot.filters.from)}</div>
            <div><strong>To:</strong> ${escapeHtml(snapshot.filters.to)}</div>
            <div><strong>Preset:</strong> ${escapeHtml(snapshot.filters.preset)}</div>
            <div><strong>Grouping:</strong> ${escapeHtml(snapshot.filters.groupBy)}</div>
            <div><strong>Staff Filter:</strong> ${escapeHtml(snapshot.filters.staffSearch ?? "N/A")}</div>
            <div><strong>Payment Method:</strong> ${escapeHtml(snapshot.filters.paymentMethod ?? "N/A")}</div>
          </div>

          ${renderHtmlSummary("Summary", [
            { label: "Gross Sales", value: formatPeso(snapshot.report.summary.grossSales) },
            { label: "Net Sales", value: formatPeso(snapshot.report.summary.netSales) },
            { label: "Discounts", value: formatPeso(snapshot.report.summary.discounts) },
            { label: "Refunds", value: formatPeso(snapshot.report.summary.refunds) },
            { label: "Transactions", value: String(snapshot.report.summary.transactionCount) },
            { label: "Average Ticket", value: formatPeso(snapshot.report.summary.averageTicketSize) },
            {
              label: "Growth vs Previous Period",
              value:
                snapshot.report.comparison.previousPeriod.growthRate === null
                  ? "N/A"
                  : `${(snapshot.report.comparison.previousPeriod.growthRate * 100).toFixed(1)}%`,
            },
            {
              label: "Previous Net Sales",
              value: formatPeso(snapshot.report.comparison.previousPeriod.netSales),
            },
          ])}

          ${renderHtmlTable(
            "Grouped Sales Analytics",
            ["Bucket", "Gross Sales", "Net Sales", "Discounts", "Refunds", "Transactions", "Average Ticket"],
            snapshot.report.groups.map((group) => [
              group.label,
              formatPeso(group.grossSales),
              formatPeso(group.netSales),
              formatPeso(group.discounts),
              formatPeso(group.refunds),
              String(group.transactionCount),
              formatPeso(group.averageTicketSize),
            ]),
          )}
        </div>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 250);

  return filename;
}

export function exportPosPaymentReportsCsv(snapshot: PosPaymentReportsExportSnapshot) {
  const filename = `${buildRangeBaseName("pos-payment-reports", snapshot.filters.from, snapshot.filters.to)}.csv`;
  const lines: string[] = [];

  lines.push(createCsvRow(["POS Payment Reports Export"]));
  lines.push(createCsvRow(["Generated At", new Date().toISOString()]));
  lines.push(createCsvRow(["From", snapshot.filters.from]));
  lines.push(createCsvRow(["To", snapshot.filters.to]));
  lines.push("");

  appendCsvSection(lines, "Payment Summary", ["Metric", "Value"], [
    ["Total Collected", snapshot.report.summary.totalCollected],
    ["Completed Transactions", snapshot.report.summary.completedTransactionCount],
    ["Cash", snapshot.report.summary.cashTotal],
    ["Card", snapshot.report.summary.cardTotal],
    ["E-Wallet", snapshot.report.summary.ewalletTotal],
    ["Other", snapshot.report.summary.otherTotal],
    ["Split Payment Transactions", snapshot.report.summary.splitPaymentTransactionCount],
    ["Split Payment Collected", snapshot.report.summary.splitPaymentCollected],
  ]);

  appendCsvSection(
    lines,
    "Payment Breakdown",
    ["Method", "Amount", "Orders", "Payments", "Share of Collected"],
    snapshot.report.breakdown.map((row) => [
      row.method,
      row.amount,
      row.orderCount,
      row.paymentCount,
      row.shareOfCollected === null ? "N/A" : `${(row.shareOfCollected * 100).toFixed(1)}%`,
    ]),
  );

  appendCsvSection(
    lines,
    "Recent Split Payment Orders",
    ["Order ID", "Completed At", "Staff", "Total", "Payments"],
    snapshot.report.splitPaymentOrders.map((order) => [
      order.id,
      order.completedAt,
      `${order.createdBy.firstName} ${order.createdBy.lastName}`,
      order.totalAmount,
      order.payments.map((payment) => `${payment.method} ${payment.amount}`).join(" + "),
    ]),
  );

  downloadTextFile(filename, `\uFEFF${lines.join("\r\n")}`, "text/csv;charset=utf-8");
  return filename;
}

export function exportPosPaymentReportsPdf(snapshot: PosPaymentReportsExportSnapshot) {
  if (typeof window === "undefined") {
    throw new Error("PDF exports are only available in the browser.");
  }

  const filename = `${buildRangeBaseName("pos-payment-reports", snapshot.filters.from, snapshot.filters.to)}.pdf`;
  const printWindow = window.open("", "_blank", "noopener,noreferrer");

  if (!printWindow) {
    throw new Error("Unable to open a printable export window. Please allow pop-ups and try again.");
  }

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(filename)}</title>
        <style>
          @page { size: A4; margin: 16mm; }
          body { margin: 0; color: #1f2937; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.45; background: #ffffff; }
          .page { padding: 12px 0 24px; }
          h1 { margin: 0 0 8px; color: #0f172a; font-size: 24px; }
          .meta { margin-bottom: 18px; color: #475569; }
          .section { margin-top: 18px; break-inside: avoid; }
          h2 { margin: 0 0 10px; color: #0f172a; font-size: 16px; }
          .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .summary-card { border: 1px solid #dbe3ee; border-radius: 10px; padding: 12px; background: #f8fafc; }
          .summary-label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
          .summary-value { margin-top: 6px; color: #0f172a; font-size: 18px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; border: 1px solid #dbe3ee; border-radius: 10px; overflow: hidden; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; vertical-align: top; }
          th { background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
          td.empty { color: #64748b; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="page">
          <h1>POS Payment Reports</h1>
          <div class="meta">
            <div><strong>Generated:</strong> ${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
            <div><strong>From:</strong> ${escapeHtml(snapshot.filters.from)}</div>
            <div><strong>To:</strong> ${escapeHtml(snapshot.filters.to)}</div>
          </div>

          ${renderHtmlSummary("Payment Summary", [
            { label: "Total Collected", value: formatPeso(snapshot.report.summary.totalCollected) },
            { label: "Completed Transactions", value: String(snapshot.report.summary.completedTransactionCount) },
            { label: "Cash", value: formatPeso(snapshot.report.summary.cashTotal) },
            { label: "Card", value: formatPeso(snapshot.report.summary.cardTotal) },
            { label: "E-Wallet", value: formatPeso(snapshot.report.summary.ewalletTotal) },
            { label: "Other", value: formatPeso(snapshot.report.summary.otherTotal) },
            { label: "Split Payment Transactions", value: String(snapshot.report.summary.splitPaymentTransactionCount) },
            { label: "Split Payment Collected", value: formatPeso(snapshot.report.summary.splitPaymentCollected) },
          ])}

          ${renderHtmlTable(
            "Payment Breakdown",
            ["Method", "Amount", "Orders", "Payments", "Share"],
            snapshot.report.breakdown.map((row) => [
              row.method,
              formatPeso(row.amount),
              String(row.orderCount),
              String(row.paymentCount),
              row.shareOfCollected === null ? "N/A" : `${(row.shareOfCollected * 100).toFixed(1)}%`,
            ]),
          )}

          ${renderHtmlTable(
            "Recent Split Payment Orders",
            ["Order ID", "Completed At", "Staff", "Total", "Payments"],
            snapshot.report.splitPaymentOrders.map((order) => [
              order.id,
              formatDateTime(order.completedAt),
              `${order.createdBy.firstName} ${order.createdBy.lastName}`,
              formatPeso(order.totalAmount),
              order.payments.map((payment) => `${payment.method} ${formatPeso(payment.amount)}`).join(" + "),
            ]),
          )}
        </div>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 250);

  return filename;
}

export function exportPosRefundsVoidsCsv(snapshot: PosRefundsVoidsExportSnapshot) {
  const filename = `${buildRangeBaseName("pos-refunds-voids", snapshot.filters.from, snapshot.filters.to)}.csv`;
  const lines: string[] = [];

  lines.push(createCsvRow(["POS Refunds & Voids Export"]));
  lines.push(createCsvRow(["Generated At", new Date().toISOString()]));
  lines.push(createCsvRow(["From", snapshot.filters.from]));
  lines.push(createCsvRow(["To", snapshot.filters.to]));
  lines.push(createCsvRow(["Staff Filter", snapshot.filters.staffSearch ?? ""]));
  lines.push("");

  appendCsvSection(lines, "Summary", ["Metric", "Value"], [
    ["Refund Count", snapshot.report.summary.refundCount],
    ["Refunded Amount", snapshot.report.summary.refundedAmount],
    ["Void Count", snapshot.report.summary.voidCount],
    ["Voided Amount", snapshot.report.summary.voidedAmount],
    ["Total Reversals", snapshot.report.summary.totalReversalCount],
  ]);

  appendCsvSection(
    lines,
    "Reasons",
    ["Type", "Reason Code", "Count", "Amount"],
    snapshot.report.byReason.map((row) => [
      row.type,
      row.reasonCode,
      row.count,
      row.amount,
    ]),
  );

  appendCsvSection(
    lines,
    "Responsible Staff",
    ["Staff", "Email", "Reversals", "Refunds", "Voids", "Refunded Amount", "Voided Amount"],
    snapshot.report.byStaff.map((row) => [
      `${row.responsibleStaff.firstName} ${row.responsibleStaff.lastName}`,
      row.responsibleStaff.email,
      row.reversalCount,
      row.refundCount,
      row.voidCount,
      row.refundedAmount,
      row.voidedAmount,
    ]),
  );

  appendCsvSection(
    lines,
    "Reversal Events",
    [
      "Order ID",
      "Type",
      "Occurred At",
      "Reason",
      "Amount",
      "Responsible Staff",
      "Reversal Actor",
      "Requested By",
      "Approved By",
      "Payment Reference",
      "Note",
    ],
    snapshot.report.reversals.map((reversal) => [
      reversal.orderId,
      reversal.type,
      reversal.occurredAt,
      reversal.reasonCode,
      reversal.amount,
      `${reversal.responsibleStaff.firstName} ${reversal.responsibleStaff.lastName}`,
      `${reversal.reversalActor.firstName} ${reversal.reversalActor.lastName}`,
      reversal.approvalContext.requestedBy
        ? `${reversal.approvalContext.requestedBy.firstName} ${reversal.approvalContext.requestedBy.lastName}`
        : reversal.approvalContext.requestedByUserId ?? "",
      reversal.approvalContext.approvedByEmail ?? "",
      reversal.paymentReference ?? "",
      reversal.note ?? "",
    ]),
  );

  downloadTextFile(filename, `\uFEFF${lines.join("\r\n")}`, "text/csv;charset=utf-8");
  return filename;
}

export function exportPosRefundsVoidsPdf(snapshot: PosRefundsVoidsExportSnapshot) {
  if (typeof window === "undefined") {
    throw new Error("PDF exports are only available in the browser.");
  }

  const filename = `${buildRangeBaseName("pos-refunds-voids", snapshot.filters.from, snapshot.filters.to)}.pdf`;
  const printWindow = window.open("", "_blank", "noopener,noreferrer");

  if (!printWindow) {
    throw new Error("Unable to open a printable export window. Please allow pop-ups and try again.");
  }

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(filename)}</title>
        <style>
          @page { size: A4; margin: 16mm; }
          body { margin: 0; color: #1f2937; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.45; background: #ffffff; }
          .page { padding: 12px 0 24px; }
          h1 { margin: 0 0 8px; color: #0f172a; font-size: 24px; }
          .meta { margin-bottom: 18px; color: #475569; }
          .section { margin-top: 18px; break-inside: avoid; }
          h2 { margin: 0 0 10px; color: #0f172a; font-size: 16px; }
          .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .summary-card { border: 1px solid #dbe3ee; border-radius: 10px; padding: 12px; background: #f8fafc; }
          .summary-label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
          .summary-value { margin-top: 6px; color: #0f172a; font-size: 18px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; border: 1px solid #dbe3ee; border-radius: 10px; overflow: hidden; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; vertical-align: top; }
          th { background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
          td.empty { color: #64748b; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="page">
          <h1>POS Refunds & Voids</h1>
          <div class="meta">
            <div><strong>Generated:</strong> ${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
            <div><strong>From:</strong> ${escapeHtml(snapshot.filters.from)}</div>
            <div><strong>To:</strong> ${escapeHtml(snapshot.filters.to)}</div>
            <div><strong>Staff Filter:</strong> ${escapeHtml(snapshot.filters.staffSearch ?? "N/A")}</div>
          </div>

          ${renderHtmlSummary("Summary", [
            { label: "Refund Count", value: String(snapshot.report.summary.refundCount) },
            { label: "Refunded Amount", value: formatPeso(snapshot.report.summary.refundedAmount) },
            { label: "Void Count", value: String(snapshot.report.summary.voidCount) },
            { label: "Voided Amount", value: formatPeso(snapshot.report.summary.voidedAmount) },
            { label: "Total Reversals", value: String(snapshot.report.summary.totalReversalCount) },
          ])}

          ${renderHtmlTable(
            "Reasons",
            ["Type", "Reason Code", "Count", "Amount"],
            snapshot.report.byReason.map((row) => [
              row.type,
              row.reasonCode,
              String(row.count),
              formatPeso(row.amount),
            ]),
          )}

          ${renderHtmlTable(
            "Responsible Staff",
            ["Staff", "Email", "Reversals", "Refunds", "Voids", "Refunded Amount", "Voided Amount"],
            snapshot.report.byStaff.map((row) => [
              `${row.responsibleStaff.firstName} ${row.responsibleStaff.lastName}`,
              row.responsibleStaff.email,
              String(row.reversalCount),
              String(row.refundCount),
              String(row.voidCount),
              formatPeso(row.refundedAmount),
              formatPeso(row.voidedAmount),
            ]),
          )}

          ${renderHtmlTable(
            "Reversal Events",
            ["Order ID", "Type", "Occurred At", "Reason", "Amount", "Responsible Staff", "Reversal Actor", "Requested By", "Approved By"],
            snapshot.report.reversals.map((reversal) => [
              reversal.orderId,
              reversal.type,
              formatDateTime(reversal.occurredAt),
              reversal.reasonCode,
              formatPeso(reversal.amount),
              `${reversal.responsibleStaff.firstName} ${reversal.responsibleStaff.lastName}`,
              `${reversal.reversalActor.firstName} ${reversal.reversalActor.lastName}`,
              reversal.approvalContext.requestedBy
                ? `${reversal.approvalContext.requestedBy.firstName} ${reversal.approvalContext.requestedBy.lastName}`
                : reversal.approvalContext.requestedByUserId ?? "N/A",
              reversal.approvalContext.approvedByEmail ?? "N/A",
            ]),
          )}
        </div>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 250);

  return filename;
}

export function exportPosProductPerformanceCsv(
  snapshot: PosProductPerformanceExportSnapshot,
) {
  const filename = `${buildRangeBaseName("pos-product-performance", snapshot.filters.from, snapshot.filters.to)}.csv`;
  const lines: string[] = [];

  lines.push(createCsvRow(["POS Product Performance Export"]));
  lines.push(createCsvRow(["Generated At", new Date().toISOString()]));
  lines.push(createCsvRow(["From", snapshot.filters.from]));
  lines.push(createCsvRow(["To", snapshot.filters.to]));
  lines.push(createCsvRow(["Category Filter", snapshot.filters.categoryName ?? "All categories"]));
  lines.push(createCsvRow(["Category Attribution", snapshot.report.categoryAttributionMode]));
  lines.push("");

  appendCsvSection(lines, "Summary", ["Metric", "Value"], [
    ["Products Considered", snapshot.report.summary.totalProductsConsidered],
    ["Selling Products", snapshot.report.summary.sellingProductsCount],
    ["Total Quantity Sold", snapshot.report.summary.totalQuantitySold],
    ["Total Revenue", snapshot.report.summary.totalRevenue],
    ["Total Gross Margin", snapshot.report.summary.totalGrossMargin],
  ]);

  appendCsvSection(
    lines,
    "Top Sellers by Quantity",
    ["Product", "Category", "Qty Sold", "Revenue", "Gross Margin", "Contribution"],
    snapshot.report.topSellersByQuantity.map((row) => [
      row.productName,
      row.category.name,
      row.quantitySold,
      row.revenue,
      row.grossMargin,
      row.contributionPercentage === null ? "N/A" : `${(row.contributionPercentage * 100).toFixed(1)}%`,
    ]),
  );

  appendCsvSection(
    lines,
    "Top Products by Revenue",
    ["Product", "Category", "Revenue", "Qty Sold", "Gross Margin", "Contribution"],
    snapshot.report.topProductsByRevenue.map((row) => [
      row.productName,
      row.category.name,
      row.revenue,
      row.quantitySold,
      row.grossMargin,
      row.contributionPercentage === null ? "N/A" : `${(row.contributionPercentage * 100).toFixed(1)}%`,
    ]),
  );

  appendCsvSection(
    lines,
    "Slow-Moving Products",
    ["Product", "Category", "Qty Sold", "Revenue", "Gross Margin"],
    snapshot.report.slowMovingProducts.map((row) => [
      row.productName,
      row.category.name,
      row.quantitySold,
      row.revenue,
      row.grossMargin,
    ]),
  );

  appendCsvSection(
    lines,
    "Top Categories",
    ["Category", "Qty Sold", "Revenue", "Gross Margin", "Contribution"],
    snapshot.report.topCategories.map((row) => [
      row.categoryName,
      row.quantitySold,
      row.revenue,
      row.grossMargin,
      row.contributionPercentage === null ? "N/A" : `${(row.contributionPercentage * 100).toFixed(1)}%`,
    ]),
  );

  appendCsvSection(
    lines,
    "Product Table",
    ["Product", "Category", "Variants", "Orders", "Qty Sold", "Revenue", "COGS", "Gross Margin", "Contribution", "Margin Rate"],
    snapshot.report.products.map((row) => [
      row.productName,
      row.category.name,
      row.variantCount,
      row.orderCount,
      row.quantitySold,
      row.revenue,
      row.cogs,
      row.grossMargin,
      row.contributionPercentage === null ? "N/A" : `${(row.contributionPercentage * 100).toFixed(1)}%`,
      row.marginRate === null ? "N/A" : `${(row.marginRate * 100).toFixed(1)}%`,
    ]),
  );

  downloadTextFile(filename, `\uFEFF${lines.join("\r\n")}`, "text/csv;charset=utf-8");
  return filename;
}

export function exportPosProductPerformancePdf(
  snapshot: PosProductPerformanceExportSnapshot,
) {
  if (typeof window === "undefined") {
    throw new Error("PDF exports are only available in the browser.");
  }

  const filename = `${buildRangeBaseName("pos-product-performance", snapshot.filters.from, snapshot.filters.to)}.pdf`;
  const printWindow = window.open("", "_blank", "noopener,noreferrer");

  if (!printWindow) {
    throw new Error("Unable to open a printable export window. Please allow pop-ups and try again.");
  }

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(filename)}</title>
        <style>
          @page { size: A4; margin: 16mm; }
          body { margin: 0; color: #1f2937; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.45; background: #ffffff; }
          .page { padding: 12px 0 24px; }
          h1 { margin: 0 0 8px; color: #0f172a; font-size: 24px; }
          .meta { margin-bottom: 18px; color: #475569; }
          .section { margin-top: 18px; break-inside: avoid; }
          h2 { margin: 0 0 10px; color: #0f172a; font-size: 16px; }
          .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .summary-card { border: 1px solid #dbe3ee; border-radius: 10px; padding: 12px; background: #f8fafc; }
          .summary-label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
          .summary-value { margin-top: 6px; color: #0f172a; font-size: 18px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; border: 1px solid #dbe3ee; border-radius: 10px; overflow: hidden; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; vertical-align: top; }
          th { background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
          td.empty { color: #64748b; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="page">
          <h1>POS Product Performance</h1>
          <div class="meta">
            <div><strong>Generated:</strong> ${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
            <div><strong>From:</strong> ${escapeHtml(snapshot.filters.from)}</div>
            <div><strong>To:</strong> ${escapeHtml(snapshot.filters.to)}</div>
            <div><strong>Category Filter:</strong> ${escapeHtml(snapshot.filters.categoryName ?? "All categories")}</div>
            <div><strong>Category Attribution:</strong> ${escapeHtml(snapshot.report.categoryAttributionMode)}</div>
          </div>

          ${renderHtmlSummary("Summary", [
            { label: "Products Considered", value: String(snapshot.report.summary.totalProductsConsidered) },
            { label: "Selling Products", value: String(snapshot.report.summary.sellingProductsCount) },
            { label: "Total Quantity Sold", value: String(snapshot.report.summary.totalQuantitySold) },
            { label: "Total Revenue", value: formatPeso(snapshot.report.summary.totalRevenue) },
            { label: "Total Gross Margin", value: formatPeso(snapshot.report.summary.totalGrossMargin) },
          ])}

          ${renderHtmlTable(
            "Top Sellers by Quantity",
            ["Product", "Category", "Qty Sold", "Revenue", "Gross Margin", "Contribution"],
            snapshot.report.topSellersByQuantity.map((row) => [
              row.productName,
              row.category.name,
              String(row.quantitySold),
              formatPeso(row.revenue),
              formatPeso(row.grossMargin),
              row.contributionPercentage === null ? "N/A" : `${(row.contributionPercentage * 100).toFixed(1)}%`,
            ]),
          )}

          ${renderHtmlTable(
            "Top Categories",
            ["Category", "Qty Sold", "Revenue", "Gross Margin", "Contribution"],
            snapshot.report.topCategories.map((row) => [
              row.categoryName,
              String(row.quantitySold),
              formatPeso(row.revenue),
              formatPeso(row.grossMargin),
              row.contributionPercentage === null ? "N/A" : `${(row.contributionPercentage * 100).toFixed(1)}%`,
            ]),
          )}

          ${renderHtmlTable(
            "Product Table",
            ["Product", "Category", "Variants", "Orders", "Qty Sold", "Revenue", "COGS", "Gross Margin", "Contribution", "Margin Rate"],
            snapshot.report.products.map((row) => [
              row.productName,
              row.category.name,
              String(row.variantCount),
              String(row.orderCount),
              String(row.quantitySold),
              formatPeso(row.revenue),
              formatPeso(row.cogs),
              formatPeso(row.grossMargin),
              row.contributionPercentage === null ? "N/A" : `${(row.contributionPercentage * 100).toFixed(1)}%`,
              row.marginRate === null ? "N/A" : `${(row.marginRate * 100).toFixed(1)}%`,
            ]),
          )}
        </div>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 250);

  return filename;
}

export function exportPosStaffPerformanceCsv(snapshot: PosStaffPerformanceExportSnapshot) {
  const filename = `${buildRangeBaseName("pos-staff-performance", snapshot.filters.from, snapshot.filters.to)}.csv`;
  const lines: string[] = [];

  lines.push(createCsvRow(["POS Staff Performance Export"]));
  lines.push(createCsvRow(["Generated At", new Date().toISOString()]));
  lines.push(createCsvRow(["From", snapshot.filters.from]));
  lines.push(createCsvRow(["To", snapshot.filters.to]));
  lines.push("");

  appendCsvSection(lines, "Summary", ["Metric", "Value"], [
    ["Staff Count", snapshot.report.summary.staffCount],
    ["Total Net Sales", snapshot.report.summary.totalNetSales],
    ["Total Transactions", snapshot.report.summary.totalTransactions],
    ["Total Discounts", snapshot.report.summary.totalDiscounts],
    ["Refunds Handled", snapshot.report.summary.totalRefundsHandled],
    ["Voids Handled", snapshot.report.summary.totalVoidsHandled],
  ]);

  appendCsvSection(
    lines,
    "Staff Comparison",
    ["Staff", "Email", "Gross Sales", "Net Sales", "Transactions", "Average Order Value", "Discounts", "Refunds Handled", "Refunded Amount", "Voids Handled", "Voided Amount"],
    snapshot.report.staff.map((row) => [
      `${row.staff.firstName} ${row.staff.lastName}`,
      row.staff.email,
      row.grossSales,
      row.netSales,
      row.transactionCount,
      row.averageOrderValue,
      row.discounts,
      row.refundCount,
      row.refundedAmount,
      row.voidCount,
      row.voidedAmount,
    ]),
  );

  downloadTextFile(filename, `\uFEFF${lines.join("\r\n")}`, "text/csv;charset=utf-8");
  return filename;
}

export function exportPosStaffPerformancePdf(snapshot: PosStaffPerformanceExportSnapshot) {
  if (typeof window === "undefined") {
    throw new Error("PDF exports are only available in the browser.");
  }

  const filename = `${buildRangeBaseName("pos-staff-performance", snapshot.filters.from, snapshot.filters.to)}.pdf`;
  const printWindow = window.open("", "_blank", "noopener,noreferrer");

  if (!printWindow) {
    throw new Error("Unable to open a printable export window. Please allow pop-ups and try again.");
  }

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(filename)}</title>
        <style>
          @page { size: A4; margin: 16mm; }
          body { margin: 0; color: #1f2937; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.45; background: #ffffff; }
          .page { padding: 12px 0 24px; }
          h1 { margin: 0 0 8px; color: #0f172a; font-size: 24px; }
          .meta { margin-bottom: 18px; color: #475569; }
          .section { margin-top: 18px; break-inside: avoid; }
          h2 { margin: 0 0 10px; color: #0f172a; font-size: 16px; }
          .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .summary-card { border: 1px solid #dbe3ee; border-radius: 10px; padding: 12px; background: #f8fafc; }
          .summary-label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
          .summary-value { margin-top: 6px; color: #0f172a; font-size: 18px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; border: 1px solid #dbe3ee; border-radius: 10px; overflow: hidden; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; vertical-align: top; }
          th { background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
          td.empty { color: #64748b; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="page">
          <h1>POS Staff Performance</h1>
          <div class="meta">
            <div><strong>Generated:</strong> ${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
            <div><strong>From:</strong> ${escapeHtml(snapshot.filters.from)}</div>
            <div><strong>To:</strong> ${escapeHtml(snapshot.filters.to)}</div>
          </div>

          ${renderHtmlSummary("Summary", [
            { label: "Staff Count", value: String(snapshot.report.summary.staffCount) },
            { label: "Total Net Sales", value: formatPeso(snapshot.report.summary.totalNetSales) },
            { label: "Total Transactions", value: String(snapshot.report.summary.totalTransactions) },
            { label: "Total Discounts", value: formatPeso(snapshot.report.summary.totalDiscounts) },
            { label: "Refunds Handled", value: String(snapshot.report.summary.totalRefundsHandled) },
            { label: "Voids Handled", value: String(snapshot.report.summary.totalVoidsHandled) },
          ])}

          ${renderHtmlTable(
            "Staff Comparison",
            ["Staff", "Email", "Gross Sales", "Net Sales", "Transactions", "Average Order Value", "Discounts", "Refunds Handled", "Refunded Amount", "Voids Handled", "Voided Amount"],
            snapshot.report.staff.map((row) => [
              `${row.staff.firstName} ${row.staff.lastName}`,
              row.staff.email,
              formatPeso(row.grossSales),
              formatPeso(row.netSales),
              String(row.transactionCount),
              formatPeso(row.averageOrderValue),
              formatPeso(row.discounts),
              String(row.refundCount),
              formatPeso(row.refundedAmount),
              String(row.voidCount),
              formatPeso(row.voidedAmount),
            ]),
          )}
        </div>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 250);

  return filename;
}

export function exportPosPeakHoursCsv(snapshot: PosPeakHoursExportSnapshot) {
  const filename = `${buildRangeBaseName("pos-peak-hours", snapshot.filters.from, snapshot.filters.to)}.csv`;
  const lines: string[] = [];

  lines.push(createCsvRow(["POS Peak Hours Export"]));
  lines.push(createCsvRow(["Generated At", new Date().toISOString()]));
  lines.push(createCsvRow(["From", snapshot.filters.from]));
  lines.push(createCsvRow(["To", snapshot.filters.to]));
  lines.push(createCsvRow(["Day Type", snapshot.filters.dayType]));
  lines.push("");

  appendCsvSection(lines, "Summary", ["Metric", "Value"], [
    ["Total Transactions", snapshot.report.summary.totalTransactions],
    ["Total Net Sales", snapshot.report.summary.totalNetSales],
    ["Busiest Hour", snapshot.report.summary.busiestHour?.label ?? "N/A"],
    ["Slowest Hour", snapshot.report.summary.slowestHour?.label ?? "N/A"],
  ]);

  appendCsvSection(
    lines,
    "Hourly Sales",
    ["Hour", "Transactions", "Gross Sales", "Net Sales", "Average Ticket"],
    snapshot.report.hourly.map((row) => [
      row.label,
      row.transactionCount,
      row.grossSales,
      row.netSales,
      row.averageTicketSize,
    ]),
  );

  downloadTextFile(filename, `\uFEFF${lines.join("\r\n")}`, "text/csv;charset=utf-8");
  return filename;
}

export function exportPosPeakHoursPdf(snapshot: PosPeakHoursExportSnapshot) {
  if (typeof window === "undefined") {
    throw new Error("PDF exports are only available in the browser.");
  }

  const filename = `${buildRangeBaseName("pos-peak-hours", snapshot.filters.from, snapshot.filters.to)}.pdf`;
  const printWindow = window.open("", "_blank", "noopener,noreferrer");

  if (!printWindow) {
    throw new Error("Unable to open a printable export window. Please allow pop-ups and try again.");
  }

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(filename)}</title>
        <style>
          @page { size: A4; margin: 16mm; }
          body { margin: 0; color: #1f2937; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.45; background: #ffffff; }
          .page { padding: 12px 0 24px; }
          h1 { margin: 0 0 8px; color: #0f172a; font-size: 24px; }
          .meta { margin-bottom: 18px; color: #475569; }
          .section { margin-top: 18px; break-inside: avoid; }
          h2 { margin: 0 0 10px; color: #0f172a; font-size: 16px; }
          .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .summary-card { border: 1px solid #dbe3ee; border-radius: 10px; padding: 12px; background: #f8fafc; }
          .summary-label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
          .summary-value { margin-top: 6px; color: #0f172a; font-size: 18px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; border: 1px solid #dbe3ee; border-radius: 10px; overflow: hidden; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; vertical-align: top; }
          th { background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
          td.empty { color: #64748b; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="page">
          <h1>POS Peak Hours</h1>
          <div class="meta">
            <div><strong>Generated:</strong> ${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
            <div><strong>From:</strong> ${escapeHtml(snapshot.filters.from)}</div>
            <div><strong>To:</strong> ${escapeHtml(snapshot.filters.to)}</div>
            <div><strong>Day Type:</strong> ${escapeHtml(snapshot.filters.dayType)}</div>
          </div>

          ${renderHtmlSummary("Summary", [
            { label: "Total Transactions", value: String(snapshot.report.summary.totalTransactions) },
            { label: "Total Net Sales", value: formatPeso(snapshot.report.summary.totalNetSales) },
            { label: "Busiest Hour", value: snapshot.report.summary.busiestHour?.label ?? "N/A" },
            { label: "Slowest Hour", value: snapshot.report.summary.slowestHour?.label ?? "N/A" },
          ])}

          ${renderHtmlTable(
            "Hourly Sales",
            ["Hour", "Transactions", "Gross Sales", "Net Sales", "Average Ticket"],
            snapshot.report.hourly.map((row) => [
              row.label,
              String(row.transactionCount),
              formatPeso(row.grossSales),
              formatPeso(row.netSales),
              formatPeso(row.averageTicketSize),
            ]),
          )}
        </div>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 250);

  return filename;
}

export function exportPosInventoryLinkedCsv(
  snapshot: PosInventoryLinkedExportSnapshot,
) {
  const filename = `${buildRangeBaseName("pos-inventory-linked", snapshot.filters.from, snapshot.filters.to)}.csv`;
  const lines: string[] = [];

  lines.push(createCsvRow(["POS Inventory-Linked Report Export"]));
  lines.push(createCsvRow(["Generated At", new Date().toISOString()]));
  lines.push(createCsvRow(["From", snapshot.filters.from]));
  lines.push(createCsvRow(["To", snapshot.filters.to]));
  lines.push(createCsvRow(["Variant Search", snapshot.filters.variantSearch ?? ""]));
  lines.push(createCsvRow(["Material Search", snapshot.filters.materialSearch ?? ""]));
  lines.push(
    createCsvRow([
      "Drill-down Variant",
      snapshot.filters.drilldownVariantName ?? "None selected",
    ]),
  );
  lines.push("");
  appendPosInventoryLinkedCsvSections(lines, snapshot);

  downloadTextFile(filename, `\uFEFF${lines.join("\r\n")}`, "text/csv;charset=utf-8");
  return filename;
}

export function exportPosInventoryLinkedPdf(
  snapshot: PosInventoryLinkedExportSnapshot,
) {
  if (typeof window === "undefined") {
    throw new Error("PDF exports are only available in the browser.");
  }

  const filename = `${buildRangeBaseName("pos-inventory-linked", snapshot.filters.from, snapshot.filters.to)}.pdf`;
  const printWindow = window.open("", "_blank", "noopener,noreferrer");

  if (!printWindow) {
    throw new Error("Unable to open a printable export window. Please allow pop-ups and try again.");
  }

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(filename)}</title>
        <style>
          @page { size: A4; margin: 16mm; }
          body { margin: 0; color: #1f2937; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.45; background: #ffffff; }
          .page { padding: 12px 0 24px; }
          h1 { margin: 0 0 8px; color: #0f172a; font-size: 24px; }
          .meta { margin-bottom: 18px; color: #475569; }
          .section { margin-top: 18px; break-inside: avoid; }
          h2 { margin: 0 0 10px; color: #0f172a; font-size: 16px; }
          .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .summary-card { border: 1px solid #dbe3ee; border-radius: 10px; padding: 12px; background: #f8fafc; }
          .summary-label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
          .summary-value { margin-top: 6px; color: #0f172a; font-size: 18px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; border: 1px solid #dbe3ee; border-radius: 10px; overflow: hidden; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; vertical-align: top; }
          th { background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
          td.empty { color: #64748b; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="page">
          <h1>POS Inventory-Linked Report</h1>
          <div class="meta">
            <div><strong>Generated:</strong> ${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
            <div><strong>From:</strong> ${escapeHtml(snapshot.filters.from)}</div>
            <div><strong>To:</strong> ${escapeHtml(snapshot.filters.to)}</div>
          <div><strong>Variant Search:</strong> ${escapeHtml(snapshot.filters.variantSearch ?? "None")}</div>
          <div><strong>Material Search:</strong> ${escapeHtml(snapshot.filters.materialSearch ?? "None")}</div>
          <div><strong>Drill-down Variant:</strong> ${escapeHtml(snapshot.filters.drilldownVariantName ?? "None selected")}</div>
        </div>

          ${renderPosInventoryLinkedHtmlSections(snapshot)}
        </div>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 250);

  return filename;
}

export function exportPosAuditExceptionsCsv(
  snapshot: PosAuditExceptionsExportSnapshot,
) {
  const filename = `${buildRangeBaseName("pos-audit-exceptions", snapshot.filters.from, snapshot.filters.to)}.csv`;
  const lines: string[] = [];

  lines.push(createCsvRow(["POS Audit & Exceptions Export"]));
  lines.push(createCsvRow(["Generated At", new Date().toISOString()]));
  lines.push(createCsvRow(["From", snapshot.filters.from]));
  lines.push(createCsvRow(["To", snapshot.filters.to]));
  lines.push(createCsvRow(["Staff/User Filter", snapshot.filters.staffSearch ?? ""]));
  lines.push(createCsvRow(["Reason Filter", snapshot.filters.reasonSearch ?? ""]));
  lines.push(createCsvRow(["Status Filter", snapshot.filters.status ?? ""]));
  lines.push(createCsvRow(["Exception Type", snapshot.filters.exceptionType ?? "ALL"]));
  lines.push(createCsvRow(["Page", snapshot.filters.page]));
  lines.push(createCsvRow(["Page Size", snapshot.filters.pageSize]));
  lines.push("");

  appendCsvSection(lines, "Summary", ["Metric", "Value"], [
    ["Total Exceptions", snapshot.report.summary.totalExceptions],
    ["Refund Count", snapshot.report.summary.refundCount],
    ["Refunded Amount", snapshot.report.summary.refundedAmount],
    ["Void Count", snapshot.report.summary.voidCount],
    ["Voided Amount", snapshot.report.summary.voidedAmount],
    ["Discount Count", snapshot.report.summary.discountCount],
    ["Discounted Amount", snapshot.report.summary.discountedAmount],
  ]);

  appendCsvSection(
    lines,
    "Audit & Exceptions",
    [
      "Occurred At",
      "Type",
      "Order ID",
      "Status",
      "Reason / Discount",
      "Amount",
      "Responsible User",
      "Requested By",
      "Approved By",
      "Payment Reference",
      "Note",
    ],
    snapshot.report.rows.map((row) => [
      row.occurredAt,
      row.kind,
      row.orderId,
      row.orderStatus,
      row.kind === "DISCOUNT"
        ? row.discountDetails?.discountCode ?? "ORDER_LEVEL_DISCOUNT"
        : row.reasonCode ?? "",
      row.amount,
      `${row.responsibleUser.firstName} ${row.responsibleUser.lastName}`,
      row.relatedUser
        ? `${row.relatedUser.firstName} ${row.relatedUser.lastName}`
        : row.approvalContext.requestedByUserId ?? "",
      row.approvalContext.approvedByEmail ?? "",
      row.paymentReference ?? "",
      row.note ?? "",
    ]),
  );

  downloadTextFile(filename, `\uFEFF${lines.join("\r\n")}`, "text/csv;charset=utf-8");
  return filename;
}

export function exportPosAuditExceptionsPdf(
  snapshot: PosAuditExceptionsExportSnapshot,
) {
  if (typeof window === "undefined") {
    throw new Error("PDF exports are only available in the browser.");
  }

  const filename = `${buildRangeBaseName("pos-audit-exceptions", snapshot.filters.from, snapshot.filters.to)}.pdf`;
  const printWindow = window.open("", "_blank", "noopener,noreferrer");

  if (!printWindow) {
    throw new Error("Unable to open a printable export window. Please allow pop-ups and try again.");
  }

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(filename)}</title>
        <style>
          @page { size: A4; margin: 16mm; }
          body { margin: 0; color: #1f2937; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.45; background: #ffffff; }
          .page { padding: 12px 0 24px; }
          h1 { margin: 0 0 8px; color: #0f172a; font-size: 24px; }
          .meta { margin-bottom: 18px; color: #475569; }
          .section { margin-top: 18px; break-inside: avoid; }
          h2 { margin: 0 0 10px; color: #0f172a; font-size: 16px; }
          .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .summary-card { border: 1px solid #dbe3ee; border-radius: 10px; padding: 12px; background: #f8fafc; }
          .summary-label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
          .summary-value { margin-top: 6px; color: #0f172a; font-size: 18px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; border: 1px solid #dbe3ee; border-radius: 10px; overflow: hidden; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; vertical-align: top; }
          th { background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
          td.empty { color: #64748b; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="page">
          <h1>POS Audit & Exceptions</h1>
          <div class="meta">
            <div><strong>Generated:</strong> ${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
            <div><strong>From:</strong> ${escapeHtml(snapshot.filters.from)}</div>
            <div><strong>To:</strong> ${escapeHtml(snapshot.filters.to)}</div>
            <div><strong>Filters:</strong> Staff=${escapeHtml(snapshot.filters.staffSearch ?? "N/A")} | Reason=${escapeHtml(snapshot.filters.reasonSearch ?? "N/A")} | Status=${escapeHtml(snapshot.filters.status ?? "N/A")} | Type=${escapeHtml(snapshot.filters.exceptionType ?? "ALL")}</div>
            <div><strong>Page:</strong> ${snapshot.filters.page} of ${snapshot.report.pagination.totalPages || 1}</div>
          </div>

          ${renderHtmlSummary("Summary", [
            { label: "Total Exceptions", value: String(snapshot.report.summary.totalExceptions) },
            { label: "Refund Count", value: String(snapshot.report.summary.refundCount) },
            { label: "Refunded Amount", value: formatPeso(snapshot.report.summary.refundedAmount) },
            { label: "Void Count", value: String(snapshot.report.summary.voidCount) },
            { label: "Voided Amount", value: formatPeso(snapshot.report.summary.voidedAmount) },
            { label: "Discount Count", value: String(snapshot.report.summary.discountCount) },
            { label: "Discounted Amount", value: formatPeso(snapshot.report.summary.discountedAmount) },
          ])}

          ${renderHtmlTable(
            "Audit & Exceptions",
            ["Occurred At", "Type", "Order ID", "Status", "Reason / Discount", "Amount", "Responsible User", "Requested By", "Approved By", "Payment Reference", "Note"],
            snapshot.report.rows.map((row) => [
              formatDateTime(row.occurredAt),
              row.kind,
              row.orderId,
              row.orderStatus,
              row.kind === "DISCOUNT"
                ? row.discountDetails?.discountCode ?? "ORDER_LEVEL_DISCOUNT"
                : row.reasonCode ?? "N/A",
              formatPeso(row.amount),
              `${row.responsibleUser.firstName} ${row.responsibleUser.lastName}`,
              row.relatedUser
                ? `${row.relatedUser.firstName} ${row.relatedUser.lastName}`
                : row.approvalContext.requestedByUserId ?? "N/A",
              row.approvalContext.approvedByEmail ?? "N/A",
              row.paymentReference ?? "N/A",
              row.note ?? "",
            ]),
          )}
        </div>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 250);

  return filename;
}
