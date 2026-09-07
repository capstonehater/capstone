import type {
  DeleteEligibilityDto,
  ProductCategoryDto,
  ProductDetailDto,
  ProductIngredientUsageDto,
  ProductListItemDto,
  ProductListResponseDto,
  VariantRecipeDto,
} from "./dto";
import type {
  DeleteEligibility,
  ProductCategory,
  ProductDetail,
  ProductEffectiveStatus,
  ProductIngredientUsage,
  ProductListItem,
  ProductListResponse,
  ProductManualAvailability,
  ProductQualityWarning,
  ProductRecipe,
  ProductStockAvailability,
  ProductVariantDetail,
} from "./types";

const effectiveStatusLabels: Record<ProductEffectiveStatus, string> = {
  SELLABLE: "Sellable",
  PARTIALLY_AVAILABLE: "Partially Available",
  MANUALLY_DISABLED: "Manually Disabled",
  OUT_OF_STOCK: "Out of Stock",
  NO_VALID_RECIPE: "No Valid Recipe",
  NO_SELLABLE_VARIANT: "No Sellable Variant",
  ARCHIVED: "Archived",
  UNKNOWN: "Unknown",
};

function mapManualAvailability(value: boolean): ProductManualAvailability {
  return value ? "ENABLED" : "DISABLED";
}

function mapStockAvailability(value: string): ProductStockAvailability {
  if (value === "AVAILABLE" || value === "PARTIAL" || value === "UNAVAILABLE") {
    return value;
  }

  return "UNKNOWN";
}

export function mapEffectiveStatus(value: string): ProductEffectiveStatus {
  switch (value) {
    case "SELLABLE":
    case "PARTIALLY_AVAILABLE":
    case "MANUALLY_DISABLED":
    case "OUT_OF_STOCK":
    case "NO_VALID_RECIPE":
    case "NO_SELLABLE_VARIANT":
    case "ARCHIVED":
      return value;
    default:
      return "UNKNOWN";
  }
}

function buildQualityWarnings(detail: ProductDetail): ProductQualityWarning[] {
  const warnings: ProductQualityWarning[] = [];

  if (detail.variantCount === 0) {
    warnings.push({
      code: "NO_VARIANTS",
      message: "This product has no variants yet.",
      tone: "critical",
    });
  }

  if (
    detail.variantCount > 0 &&
    detail.variants.every((variant) => variant.ingredientCount === 0)
  ) {
    warnings.push({
      code: "NO_RECIPE",
      message: "None of the current variants have recipe ingredients configured.",
      tone: "warning",
    });
  }

  if (!detail.effectiveSellability) {
    warnings.push({
      code: "NOT_SELLABLE",
      message:
        detail.topBlockingReason ??
        "This product is not currently sellable in POS.",
      tone: "critical",
    });
  }

  if (detail.deleteEligibility.eligible === false) {
    warnings.push({
      code: "DELETE_BLOCKED",
      message: "Permanent delete is blocked by existing history or dependencies.",
      tone: "neutral",
    });
  }

  return warnings;
}

export function mapCategory(dto: ProductCategoryDto): ProductCategory {
  return dto;
}

export function mapDeleteEligibility(
  dto: DeleteEligibilityDto,
): DeleteEligibility {
  return dto;
}

export function mapProductListItem(dto: ProductListItemDto): ProductListItem {
  const effectiveStatus = mapEffectiveStatus(dto.effectiveStatus);

  return {
    id: dto.id,
    name: dto.name,
    category: dto.category,
    variantCount: dto.variantCount,
    ingredientCount: dto.ingredientCount,
    manualAvailability: mapManualAvailability(dto.manualAvailability),
    stockAvailability: {
      status: mapStockAvailability(dto.stockAvailability.status),
      sellableVariantCount: dto.stockAvailability.sellableVariantCount,
      totalVariantCount: dto.stockAvailability.totalVariantCount,
    },
    effectiveSellability: dto.effectiveSellability,
    effectiveStatus,
    effectiveStatusLabel: effectiveStatusLabels[effectiveStatus],
    topBlockingReason: dto.topBlockingReason,
    archivedAt: dto.archivedAt,
    updatedAt: dto.updatedAt,
  };
}

function mapVariant(dto: ProductDetailDto["variants"][number]): ProductVariantDetail {
  return {
    id: dto.id,
    name: dto.name,
    sku: dto.sku,
    price: dto.price,
    manualAvailability: mapManualAvailability(dto.manualAvailability),
    isInStock: dto.isInStock,
    isSellable: dto.isSellable,
    availableBaseQty: dto.availableBaseQty,
    blockingReason: dto.blockingReason,
    ingredientCount: dto.ingredientCount,
    recipeSummary: dto.recipeSummary,
  };
}

export function mapProductDetail(dto: ProductDetailDto): ProductDetail {
  const effectiveStatus = mapEffectiveStatus(dto.effectiveStatus);
  const detail: ProductDetail = {
    id: dto.id,
    name: dto.name,
    category: dto.category,
    manualAvailability: mapManualAvailability(dto.manualAvailability),
    archive: {
      state: dto.archive.archivedAt ? "ARCHIVED" : "ACTIVE",
      archivedAt: dto.archive.archivedAt,
      archiveReason: dto.archive.archiveReason,
      archivedBy: dto.archive.archivedBy,
    },
    effectiveStatus,
    effectiveStatusLabel: effectiveStatusLabels[effectiveStatus],
    effectiveSellability: dto.effectiveSellability,
    stockAvailability: {
      status: mapStockAvailability(dto.stockAvailability.status),
      sellableVariantCount: dto.stockAvailability.sellableVariantCount,
      totalVariantCount: dto.stockAvailability.totalVariantCount,
    },
    topBlockingReason: dto.topBlockingReason,
    variantCount: dto.variantCount,
    ingredientCount: dto.ingredientCount,
    deleteEligibility: mapDeleteEligibility(dto.deleteEligibility),
    variants: dto.variants.map(mapVariant),
    qualityWarnings: [],
    updatedAt: dto.updatedAt ?? new Date().toISOString(),
  };

  detail.qualityWarnings = buildQualityWarnings(detail);
  return detail;
}

export function mapRecipe(dto: VariantRecipeDto): ProductRecipe {
  return dto;
}

export function mapUsage(
  dto: ProductIngredientUsageDto,
): ProductIngredientUsage {
  return dto;
}

export function mapProductListResponse(
  dto: ProductListResponseDto,
): ProductListResponse {
  return {
    items: dto.items.map(mapProductListItem),
    pagination: dto.pagination,
  };
}
