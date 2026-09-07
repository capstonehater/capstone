export type ProductListItemDto = {
  id: string;
  name: string;
  category: {
    id: string;
    name: string;
  };
  variantCount: number;
  ingredientCount: number;
  manualAvailability: boolean;
  stockAvailability: {
    status: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
    sellableVariantCount: number;
    totalVariantCount: number;
  };
  effectiveSellability: boolean;
  effectiveStatus: string;
  topBlockingReason: string | null;
  archivedAt: string | null;
  updatedAt: string;
};

export type ProductListResponseDto = {
  items: ProductListItemDto[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export type ProductCategoryDto = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder?: number;
};

export type ProductDetailDto = {
  id: string;
  name: string;
  category: {
    id: string;
    name: string;
  };
  manualAvailability: boolean;
  archive: {
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
  effectiveStatus: string;
  effectiveSellability: boolean;
  stockAvailability: {
    status: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
    sellableVariantCount: number;
    totalVariantCount: number;
  };
  topBlockingReason: string | null;
  variantCount: number;
  ingredientCount: number;
  deleteEligibility: {
    eligible: boolean;
    blockingReasons: Array<{
      code: string;
      message: string;
      count: number;
    }>;
  };
  variants: Array<{
    id: string;
    name: string;
    sku: string;
    price: string;
    manualAvailability: boolean;
    isInStock: boolean;
    isSellable: boolean;
    availableBaseQty: number;
    blockingReason: string;
    ingredientCount: number;
    recipeSummary: {
      itemCount: number;
      items: Array<{
        rawMaterialId: string;
        rawMaterialName: string;
        quantity: string;
        unit: {
          id: string;
          code: string;
          name: string;
          dimension: string;
        };
      }>;
    };
  }>;
  updatedAt?: string;
};

export type VariantRecipeDto = {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  items: Array<{
    rawMaterialId: string;
    rawMaterialName: string;
    quantity: string;
    unit: {
      id: string;
      code: string;
      name: string;
      dimension: string;
    };
  }>;
};

export type ProductIngredientUsageDto = {
  productId: string;
  productName: string;
  scope: "ONE_DAY" | "LAST_7_DAYS" | "LAST_30_DAYS";
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
    grossQuantity: string;
    reversedQuantity: string;
    netQuantity: string;
    grossCost: string;
    reversedCost: string;
    netCost: string;
  }>;
  variantBreakdown: Array<{
    productVariantId: string;
    variantName: string;
    sku: string;
    productUnitsSold: number;
    grossIngredientCost: string;
    reversedIngredientCost: string;
    netIngredientCost: string;
  }>;
};

export type DeleteEligibilityDto = ProductDetailDto["deleteEligibility"];

export type ErrorResponseDto = {
  message?: string | string[];
  error?: string;
  code?: string;
  statusCode?: number;
  errors?: Record<string, string[]>;
};
