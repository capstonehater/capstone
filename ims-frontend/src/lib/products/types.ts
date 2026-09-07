export type DecimalString = string;

export type ProductArchiveState = "ACTIVE" | "ARCHIVED";

export type ProductManualAvailability = "ENABLED" | "DISABLED";

export type ProductStockAvailability =
  | "AVAILABLE"
  | "PARTIAL"
  | "UNAVAILABLE"
  | "UNKNOWN";

export type ProductEffectiveStatus =
  | "SELLABLE"
  | "PARTIALLY_AVAILABLE"
  | "MANUALLY_DISABLED"
  | "OUT_OF_STOCK"
  | "NO_VALID_RECIPE"
  | "NO_SELLABLE_VARIANT"
  | "ARCHIVED"
  | "UNKNOWN";

export type ProductUsageScope = "ONE_DAY" | "LAST_7_DAYS" | "LAST_30_DAYS";

export type ProductListSortBy =
  | "name"
  | "category"
  | "variantCount"
  | "ingredientCount"
  | "updatedAt";

export type SortDirection = "asc" | "desc";

export type ProductCategory = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder?: number;
};

export type ProductQualityWarningTone = "neutral" | "warning" | "critical";

export type ProductQualityWarning = {
  code: string;
  message: string;
  tone: ProductQualityWarningTone;
};

export type DeleteEligibility = {
  eligible: boolean;
  blockingReasons: Array<{
    code: string;
    message: string;
    count: number;
  }>;
};

export type ProductStatusBadge = {
  code: ProductEffectiveStatus;
  label: string;
};

export type ProductCategorySummary = {
  id: string;
  name: string;
};

export type ProductListItem = {
  id: string;
  name: string;
  category: ProductCategorySummary;
  variantCount: number;
  ingredientCount: number;
  manualAvailability: ProductManualAvailability;
  stockAvailability: {
    status: ProductStockAvailability;
    sellableVariantCount: number;
    totalVariantCount: number;
  };
  effectiveSellability: boolean;
  effectiveStatus: ProductEffectiveStatus;
  effectiveStatusLabel: string;
  topBlockingReason: string | null;
  archivedAt: string | null;
  updatedAt: string;
};

export type ProductListResponse = {
  items: ProductListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export type ProductRecipeIngredient = {
  rawMaterialId: string;
  rawMaterialName: string;
  quantity: DecimalString;
  unit: {
    id: string;
    code: string;
    name: string;
    dimension: string;
  };
};

export type ProductVariantDetail = {
  id: string;
  name: string;
  sku: string;
  price: DecimalString;
  manualAvailability: ProductManualAvailability;
  isInStock: boolean;
  isSellable: boolean;
  availableBaseQty: number;
  blockingReason: string;
  ingredientCount: number;
  recipeSummary: {
    itemCount: number;
    items: ProductRecipeIngredient[];
  };
};

export type ProductDetail = {
  id: string;
  name: string;
  category: ProductCategorySummary;
  manualAvailability: ProductManualAvailability;
  archive: {
    state: ProductArchiveState;
    archivedAt: string | null;
    archiveReason: string | null;
    archivedBy:
      | {
          id: string;
          firstName: string;
          lastName: string;
          email: string;
        }
      | null;
  };
  effectiveStatus: ProductEffectiveStatus;
  effectiveStatusLabel: string;
  effectiveSellability: boolean;
  stockAvailability: {
    status: ProductStockAvailability;
    sellableVariantCount: number;
    totalVariantCount: number;
  };
  topBlockingReason: string | null;
  variantCount: number;
  ingredientCount: number;
  deleteEligibility: DeleteEligibility;
  variants: ProductVariantDetail[];
  qualityWarnings: ProductQualityWarning[];
  updatedAt: string;
};

export type ProductRecipe = {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  items: ProductRecipeIngredient[];
};

export type ProductIngredientUsage = {
  productId: string;
  productName: string;
  scope: ProductUsageScope;
  startAt: string;
  endAt: string;
  coveredDates: string[];
  distinctOrderCount: number;
  productUnitsSold: number;
  ingredientRowCount: number;
  ingredients: Array<{
    rawMaterialId: string;
    rawMaterialName: string;
    unit: {
      id: string;
      code: string;
      name: string;
      dimension: string;
    };
    grossQuantity: DecimalString;
    reversedQuantity: DecimalString;
    netQuantity: DecimalString;
    grossCost: DecimalString;
    reversedCost: DecimalString;
    netCost: DecimalString;
  }>;
  variantBreakdown: Array<{
    productVariantId: string;
    variantName: string;
    sku: string;
    productUnitsSold: number;
    grossIngredientCost: DecimalString;
    reversedIngredientCost: DecimalString;
    netIngredientCost: DecimalString;
  }>;
};

export type ProductFormInput = {
  name: string;
  categoryId: string;
  isEnabled: boolean;
  initialVariants: VariantFormInput[];
};

export type VariantFormInput = {
  name: string;
  sku: string;
  price: string;
  isEnabled: boolean;
};

export type RecipeFormInput = {
  items: Array<{
    rawMaterialId: string;
    quantity: string;
  }>;
};

export type ProductReadError = {
  message: string;
  status?: number;
  code?: string;
  fieldErrors?: Record<string, string[]>;
};
