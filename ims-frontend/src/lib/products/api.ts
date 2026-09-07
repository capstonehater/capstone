import { apiFetch, apiJsonFetch } from "@/lib/api";
import type {
  DeleteEligibilityDto,
  ErrorResponseDto,
  ProductCategoryDto,
  ProductDetailDto,
  ProductIngredientUsageDto,
  ProductListResponseDto,
  VariantRecipeDto,
} from "./dto";
import { parseErrorResponse } from "./errors";
import {
  mapCategory,
  mapDeleteEligibility,
  mapProductDetail,
  mapProductListResponse,
  mapRecipe,
  mapUsage,
} from "./mappers";
import type {
  DeleteEligibility,
  ProductArchiveState,
  ProductCategory,
  ProductDetail,
  ProductFormInput,
  ProductIngredientUsage,
  ProductListResponse,
  ProductUsageScope,
  RecipeFormInput,
  SortDirection,
  VariantFormInput,
} from "./types";

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

async function apiJsonFetchWithProductErrors<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await apiFetch(endpoint, options);
  const data = (await response.json().catch(() => null)) as T | ErrorResponseDto | null;

  if (!response.ok) {
    throw parseErrorResponse((data as ErrorResponseDto | null) ?? null);
  }

  return data as T;
}

export async function listProducts(params: {
  search?: string;
  categoryId?: string;
  manualAvailability?: "ENABLED" | "DISABLED";
  effectiveStatus?:
    | "SELLABLE"
    | "PARTIALLY_AVAILABLE"
    | "MANUALLY_DISABLED"
    | "OUT_OF_STOCK"
    | "NO_VALID_RECIPE"
    | "NO_SELLABLE_VARIANT"
    | "ARCHIVED"
    | "UNKNOWN";
  archiveState?: ProductArchiveState | "ALL";
  sortBy?: "name" | "category" | "variantCount" | "ingredientCount" | "updatedAt";
  sortDirection?: SortDirection;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}): Promise<ProductListResponse> {
  const response = await apiJsonFetchWithProductErrors<ProductListResponseDto>(
    `/admin/products${toQueryString({
      search: params.search,
      categoryId: params.categoryId,
      manualAvailability: params.manualAvailability,
      effectiveStatus: params.effectiveStatus,
      archiveState: params.archiveState,
      sortBy: params.sortBy,
      sortDirection: params.sortDirection,
      page: params.page ? String(params.page) : undefined,
      pageSize: params.pageSize ? String(params.pageSize) : undefined,
    })}`,
    { signal: params.signal },
  );

  return mapProductListResponse(response);
}

export async function fetchProductCategories(): Promise<ProductCategory[]> {
  const response = await apiJsonFetch<{ categories: ProductCategoryDto[] }>(
    "/categories",
  );

  return response.categories.map(mapCategory);
}

export async function getProductDetail(
  productId: string,
  signal?: AbortSignal,
): Promise<ProductDetail> {
  const response = await apiJsonFetchWithProductErrors<ProductDetailDto>(
    `/admin/products/${productId}`,
    { signal },
  );
  return mapProductDetail(response);
}

export async function createProduct(
  payload: ProductFormInput,
): Promise<ProductDetail> {
  const response = await apiJsonFetchWithProductErrors<ProductDetailDto>(
    "/admin/products",
    {
      method: "POST",
      body: JSON.stringify({
        name: payload.name,
        categoryId: payload.categoryId,
        isEnabled: payload.isEnabled,
        initialVariants: payload.initialVariants.map((variant) => ({
          name: variant.name,
          sku: variant.sku,
          price: variant.price,
          isEnabled: variant.isEnabled,
        })),
      }),
    },
  );

  return mapProductDetail(response);
}

export async function updateProduct(
  productId: string,
  payload: {
    name?: string;
    categoryId?: string;
    isEnabled?: boolean;
  },
): Promise<ProductDetail> {
  const response = await apiJsonFetchWithProductErrors<ProductDetailDto>(
    `/admin/products/${productId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );

  return mapProductDetail(response);
}

export async function setProductManualAvailability(
  productId: string,
  isEnabled: boolean,
): Promise<ProductDetail> {
  const response = await apiJsonFetchWithProductErrors<ProductDetailDto>(
    `/admin/products/${productId}/manual-availability`,
    {
      method: "PATCH",
      body: JSON.stringify({ isEnabled }),
    },
  );

  return mapProductDetail(response);
}

export async function archiveProduct(
  productId: string,
  reason?: string,
): Promise<ProductDetail> {
  const response = await apiJsonFetchWithProductErrors<ProductDetailDto>(
    `/admin/products/${productId}/archive`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
  );

  return mapProductDetail(response);
}

export async function restoreProduct(productId: string): Promise<ProductDetail> {
  const response = await apiJsonFetchWithProductErrors<ProductDetailDto>(
    `/admin/products/${productId}/restore`,
    {
      method: "POST",
    },
  );

  return mapProductDetail(response);
}

export async function getProductDeleteEligibility(
  productId: string,
  signal?: AbortSignal,
): Promise<DeleteEligibility> {
  const response = await apiJsonFetchWithProductErrors<DeleteEligibilityDto>(
    `/admin/products/${productId}/delete-eligibility`,
    { signal },
  );

  return mapDeleteEligibility(response);
}

export async function deleteProduct(productId: string): Promise<{
  deleted: boolean;
  productId: string;
}> {
  return apiJsonFetchWithProductErrors(`/admin/products/${productId}`, {
    method: "DELETE",
  });
}

export async function createVariant(
  productId: string,
  payload: VariantFormInput,
): Promise<ProductDetail> {
  const response = await apiJsonFetchWithProductErrors<ProductDetailDto>(
    `/admin/products/${productId}/variants`,
    {
      method: "POST",
      body: JSON.stringify({
        name: payload.name,
        sku: payload.sku,
        price: payload.price,
        isEnabled: payload.isEnabled,
      }),
    },
  );

  return mapProductDetail(response);
}

export async function updateVariant(
  variantId: string,
  payload: {
    name?: string;
    sku?: string;
    price?: string;
  },
): Promise<ProductDetail> {
  const response = await apiJsonFetchWithProductErrors<ProductDetailDto>(
    `/admin/variants/${variantId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );

  return mapProductDetail(response);
}

export async function setVariantManualAvailability(
  variantId: string,
  isEnabled: boolean,
): Promise<ProductDetail> {
  const response = await apiJsonFetchWithProductErrors<ProductDetailDto>(
    `/admin/variants/${variantId}/manual-availability`,
    {
      method: "PATCH",
      body: JSON.stringify({ isEnabled }),
    },
  );

  return mapProductDetail(response);
}

export async function deleteVariant(variantId: string): Promise<ProductDetail> {
  const response = await apiJsonFetchWithProductErrors<ProductDetailDto>(
    `/admin/variants/${variantId}`,
    {
      method: "DELETE",
    },
  );

  return mapProductDetail(response);
}

export async function getVariantRecipe(
  variantId: string,
  signal?: AbortSignal,
) {
  const response = await apiJsonFetchWithProductErrors<VariantRecipeDto>(
    `/admin/variants/${variantId}/recipe`,
    { signal },
  );

  return mapRecipe(response);
}

export async function replaceVariantRecipe(
  variantId: string,
  payload: RecipeFormInput,
): Promise<{
  recipe: import("./types").ProductRecipe;
  product: ProductDetail;
}> {
  const response = await apiJsonFetchWithProductErrors<{
    recipe: VariantRecipeDto;
    product: ProductDetailDto;
  }>(`/admin/variants/${variantId}/recipe`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  return {
    recipe: mapRecipe(response.recipe),
    product: mapProductDetail(response.product),
  };
}

export async function getProductIngredientUsage(
  productId: string,
  params: {
    scope: ProductUsageScope;
    businessDate?: string;
    endDate?: string;
    signal?: AbortSignal;
  },
): Promise<ProductIngredientUsage> {
  const response = await apiJsonFetchWithProductErrors<ProductIngredientUsageDto>(
    `/admin/products/${productId}/ingredient-usage${toQueryString({
      scope: params.scope,
      businessDate: params.businessDate,
      endDate: params.endDate,
    })}`,
    {
      signal: params.signal,
    },
  );

  return mapUsage(response);
}
