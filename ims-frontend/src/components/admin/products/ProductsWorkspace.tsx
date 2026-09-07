"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fetchInventorySummary, type InventorySummaryItem } from "@/lib/inventory";
import {
  archiveProduct,
  createProduct,
  createVariant,
  deleteProduct,
  deleteVariant,
  fetchProductCategories,
  getProductDeleteEligibility,
  getProductDetail,
  getProductIngredientUsage,
  getVariantRecipe,
  normalizeProductError,
  replaceVariantRecipe,
  restoreProduct,
  setProductManualAvailability,
  setVariantManualAvailability,
  updateProduct,
  updateVariant,
  type ProductCategory,
  type ProductDetail,
  type ProductEffectiveStatus,
  type ProductIngredientUsage,
  type ProductListResponse,
  type ProductRecipe,
  type ProductUsageScope,
  type ProductVariantDetail,
  listProducts,
} from "@/lib/products";
import { getTodayDateInput } from "@/lib/report-date-range";
import ArchiveProductDialog from "./ArchiveProductDialog";
import DeleteProductDialog from "./DeleteProductDialog";
import ProductDetailPanel from "./ProductDetailPanel";
import ProductFormDialog from "./ProductFormDialog";
import ProductsMasterPanel from "./ProductsMasterPanel";
import RestoreProductDialog from "./RestoreProductDialog";
import VariantFormDialog from "./VariantFormDialog";

type DetailTab = "overview" | "variants" | "usage";
type ViewMode = "active" | "archived";
type ManualAvailabilityFilter = "" | "enabled" | "disabled";

type ProductDialogState =
  | { mode: "create" }
  | { mode: "edit"; productId: string };

type VariantDialogState =
  | { mode: "create" }
  | { mode: "edit"; variant: ProductVariantDetail };

const PAGE_SIZE = 12;

function parseView(value: string | null): ViewMode {
  return value === "archived" ? "archived" : "active";
}

function parseDetailTab(value: string | null): DetailTab {
  if (value === "variants" || value === "usage") {
    return value;
  }

  return "overview";
}

function parseManualAvailability(value: string | null): ManualAvailabilityFilter {
  if (value === "enabled" || value === "disabled") {
    return value;
  }

  return "";
}

function parseEffectiveAvailability(
  value: string | null,
): "" | ProductEffectiveStatus {
  if (
    value === "SELLABLE" ||
    value === "PARTIALLY_AVAILABLE" ||
    value === "MANUALLY_DISABLED" ||
    value === "OUT_OF_STOCK" ||
    value === "NO_VALID_RECIPE" ||
    value === "NO_SELLABLE_VARIANT" ||
    value === "ARCHIVED" ||
    value === "UNKNOWN"
  ) {
    return value;
  }

  return "";
}

function parsePage(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function useQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateQuery(
    patch: Record<string, string | null | undefined>,
    mode: "push" | "replace" = "push",
  ) {
    const next = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(patch)) {
      if (!value) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }

    const query = next.toString();
    const target = query ? `${pathname}?${query}` : pathname;

    if (mode === "replace") {
      router.replace(target);
      return;
    }

    router.push(target);
  }

  return { searchParams, updateQuery };
}

export default function ProductsWorkspace() {
  const { searchParams, updateQuery } = useQueryState();
  const view = parseView(searchParams.get("view"));
  const selectedProductId = searchParams.get("productId");
  const categoryId = searchParams.get("categoryId") ?? "";
  const manualAvailability = parseManualAvailability(
    searchParams.get("manualAvailability"),
  );
  const effectiveAvailability = parseEffectiveAvailability(
    searchParams.get("effectiveAvailability"),
  );
  const detailTab = parseDetailTab(searchParams.get("detailTab"));
  const variantId = searchParams.get("variantId");
  const page = parsePage(searchParams.get("page"));
  const search = searchParams.get("search") ?? "";

  const [searchInput, setSearchInput] = useState(search);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [materials, setMaterials] = useState<InventorySummaryItem[]>([]);
  const [listResponse, setListResponse] = useState<ProductListResponse | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null);
  const [recipe, setRecipe] = useState<ProductRecipe | null>(null);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeError, setRecipeError] = useState<string | null>(null);
  const [usage, setUsage] = useState<ProductIngredientUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageDate, setUsageDate] = useState(getTodayDateInput());
  const [usageScope, setUsageScope] = useState<ProductUsageScope>("ONE_DAY");
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [productDialog, setProductDialog] = useState<ProductDialogState | null>(null);
  const [variantDialog, setVariantDialog] = useState<VariantDialogState | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogFieldErrors, setDialogFieldErrors] = useState<Record<string, string[]> | null>(
    null,
  );
  const [deleteEligibility, setDeleteEligibility] = useState<ProductDetail["deleteEligibility"] | null>(null);
  const [deleteEligibilityLoading, setDeleteEligibilityLoading] = useState(false);
  const [deleteEligibilityError, setDeleteEligibilityError] = useState<string | null>(null);

  const detailCacheRef = useRef<Map<string, ProductDetail>>(new Map());
  const recipeCacheRef = useRef<Map<string, ProductRecipe>>(new Map());
  const usageCacheRef = useRef<Map<string, ProductIngredientUsage>>(new Map());

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    async function loadStaticData() {
      try {
        const [categoryResponse, materialResponse] = await Promise.all([
          fetchProductCategories(),
          fetchInventorySummary({ includeArchived: true }),
        ]);

        if (cancelled) {
          return;
        }

        setCategories(categoryResponse);
        setMaterials(materialResponse.filter((item) => item.isActive));
      } catch (error) {
        if (!cancelled) {
          setWorkspaceError(
            error instanceof Error
              ? error.message
              : "Failed to load product setup data",
          );
        }
      }
    }

    void loadStaticData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (searchInput === search) {
        return;
      }

      updateQuery(
        {
          search: searchInput.trim() || null,
          page: null,
        },
        "replace",
      );
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [search, searchInput, updateQuery]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadList() {
      setListLoading(true);
      setListError(null);

      try {
        const response = await listProducts({
          search: search || undefined,
          categoryId: categoryId || undefined,
          manualAvailability:
            manualAvailability === "enabled"
              ? "ENABLED"
              : manualAvailability === "disabled"
                ? "DISABLED"
                : undefined,
          effectiveStatus: effectiveAvailability || undefined,
          archiveState: view === "archived" ? "ARCHIVED" : "ACTIVE",
          sortBy: "name",
          sortDirection: "asc",
          page,
          pageSize: PAGE_SIZE,
          signal: controller.signal,
        });

        setListResponse(response);
      } catch (error) {
        if (!controller.signal.aborted) {
          setListError(
            error instanceof Error ? error.message : "Failed to load products",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setListLoading(false);
        }
      }
    }

    void loadList();

    return () => controller.abort();
  }, [categoryId, effectiveAvailability, manualAvailability, page, search, view]);

  useEffect(() => {
    if (!selectedProductId) {
      setSelectedProduct(null);
      setDetailError(null);
      return;
    }

    const productId = selectedProductId;
    const cached = detailCacheRef.current.get(selectedProductId);
    if (cached) {
      setSelectedProduct(cached);
    }

    const controller = new AbortController();

    async function loadDetail() {
      setDetailLoading(true);
      setDetailError(null);

      try {
        const detail = await getProductDetail(productId, controller.signal);
        detailCacheRef.current.set(detail.id, detail);
        setSelectedProduct(detail);
      } catch (error) {
        if (!controller.signal.aborted) {
          setDetailError(
            error instanceof Error ? error.message : "Failed to load product detail",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setDetailLoading(false);
        }
      }
    }

    void loadDetail();

    return () => controller.abort();
  }, [selectedProductId]);

  const resolvedVariantId = useMemo(() => {
    if (!selectedProduct) {
      return null;
    }

    if (variantId && selectedProduct.variants.some((variant) => variant.id === variantId)) {
      return variantId;
    }

    return selectedProduct.variants[0]?.id ?? null;
  }, [selectedProduct, variantId]);

  useEffect(() => {
    if (!selectedProduct || detailTab !== "variants" || !resolvedVariantId) {
      setRecipe(null);
      setRecipeError(null);
      return;
    }

    const currentVariantId = resolvedVariantId;
    const cached = recipeCacheRef.current.get(resolvedVariantId);
    if (cached) {
      setRecipe(cached);
    }

    const controller = new AbortController();

    async function loadRecipe() {
      setRecipeLoading(true);
      setRecipeError(null);

      try {
        const nextRecipe = await getVariantRecipe(currentVariantId, controller.signal);
        recipeCacheRef.current.set(currentVariantId, nextRecipe);
        setRecipe(nextRecipe);
      } catch (error) {
        if (!controller.signal.aborted) {
          setRecipeError(
            normalizeProductError(error, "Failed to load variant recipe").message,
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setRecipeLoading(false);
        }
      }
    }

    void loadRecipe();

    return () => controller.abort();
  }, [detailTab, resolvedVariantId, selectedProduct]);

  const loadUsage = useCallback(
    async (forceRefresh = false) => {
      if (!selectedProductId) {
        return;
      }

      const cacheKey = `${selectedProductId}:${usageScope}:${usageDate}`;
      if (!forceRefresh) {
        const cached = usageCacheRef.current.get(cacheKey);
        if (cached) {
          setUsage(cached);
          return;
        }
      }

      const controller = new AbortController();
      setUsageLoading(true);
      setUsageError(null);

      try {
        const nextUsage = await getProductIngredientUsage(selectedProductId, {
          scope: usageScope,
          businessDate: usageScope === "ONE_DAY" ? usageDate : undefined,
          endDate: usageScope === "ONE_DAY" ? undefined : usageDate,
          signal: controller.signal,
        });
        usageCacheRef.current.set(cacheKey, nextUsage);
        setUsage(nextUsage);
      } catch (error) {
        if (!controller.signal.aborted) {
          setUsageError(
            normalizeProductError(error, "Failed to load ingredient usage").message,
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setUsageLoading(false);
        }
      }
    },
    [selectedProductId, usageDate, usageScope],
  );

  useEffect(() => {
    if (detailTab !== "usage" || !selectedProductId) {
      return;
    }

    void loadUsage();
  }, [detailTab, loadUsage, selectedProductId]);

  async function refreshCurrentList() {
    const response = await listProducts({
      search: search || undefined,
      categoryId: categoryId || undefined,
      manualAvailability:
        manualAvailability === "enabled"
          ? "ENABLED"
          : manualAvailability === "disabled"
            ? "DISABLED"
            : undefined,
      effectiveStatus: effectiveAvailability || undefined,
      archiveState: view === "archived" ? "ARCHIVED" : "ACTIVE",
      sortBy: "name",
      sortDirection: "asc",
      page,
      pageSize: PAGE_SIZE,
    });

    setListResponse(response);
    return response;
  }

  async function refreshProductDetail(productId: string) {
    const detail = await getProductDetail(productId);
    detailCacheRef.current.set(productId, detail);
    setSelectedProduct(detail);
    return detail;
  }

  function clearProductSelection() {
    updateQuery({ productId: null, variantId: null }, "push");
  }

  function resetDialogFeedback() {
    setDialogError(null);
    setDialogFieldErrors(null);
  }

  async function handleCreateProduct(input: {
    name: string;
    categoryId: string;
    isEnabled: boolean;
    initialVariants: Array<{
      name: string;
      sku: string;
      price: string;
      isEnabled: boolean;
    }>;
  }) {
    setSubmittingAction("create-product");
    resetDialogFeedback();
    try {
      const created = await createProduct(input);
      detailCacheRef.current.set(created.id, created);
      await refreshCurrentList();
      setProductDialog(null);
      setNotice("Product created.");
      updateQuery(
        {
          productId: created.id,
          detailTab: "variants",
          variantId: created.variants[0]?.id ?? null,
        },
        "push",
      );
    } catch (error) {
      const normalized = normalizeProductError(error, "Failed to create product");
      setDialogError(normalized.message);
      setDialogFieldErrors(normalized.fieldErrors ?? null);
    } finally {
      setSubmittingAction(null);
    }
  }

  async function handleUpdateProduct(input: {
    name: string;
    categoryId: string;
    isEnabled: boolean;
    initialVariants: Array<{
      name: string;
      sku: string;
      price: string;
      isEnabled: boolean;
    }>;
  }) {
    if (!selectedProductId) {
      return;
    }

    setSubmittingAction("update-product");
    resetDialogFeedback();
    try {
      const updated = await updateProduct(selectedProductId, {
        name: input.name,
        categoryId: input.categoryId,
      });
      detailCacheRef.current.set(updated.id, updated);
      setSelectedProduct(updated);
      await refreshCurrentList();
      setProductDialog(null);
      setNotice("Product details updated.");
    } catch (error) {
      const normalized = normalizeProductError(error, "Failed to update product");
      setDialogError(normalized.message);
      setDialogFieldErrors(normalized.fieldErrors ?? null);
    } finally {
      setSubmittingAction(null);
    }
  }

  async function handleCreateVariant(input: {
    name: string;
    sku: string;
    price: string;
    isEnabled: boolean;
  }) {
    if (!selectedProductId) {
      return;
    }

    setSubmittingAction("create-variant");
    resetDialogFeedback();
    try {
      const updated = await createVariant(selectedProductId, input);
      detailCacheRef.current.set(updated.id, updated);
      setSelectedProduct(updated);
      await refreshCurrentList();
      setVariantDialog(null);
      const latestVariant = updated.variants[updated.variants.length - 1];
      updateQuery(
        {
          detailTab: "variants",
          variantId: latestVariant?.id ?? null,
        },
        "push",
      );
      setNotice("Variant created.");
    } catch (error) {
      const normalized = normalizeProductError(error, "Failed to create variant");
      setDialogError(normalized.message);
      setDialogFieldErrors(normalized.fieldErrors ?? null);
    } finally {
      setSubmittingAction(null);
    }
  }

  async function handleUpdateVariant(input: {
    name: string;
    sku: string;
    price: string;
    isEnabled: boolean;
  }) {
    if (!variantDialog || variantDialog.mode !== "edit") {
      return;
    }

    setSubmittingAction("update-variant");
    resetDialogFeedback();
    try {
      let updated = await updateVariant(variantDialog.variant.id, {
        name: input.name,
        sku: input.sku,
        price: input.price,
      });

      if (
        updated.variants.find((variant) => variant.id === variantDialog.variant.id)
          ?.manualAvailability !== (input.isEnabled ? "ENABLED" : "DISABLED")
      ) {
        updated = await setVariantManualAvailability(
          variantDialog.variant.id,
          input.isEnabled,
        );
      }

      detailCacheRef.current.set(updated.id, updated);
      setSelectedProduct(updated);
      await refreshCurrentList();
      setVariantDialog(null);
      setNotice("Variant updated.");
    } catch (error) {
      const normalized = normalizeProductError(error, "Failed to update variant");
      setDialogError(normalized.message);
      setDialogFieldErrors(normalized.fieldErrors ?? null);
    } finally {
      setSubmittingAction(null);
    }
  }

  async function handleToggleProductManualAvailability() {
    if (!selectedProduct) {
      return;
    }

    setSubmittingAction("toggle-product");
    try {
      const updated = await setProductManualAvailability(
        selectedProduct.id,
        selectedProduct.manualAvailability !== "ENABLED",
      );
      detailCacheRef.current.set(updated.id, updated);
      setSelectedProduct(updated);
      await refreshCurrentList();
      setNotice("Product manual availability updated.");
    } catch (error) {
      setWorkspaceError(
        normalizeProductError(error, "Failed to update product availability").message,
      );
    } finally {
      setSubmittingAction(null);
    }
  }

  async function handleToggleVariant(variant: ProductVariantDetail) {
    setSubmittingAction("toggle-variant");
    try {
      const updated = await setVariantManualAvailability(
        variant.id,
        variant.manualAvailability !== "ENABLED",
      );
      detailCacheRef.current.set(updated.id, updated);
      setSelectedProduct(updated);
      await refreshCurrentList();
      setNotice("Variant manual availability updated.");
    } catch (error) {
      setWorkspaceError(
        normalizeProductError(error, "Failed to update variant availability").message,
      );
    } finally {
      setSubmittingAction(null);
    }
  }

  async function handleDeleteVariant(variant: ProductVariantDetail) {
    if (
      !window.confirm(
        `Delete variant "${variant.name}" if it has no protected history?`,
      )
    ) {
      return;
    }

    setSubmittingAction("delete-variant");
    try {
      const updated = await deleteVariant(variant.id);
      detailCacheRef.current.set(updated.id, updated);
      setSelectedProduct(updated);
      await refreshCurrentList();
      if (variant.id === resolvedVariantId) {
        updateQuery({ variantId: updated.variants[0]?.id ?? null }, "push");
      }
      setNotice("Variant deleted.");
    } catch (error) {
      setWorkspaceError(
        normalizeProductError(error, "Failed to delete variant").message,
      );
    } finally {
      setSubmittingAction(null);
    }
  }

  async function handleSaveRecipe(
    items: Array<{ rawMaterialId: string; quantity: string }>,
  ) {
    if (!resolvedVariantId) {
      return;
    }

    setSubmittingAction("save-recipe");
    try {
      const result = await replaceVariantRecipe(resolvedVariantId, { items });
      detailCacheRef.current.set(result.product.id, result.product);
      recipeCacheRef.current.set(resolvedVariantId, result.recipe);
      setSelectedProduct(result.product);
      setRecipe(result.recipe);
      await refreshCurrentList();
      setNotice("Recipe updated.");
    } catch (error) {
      setWorkspaceError(
        normalizeProductError(error, "Failed to update recipe").message,
      );
    } finally {
      setSubmittingAction(null);
    }
  }

  async function handleArchiveProduct(reason: string) {
    if (!selectedProductId) {
      return;
    }

    setSubmittingAction("archive-product");
    try {
      const updated = await archiveProduct(selectedProductId, reason);
      detailCacheRef.current.set(updated.id, updated);
      setSelectedProduct(updated);
      const response = await refreshCurrentList();
      setArchiveDialogOpen(false);
      setNotice("Product archived.");

      if (view === "active") {
        if (!response.items.some((item) => item.id === updated.id)) {
          clearProductSelection();
        }
      }
    } catch (error) {
      setWorkspaceError(normalizeProductError(error, "Failed to archive product").message);
    } finally {
      setSubmittingAction(null);
    }
  }

  async function handleRestoreProduct() {
    if (!selectedProductId) {
      return;
    }

    setSubmittingAction("restore-product");
    try {
      const updated = await restoreProduct(selectedProductId);
      detailCacheRef.current.set(updated.id, updated);
      setSelectedProduct(updated);
      updateQuery(
        {
          view: "active",
          productId: updated.id,
        },
        "push",
      );
      const response = await listProducts({
        search: search || undefined,
        categoryId: categoryId || undefined,
        manualAvailability:
          manualAvailability === "enabled"
            ? "ENABLED"
            : manualAvailability === "disabled"
              ? "DISABLED"
              : undefined,
        effectiveStatus: effectiveAvailability || undefined,
        archiveState: "ACTIVE",
        sortBy: "name",
        sortDirection: "asc",
        page: 1,
        pageSize: PAGE_SIZE,
      });
      setListResponse(response);
      setRestoreDialogOpen(false);
      setNotice("Product restored.");

      if (view === "archived" && !response.items.some((item) => item.id === updated.id)) {
        clearProductSelection();
      }
    } catch (error) {
      setWorkspaceError(normalizeProductError(error, "Failed to restore product").message);
    } finally {
      setSubmittingAction(null);
    }
  }

  useEffect(() => {
    if (!deleteDialogOpen || !selectedProductId) {
      setDeleteEligibility(null);
      setDeleteEligibilityError(null);
      return;
    }

    const controller = new AbortController();
    setDeleteEligibilityLoading(true);
    setDeleteEligibilityError(null);

    void getProductDeleteEligibility(selectedProductId, controller.signal)
      .then((eligibility) => {
        if (!controller.signal.aborted) {
          setDeleteEligibility(eligibility);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setDeleteEligibilityError(
            normalizeProductError(error, "Failed to load delete eligibility").message,
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setDeleteEligibilityLoading(false);
        }
      });

    return () => controller.abort();
  }, [deleteDialogOpen, selectedProductId]);

  async function handleDeleteProduct() {
    if (!selectedProductId) {
      return;
    }

    setSubmittingAction("delete-product");
    try {
      const latestEligibility = await getProductDeleteEligibility(selectedProductId);
      setDeleteEligibility(latestEligibility);
      if (!latestEligibility.eligible) {
        setDeleteEligibilityError("Delete is now blocked by backend authority.");
        return;
      }
      await deleteProduct(selectedProductId);
      detailCacheRef.current.delete(selectedProductId);
      setDeleteDialogOpen(false);
      setSelectedProduct(null);
      await refreshCurrentList();
      clearProductSelection();
      setNotice("Product permanently deleted.");
    } catch (error) {
      setDeleteEligibilityError(
        normalizeProductError(error, "Failed to delete product").message,
      );
    } finally {
      setSubmittingAction(null);
    }
  }

  const isMobileDetailView = Boolean(selectedProductId);

  return (
    <div className="space-y-6">
      {workspaceError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {workspaceError}
        </div>
      ) : null}

      {listError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {listError}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[392px_minmax(0,1fr)]">
        <div className={isMobileDetailView ? "hidden xl:block" : "block"}>
          <ProductsMasterPanel
            categories={categories}
            search={searchInput}
            view={view}
            categoryId={categoryId}
            manualAvailability={manualAvailability}
            effectiveAvailability={effectiveAvailability}
            loading={listLoading}
            listResponse={listResponse}
            selectedId={selectedProductId}
            onSearchChange={setSearchInput}
            onViewChange={(nextView) =>
              updateQuery({ view: nextView, page: null, productId: null, variantId: null })
            }
            onCategoryChange={(value) =>
              updateQuery({ categoryId: value || null, page: null })
            }
            onManualAvailabilityChange={(value) =>
              updateQuery({ manualAvailability: value || null, page: null })
            }
            onEffectiveAvailabilityChange={(value) =>
              updateQuery({ effectiveAvailability: value || null, page: null })
            }
            onClearFilters={() =>
              updateQuery(
                {
                  categoryId: null,
                  manualAvailability: null,
                  effectiveAvailability: null,
                  search: null,
                  page: null,
                },
                "push",
              )
            }
            onAddProduct={() => setProductDialog({ mode: "create" })}
            onSelectProduct={(productId) =>
              updateQuery(
                {
                  productId,
                  detailTab,
                  variantId: null,
                },
                "push",
              )
            }
            onPageChange={(nextPage) =>
              updateQuery({ page: nextPage > 1 ? String(nextPage) : null }, "push")
            }
          />
        </div>

        <div className={isMobileDetailView ? "block" : "hidden xl:block"}>
          <ProductDetailPanel
            productId={selectedProductId}
            product={selectedProduct}
            loading={detailLoading}
            error={detailError}
            activeTab={detailTab}
            selectedVariantId={resolvedVariantId}
            recipe={recipe}
            recipeLoading={recipeLoading}
            recipeError={recipeError}
            usage={usage}
            usageLoading={usageLoading}
            usageError={usageError}
            usageDate={usageDate}
            usageScope={usageScope}
            materials={materials}
            submittingAction={submittingAction}
            mobileBackVisible={isMobileDetailView}
            onRetry={() => {
              if (selectedProductId) {
                void refreshProductDetail(selectedProductId);
              }
            }}
            onBackToList={clearProductSelection}
            onChangeTab={(tab) =>
              updateQuery(
                {
                  detailTab: tab,
                  variantId: tab === "variants" ? resolvedVariantId : null,
                },
                "push",
              )
            }
            onEditProduct={() =>
              setProductDialog(
                selectedProductId ? { mode: "edit", productId: selectedProductId } : null,
              )
            }
            onToggleManualAvailability={() => void handleToggleProductManualAvailability()}
            onArchive={() => setArchiveDialogOpen(true)}
            onRestore={() => setRestoreDialogOpen(true)}
            onDelete={() => setDeleteDialogOpen(true)}
            onSelectVariant={(nextVariantId) =>
              updateQuery({ detailTab: "variants", variantId: nextVariantId }, "push")
            }
            onAddVariant={() => setVariantDialog({ mode: "create" })}
            onEditVariant={(variant) => setVariantDialog({ mode: "edit", variant })}
            onToggleVariant={(variant) => void handleToggleVariant(variant)}
            onDeleteVariant={(variant) => void handleDeleteVariant(variant)}
            onSaveRecipe={handleSaveRecipe}
            onUsageScopeChange={setUsageScope}
            onUsageDateChange={setUsageDate}
            onRefreshUsage={() => void loadUsage(true)}
          />
        </div>
      </div>

      <ProductFormDialog
        mode={productDialog?.mode ?? "create"}
        open={Boolean(productDialog)}
        categories={categories}
        product={
          productDialog?.mode === "edit" && selectedProduct?.id === productDialog.productId
            ? selectedProduct
            : null
        }
        submitting={Boolean(submittingAction)}
        errorMessage={dialogError}
        fieldErrors={dialogFieldErrors ?? undefined}
        onClose={() => {
          resetDialogFeedback();
          setProductDialog(null);
        }}
        onSubmit={(input) =>
          productDialog?.mode === "edit"
            ? handleUpdateProduct(input)
            : handleCreateProduct(input)
        }
      />

      <VariantFormDialog
        mode={variantDialog?.mode ?? "create"}
        open={Boolean(variantDialog)}
        variant={variantDialog?.mode === "edit" ? variantDialog.variant : null}
        submitting={Boolean(submittingAction)}
        errorMessage={dialogError}
        fieldErrors={dialogFieldErrors ?? undefined}
        onClose={() => {
          resetDialogFeedback();
          setVariantDialog(null);
        }}
        onSubmit={(input) =>
          variantDialog?.mode === "edit"
            ? handleUpdateVariant(input)
            : handleCreateVariant(input)
        }
      />

      <ArchiveProductDialog
        open={archiveDialogOpen}
        product={selectedProduct}
        submitting={submittingAction === "archive-product"}
        onClose={() => setArchiveDialogOpen(false)}
        onConfirm={handleArchiveProduct}
      />

      <RestoreProductDialog
        open={restoreDialogOpen}
        product={selectedProduct}
        submitting={submittingAction === "restore-product"}
        onClose={() => setRestoreDialogOpen(false)}
        onConfirm={handleRestoreProduct}
      />

      <DeleteProductDialog
        open={deleteDialogOpen}
        product={selectedProduct}
        submitting={submittingAction === "delete-product"}
        eligibility={deleteEligibility}
        loadingEligibility={deleteEligibilityLoading}
        errorMessage={deleteEligibilityError}
        onClose={() => {
          setDeleteEligibilityError(null);
          setDeleteDialogOpen(false);
        }}
        onConfirm={handleDeleteProduct}
      />
    </div>
  );
}
