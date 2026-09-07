"use client";

import type {
  ProductDetail,
  ProductRecipe,
  ProductUsageScope,
  ProductVariantDetail,
} from "@/lib/products";
import type { ProductIngredientUsage } from "@/lib/products";
import type { InventorySummaryItem } from "@/lib/inventory";
import EmptyProductSelection from "./EmptyProductSelection";
import ProductDetailError from "./ProductDetailError";
import ProductDetailHeader from "./ProductDetailHeader";
import ProductDetailSkeleton from "./ProductDetailSkeleton";
import ProductDetailTabs from "./ProductDetailTabs";
import ProductIngredientUsageTab from "./ProductIngredientUsageTab";
import ProductOverviewTab from "./ProductOverviewTab";
import ProductVariantsRecipeTab from "./ProductVariantsRecipeTab";

type Props = {
  productId: string | null;
  product: ProductDetail | null;
  loading: boolean;
  error: string | null;
  activeTab: "overview" | "variants" | "usage";
  selectedVariantId: string | null;
  recipe: ProductRecipe | null;
  recipeLoading: boolean;
  recipeError?: string | null;
  usage: ProductIngredientUsage | null;
  usageLoading: boolean;
  usageError?: string | null;
  usageDate: string;
  usageScope: ProductUsageScope;
  materials: InventorySummaryItem[];
  submittingAction: string | null;
  mobileBackVisible: boolean;
  onRetry: () => void;
  onBackToList: () => void;
  onChangeTab: (tab: "overview" | "variants" | "usage") => void;
  onEditProduct: () => void;
  onToggleManualAvailability: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onSelectVariant: (variantId: string) => void;
  onAddVariant: () => void;
  onEditVariant: (variant: ProductVariantDetail) => void;
  onToggleVariant: (variant: ProductVariantDetail) => void;
  onDeleteVariant: (variant: ProductVariantDetail) => void;
  onSaveRecipe: (items: Array<{ rawMaterialId: string; quantity: string }>) => Promise<void>;
  onUsageScopeChange: (scope: ProductUsageScope) => void;
  onUsageDateChange: (value: string) => void;
  onRefreshUsage: () => void;
};

export default function ProductDetailPanel({
  productId,
  product,
  loading,
  error,
  activeTab,
  selectedVariantId,
  recipe,
  recipeLoading,
  recipeError,
  usage,
  usageLoading,
  usageError,
  usageDate,
  usageScope,
  materials,
  submittingAction,
  mobileBackVisible,
  onRetry,
  onBackToList,
  onChangeTab,
  onEditProduct,
  onToggleManualAvailability,
  onArchive,
  onRestore,
  onDelete,
  onSelectVariant,
  onAddVariant,
  onEditVariant,
  onToggleVariant,
  onDeleteVariant,
  onSaveRecipe,
  onUsageScopeChange,
  onUsageDateChange,
  onRefreshUsage,
}: Props) {
  if (!productId) {
    return <EmptyProductSelection />;
  }

  if (loading) {
    return <ProductDetailSkeleton />;
  }

  if (error) {
    return <ProductDetailError message={error} onRetry={onRetry} />;
  }

  if (!product) {
    return <EmptyProductSelection />;
  }

  return (
    <section className="flex h-full min-h-[65vh] flex-col rounded-[28px] bg-white p-6 shadow-sm">
      <ProductDetailHeader
        product={product}
        mobileBackVisible={mobileBackVisible}
        submittingAction={submittingAction}
        onBackToList={onBackToList}
        onEdit={onEditProduct}
        onToggleManualAvailability={onToggleManualAvailability}
        onArchive={onArchive}
        onRestore={onRestore}
        onDelete={onDelete}
      />

      <div className="mt-5">
        <ProductDetailTabs activeTab={activeTab} onChange={onChangeTab} />
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        {activeTab === "overview" ? (
          <ProductOverviewTab product={product} />
        ) : null}

        {activeTab === "variants" ? (
          <ProductVariantsRecipeTab
            product={product}
            selectedVariantId={selectedVariantId}
            recipe={recipe}
            recipeLoading={recipeLoading}
            recipeError={recipeError}
            submitting={Boolean(submittingAction)}
            materials={materials}
            onSelectVariant={onSelectVariant}
            onAddVariant={onAddVariant}
            onEditVariant={onEditVariant}
            onToggleVariant={onToggleVariant}
            onDeleteVariant={onDeleteVariant}
            onSaveRecipe={onSaveRecipe}
          />
        ) : null}

        {activeTab === "usage" ? (
          <ProductIngredientUsageTab
            usage={usage}
            usageDate={usageDate}
            usageScope={usageScope}
            loading={usageLoading}
            error={usageError}
            onDateChange={onUsageDateChange}
            onScopeChange={onUsageScopeChange}
            onRefresh={onRefreshUsage}
          />
        ) : null}
      </div>
    </section>
  );
}
