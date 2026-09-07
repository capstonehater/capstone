# Frontend Products Phase 1 Planning

## 1. Current Frontend State

### Current audit table

| Area | Current Implementation | Reusable | Problems | Evidence |
|---|---|---|---|---|
| Admin route shell | Admin pages sit under `AuthGuard` and `AdminDashboardLayout` with the orange sidebar/header shell. | Yes | Header copy is dashboard-specific, not page-specific. Sidebar has no active-state styling. | `ims-frontend/src/app/admin/layout.tsx`, `ims-frontend/src/components/admin/AdminDashboardLayout.tsx`, `ims-frontend/src/components/admin/AdminSidebar.tsx`, `ims-frontend/src/components/admin/AdminHeader.tsx` |
| Current Products page | One large page component handles list, selection, create product, edit product, variant CRUD, recipe editing, usage loading, order usage lookup, notices, and fetch orchestration. | Partially | Monolithic, hard to reason about, tightly coupled to current payloads, weak separation of concerns. | `ims-frontend/src/app/admin/products/page.tsx` |
| Inventory master-detail layout | Inventory already uses split panels, toolbar filters, scroll-contained list/detail panels, modal-based editing, and reusable field styling. | Strongly yes | Product page does not follow this structure yet. | `ims-frontend/src/app/admin/inventory/page.tsx`, `ims-frontend/src/components/admin/inventory/InventorySummaryPanel.tsx`, `ims-frontend/src/components/admin/inventory/MaterialDetailPanel.tsx` |
| Admin inventory field/form pattern | Shared label + input styling via `InventoryField` and `inventoryInputClasses`. | Yes | Naming is inventory-specific, but pattern is solid. | `ims-frontend/src/components/admin/inventory/InventoryField.tsx` |
| Modal patterns | Inventory uses structured action modals. POS uses a simpler generic modal. | Yes, with adaptation | Modal focus/accessibility behavior is basic and should be strengthened in implementation. | `ims-frontend/src/components/admin/inventory/RawMaterialModals.tsx`, `ims-frontend/src/components/staff-pos/modals/Modal.tsx` |
| Status badges | Inventory uses colored pill badges. POS uses clear availability labels for unavailable reasons. | Yes | Products page currently mixes manual and computed availability text too loosely. | `ims-frontend/src/components/admin/inventory/InventorySummaryPanel.tsx`, `ims-frontend/src/components/staff-pos/modals/ProductConfiguratorModal.tsx` |
| API helper layer | `lib/products.ts` exports both fetchers and frontend types. | Partially | Transport and contract concerns are mixed together; no adapter layer between unstable backend payloads and UI models. | `ims-frontend/src/lib/products.ts`, `ims-frontend/src/lib/api.ts` |
| Loading and error states | Basic inline notice/error banners and simple text placeholders exist. | Partially | No dedicated skeletons, weak empty selection state, inconsistent per-section loading treatment. | `ims-frontend/src/app/admin/products/page.tsx`, `ims-frontend/src/components/admin/reports/InventoryReportsWorkspace.tsx` |
| Responsive behavior | Inventory intentionally constrains panels; POS adapts card grids and side cart. | Partially | Current products page stacks too much content vertically and does not define a mobile-first detail behavior. | `ims-frontend/src/app/admin/products/page.tsx`, `ims-frontend/src/app/admin/inventory/page.tsx`, `ims-frontend/src/components/staff-pos/StaffPOSPage.tsx` |
| State management | Auth uses Zustand. Inventory uses Zustand for cross-panel admin state. Products uses local page state only. | Partially | Products state is sprawling, but also not shared enough to justify moving all of it to Zustand. | `ims-frontend/src/store/authStore.ts`, `ims-frontend/src/store/inventoryStore.ts`, `ims-frontend/src/app/admin/products/page.tsx` |
| Products components folder | No dedicated products component folder exists yet. | No | Signals that the page was built directly in route-level code instead of as a workspace. | `ims-frontend/src/components/admin/products/` missing |

### Summary

The current frontend is strong enough to support a rebuild without changing libraries or app structure. The main opportunity is architectural: move Products from a route-level monolith into a proper admin workspace using the same master-detail discipline already visible in Inventory.

## 2. Existing Reusable Components

### Strong reuse candidates

- `AdminDashboardLayout`
  - Keep as the page shell.
- `AdminSidebar` and `AdminHeader`
  - Keep the existing shell and orange/white language.
- Inventory split-panel patterns
  - `InventorySummaryPanel`
  - `MaterialDetailPanel`
  - These are the best reference for scroll containment, card styling, panel sizing, and table-first detail layouts.
- Inventory field styling
  - `InventoryField`
  - `inventoryInputClasses`
  - `inventoryTextareaClasses`
- Inventory modal composition style
  - `RawMaterialModals`
  - `InventoryModal`
  - The modal content structure is reusable even if product-specific dialogs should be separate.
- POS availability language
  - `availabilityLabel` logic in `ProductConfiguratorModal`
  - This is useful as a vocabulary source for product/variant status text.
- Date helper pattern
  - `getTodayDateInput` and Manila-aware range helpers from `report-date-range.ts`

### Reuse with caution

- `lib/products.ts`
  - Reuse the endpoints as a starting point, but do not keep UI tightly bound to these exact response shapes.
- `useInventoryStore`
  - Reuse only as a pattern reference, not as a direct store for Products.
- POS modal
  - Useful for simple structure, but not enough for accessibility-heavy admin dialogs by itself.

### Replace rather than reuse directly

- The current route page implementation in `ims-frontend/src/app/admin/products/page.tsx`
  - Replace structurally.
- Inline variant editing blocks
  - Replace with dedicated modal or isolated form components.
- Current create-product section embedded into the left column
  - Replace with a dialog-driven add/edit flow.

## 3. Existing Visual Patterns

### Confirmed visual language

- Warm orange primary accent: `#f45a1f`
- Soft beige page background from admin shell
- Rounded cards, large radii, subtle borders
- White card surfaces with slate text hierarchy
- Pill badges for statuses
- Soft red/amber/emerald feedback panels

### Confirmed layout patterns

- Shell + top header + content cards
- Master-detail workspace in Inventory
- Scroll-contained left list and right detail panels
- Table + card hybrid detail views
- Action rows with rounded pill buttons

### Confirmed form patterns

- Inputs are large, touch-friendly, rounded, and lightly bordered
- Labels are explicit and above controls
- Primary actions use filled buttons
- Secondary/destructive actions use bordered pills

## 4. Problems With the Current Products Page

### Major structural problems

1. The page is a monolith.
   - `ims-frontend/src/app/admin/products/page.tsx` is 1,145 lines.
   - It owns fetching, selection, forms, recipe drafting, usage querying, notices, and rendering.

2. Create and browse are mixed together.
   - The current page combines “browse products”, “create product”, “edit product”, “variants”, “recipe editor”, and “usage” in one continuously stacked workspace.
   - This weakens the selected-product context.

3. The selected-product experience is not dominant enough.
   - The left side is not a focused product navigator.
   - The right side does not function as a clear tabbed detail destination.

4. Availability is shown ambiguously.
   - Manual availability, stock availability, sellability, blocking reason, and archive state are all present conceptually, but the UI does not cleanly separate them into distinct labels and badges.

5. Variant and recipe concerns are blended awkwardly.
   - Variants are listed in one section, but recipe editing is tied to a second selection model below it.
   - Users must infer the relationship between selected variant cards and recipe editor state.

6. Ingredient usage is hard to scan.
   - It is technically functional, but visually buried below CRUD sections.
   - Per-order ingredient usage is mixed into the same area, increasing cognitive load.

7. Archive and edit actions are not sufficiently elevated.
   - Archive/restore, manual enable/disable, edit, delete, and variant actions are distributed across the page instead of being consolidated in a stable detail header/action zone.

8. Layout is inconsistent with Inventory.
   - Inventory already has a clear master-detail system with dedicated panels and scroll containment.
   - Products does not yet follow that proven structure.

9. Responsive behavior is weak.
   - The current page is desktop-first and stacks long sections on small screens without a clear list-first/detail-second navigation model.

10. Backend payload coupling is too direct.
   - `lib/products.ts` mixes frontend types with raw endpoint responses.
   - The route page is directly coded against those shapes.

11. Repeated fetching patterns are present.
   - The page refetches list and detail aggressively after mutations.
   - There is no dedicated adapter/cache layer to reconcile local updates predictably.

12. Loading and empty states are thin.
   - There is no dedicated empty-detail panel.
   - Skeletons are not specialized.
   - Text placeholders are basic.

## 5. Target Master-Detail Experience

## Left Panel

The left panel should become a stable product navigator.

It should contain:

- Search input
- Add Product button
- Active / Archived tabs
- Category filter
- Manual availability filter
- Effective availability filter
- Product list
- Per-row:
  - product name
  - category
  - variant count where space allows
  - ingredient count
  - effective availability badge
  - selected-row highlight
- Pagination controls

### Left-panel behavior

- Search and filters should update the list without tearing down the whole page.
- Selection should remain stable when possible after refreshes.
- Empty states should distinguish:
  - no products exist
  - no products match filters
  - archived tab has no items

## Right Panel

The right panel should be a focused selected-product workspace.

It should contain:

- Product header
  - name
  - category
  - archive state
  - manual availability
  - effective POS availability
- Primary actions
  - Edit Product
  - Enable / Disable Product
  - Archive Product
  - Restore Product
- Secondary actions only if still supported
  - Delete Product

### Recommended tabs

- `Overview`
- `Variants & Recipe`
- `Ingredient Usage`
- `History` only when backend history becomes real

### Overview

- Variant count
- Distinct ingredient count
- Product status summary
- Manual availability
- Effective POS availability
- Product warnings
- Archive metadata
- Delete eligibility if retained

### Variants & Recipe

- Variant list with strong row cards or compact table
- For each variant:
  - name
  - SKU
  - price
  - manual availability
  - stock availability
  - effective availability
  - blocking reason
  - ingredient count
- Variant-specific recipe panel
  - ingredient
  - quantity
  - native unit

### Ingredient Usage

- Scope switch: 1 day / 7 days / 30 days
- Covered dates summary
- Product units sold
- Distinct orders
- Ingredient usage table with:
  - ingredient
  - unit
  - gross deducted
  - reversed
  - net deducted
- Optional secondary panel:
  - variant usage breakdown

## 6. Required Frontend Data

| UI Area | Required Data | Required Endpoint | Loading Strategy | Error Strategy |
|---|---|---|---|---|
| Product list | id, name, category, variant count, ingredient count, manual status, effective status, archive state, updated at | `GET /admin/products` | initial page load + filter-driven reload | inline panel error with retry |
| Left-panel filters | categories, archive tab metadata if needed | `GET /categories` | eager on page load | non-blocking banner + disable category filter |
| Product detail header | product id, name, category, manual availability, effective availability, archive metadata, summary counts, warnings | `GET /admin/products/:id` | lazy on selection | detail-panel error state |
| Overview warnings | missing recipe, no sellable variants, unavailable variants, summary gaps, archive info, delete blockers | ideally included in detail response via adapter | bundled with detail | warning panel with graceful fallback |
| Variants | id, name, SKU, price, manual availability, stock availability, effective availability, blocking reason, ingredient count | included in detail | bundled with detail | tab-local fallback message |
| Recipe | selected variant recipe ingredients with quantity + unit | `GET /admin/variants/:id/recipe` | lazy when Variants & Recipe tab opens or variant changes | tab-local error panel |
| Raw materials for recipe editor | raw material options with unit metadata | existing inventory summary/material option source or dedicated lightweight endpoint | lazy when recipe editor opens | modal-local error |
| Ingredient usage | usage scope, covered dates, order count, units sold, ingredient rows, variant breakdown | `GET /admin/products/:id/ingredient-usage` | lazy when Ingredient Usage tab opens or scope changes | tab-local error panel |
| Archive metadata | archivedAt, archiveReason, archivedBy | included in detail | bundled with detail | show “Unavailable” if backend omits |
| Delete eligibility | eligible flag, blocking reasons | `GET /admin/products/:id/delete-eligibility` only if feature retained | lazy on destructive-action intent | dialog-local error |

### Recommended endpoint balance

- Keep `GET /admin/products` for list browsing.
- Keep one `GET /admin/products/:id` detail endpoint for stable overview/header data.
- Keep recipe separate per selected variant.
- Keep ingredient usage separate and lazy-loaded.
- Keep delete eligibility separate and intent-driven.

This is the safest balance because it avoids an oversized detail payload while still keeping the right panel coherent.

## 7. Required Frontend State

### URL query parameter state

These should live in the URL:

- `tab=active|archived`
- `search`
- `categoryId`
- `manualAvailability`
- `effectiveAvailability`
- `sortBy`
- `sortDirection`
- `page`
- `selectedProductId` when practical on desktop and mobile
- `detailTab=overview|variants|usage|history`

Reason:

- supports refresh persistence
- supports shareable admin state
- reduces local-state sprawl

### Page-level React state

Keep in page/workspace state:

- resolved selected product detail data
- selected variant id
- loading/error state per data resource
- toast/notice state
- active dialog state

### Form-local state

Keep local to modals/forms:

- product form draft
- variant form draft
- recipe draft
- unsaved change tracking
- validation messages

### Zustand usage decision

Do **not** create a new global products store for Phase 1.

Reason:

- Products state is page/workspace-specific.
- Inventory store is useful because inventory has cross-panel filters and modal control tightly bound to one workspace.
- For Products, URL state + workspace-local state is cleaner and less coupled.

### API adapter/cache layer

Recommended:

- keep transport in `ims-frontend/src/lib/products.ts`
- add a thin adapter/mapper layer so UI components consume stable frontend types
- cache currently selected detail and recipe/usage tab data in workspace state to avoid unnecessary refetching

## 8. Required API Contracts

These are frontend-facing contracts, not raw backend shapes.

```ts
export type ProductArchiveState = "ACTIVE" | "ARCHIVED";

export type ProductUsageScope = "ONE_DAY" | "LAST_7_DAYS" | "LAST_30_DAYS";

export type ProductAvailabilityStatus =
  | "ENABLED"
  | "DISABLED"
  | "AVAILABLE"
  | "PARTIALLY_AVAILABLE"
  | "OUT_OF_STOCK"
  | "NO_RECIPE"
  | "REQUIRED_MODIFIER_UNAVAILABLE"
  | "ARCHIVED"
  | "SELLABLE"
  | "UNAVAILABLE";

export type ProductQualityWarning =
  | {
      code:
        | "NO_VARIANTS"
        | "NO_RECIPE"
        | "NO_SELLABLE_VARIANTS"
        | "MISSING_AVAILABILITY_SUMMARY"
        | "USAGE_DATA_INCOMPLETE"
        | "DELETE_BLOCKED";
      severity: "info" | "warning" | "critical";
      title: string;
      description: string;
    };

export type ProductListItem = {
  id: string;
  name: string;
  category: {
    id: string;
    name: string;
  };
  archiveState: ProductArchiveState;
  manualAvailability: {
    isEnabled: boolean;
    label: "Enabled" | "Disabled";
  };
  effectiveAvailability: {
    status: ProductAvailabilityStatus;
    label: string;
    detail: string | null;
  };
  variantCount: number;
  ingredientCount: number;
  updatedAt: string | null;
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

export type RecipeIngredient = {
  rawMaterialId: string;
  rawMaterialName: string;
  quantity: string;
  unit: {
    id: string;
    code: string;
    name: string;
    dimension: string;
  };
};

export type ProductRecipe = {
  variantId: string;
  variantName: string;
  ingredientCount: number;
  items: RecipeIngredient[];
};

export type ProductVariantDetail = {
  id: string;
  name: string;
  sku: string;
  price: string;
  manualAvailability: {
    isEnabled: boolean;
    label: "Enabled" | "Disabled";
  };
  stockAvailability: {
    isInStock: boolean;
    label: "In Stock" | "Out of Stock";
    availableBaseQty: number | null;
  };
  effectiveAvailability: {
    isSellable: boolean;
    status: ProductAvailabilityStatus;
    label: string;
    blockingReason: string | null;
  };
  ingredientCount: number;
  recipeSummary?: ProductRecipe;
};

export type ProductAvailability = {
  archiveState: ProductArchiveState;
  manualAvailability: {
    isEnabled: boolean;
    label: "Enabled" | "Disabled";
  };
  effectiveAvailability: {
    status: ProductAvailabilityStatus;
    label: string;
    detail: string | null;
  };
};

export type ProductDetail = {
  id: string;
  name: string;
  category: {
    id: string;
    name: string;
  };
  availability: ProductAvailability;
  variantCount: number;
  ingredientCount: number;
  archive: {
    archivedAt: string | null;
    archiveReason: string | null;
    archivedBy:
      | {
          id: string;
          name: string;
          email: string;
        }
      | null;
  };
  warnings: ProductQualityWarning[];
  deleteEligibility?: {
    eligible: boolean;
    blockingReasons: Array<{
      code: string;
      message: string;
      count: number;
    }>;
  };
  variants: ProductVariantDetail[];
};

export type ProductIngredientUsage = {
  productId: string;
  productName: string;
  scope: ProductUsageScope;
  coveredDates: string[];
  startAt: string;
  endAt: string;
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
    grossDeducted: string;
    reversed: string;
    netDeducted: string;
  }>;
  variantBreakdown: Array<{
    variantId: string;
    variantName: string;
    sku: string;
    productUnitsSold: number;
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
```

### Contract direction

- Keep transport DTOs inside the API layer.
- Map them into the types above before rendering.
- This protects the frontend from backend redesign churn.

## 9. Proposed Component Architecture

Create these under `ims-frontend/src/components/admin/products/`.

### Workspace and layout

- `ProductsWorkspace.tsx`
  - top-level workspace controller
  - owns URL sync, data loading orchestration, and high-level state
- `ProductsMasterPanel.tsx`
  - left panel shell
  - contains toolbar + list + pagination
- `ProductDetailPanel.tsx`
  - right panel shell
  - owns detail tab rendering and empty/detail/skeleton/error states

### Left panel

- `ProductListToolbar.tsx`
  - search + add button + tab switcher
- `ProductFilters.tsx`
  - category/manual/effective filters
- `ProductList.tsx`
  - list container with loading/empty states
- `ProductListItem.tsx`
  - single row card/button with selected highlight and badges

### Right panel header and status

- `ProductDetailHeader.tsx`
  - product name, category, primary actions
- `ProductAvailabilitySummary.tsx`
  - manual vs effective availability and archive state badges
- `ProductQualityWarnings.tsx`
  - structured warning cards/pills

### Tabs

- `ProductOverviewTab.tsx`
  - summary metrics, archive metadata, warnings, delete blockers
- `ProductVariantsRecipeTab.tsx`
  - variant list + selected variant recipe view
- `ProductIngredientUsageTab.tsx`
  - scope switch + usage table + breakdown
- `ProductHistoryTab.tsx`
  - placeholder until backend history is real

### Forms and dialogs

- `ProductFormModal.tsx`
  - add/edit product
- `VariantFormModal.tsx`
  - add/edit variant
- `RecipeEditor.tsx`
  - ingredient list editing UI
- `ArchiveProductDialog.tsx`
  - archive confirmation + optional reason
- `RestoreProductDialog.tsx`
  - restore confirmation

### Utility states

- `EmptyProductSelection.tsx`
  - when no product is selected
- `ProductDetailSkeleton.tsx`
  - detail loading state

### Why this split

- prevents another oversized page component
- isolates unstable data-fetching concerns from presentation
- mirrors the proven inventory workspace structure
- keeps tabs lazily loadable

## 10. Form Experience

## Add Product

Fields:

- Product name
- Category
- Manual availability
- Initial variants
  - variant name
  - SKU
  - price
  - manual availability

Behavior:

- Open in modal
- Validate before submit
- Allow one default variant row and add-more behavior
- After successful creation:
  - close modal
  - refresh list
  - select created product
  - optionally land in Variants & Recipe tab

Recipe editing should happen **after creation** in Phase 1 unless backend contract stability makes a combined transaction safe.

## Edit Product

Fields:

- Product name
- Category
- Manual availability

Variant and recipe editing should stay in their own flows, not in one overloaded form.

## Variant Form

Fields:

- Variant name
- SKU
- Price
- Manual availability

Behavior:

- separate modal for add/edit
- no inline multi-row editing inside dense detail cards

## Recipe Editor

Fields and behavior:

- raw material search/select
- quantity input
- read-only native unit
- duplicate prevention
- remove line
- empty recipe warning
- unsaved-change prompt when closing

## Unsaved-change protection

Needed for:

- product form
- variant form
- recipe editor

Implementation direction:

- local dirty-state tracking per form/dialog
- confirm before close or tab switch if dirty

## 11. Availability UX

These must stay separate in the UI:

- Product manual availability
- Variant manual availability
- Stock availability
- Effective POS availability
- Archive state

### Recommended labels and badges

- `Enabled`
- `Disabled`
- `Available`
- `Partially Available`
- `Out of Stock`
- `No Recipe`
- `Required Modifier Unavailable`
- `Archived`
- `Sellable`
- `Unavailable`

### UX rule

Do not use one generic “Available” toggle.

Instead:

- manual state is a toggle or action
- stock/effective state is informational
- archive state is a lifecycle status

## 12. Accessibility and Responsive Behavior

## Accessibility

Phase 1 implementation should support:

- keyboard navigation through product list
- visible selected + focused list item states
- accessible tabs with proper roles and state
- modal focus trap
- escape-to-close
- explicit form labels
- field-level validation text
- badges that do not rely only on color
- clear labels for action buttons and icon-only controls
- confirmation steps for archive/restore/delete

## Desktop

- two-column master-detail layout
- sticky or visually stable left panel
- right panel uses remaining width
- tabs inside right panel, not page-level sections stacked endlessly

## Tablet

- narrower left panel
- detail remains visible
- filters can collapse into a compact row or accordion

## Mobile decision

Recommended choice:

- **product list first, then detail route-like state inside the same page flow**

Practical Phase 1 behavior:

- left panel becomes the initial list view
- selecting a product transitions to detail-first view
- include a back-to-list control

Reason:

- avoids forcing the desktop split layout onto phones
- simpler than a slide-over for a dense admin detail workspace
- consistent with master-detail semantics

## 13. Performance

Recommended behavior:

- paginated product list using existing backend pagination support
- lazy product detail fetch on selection
- lazy recipe fetch when variant context is needed
- lazy ingredient usage fetch when the tab is opened
- cache current detail and tab responses in workspace state
- avoid refetching detail after every small mutation when local reconciliation is enough
- debounced search, matching current inventory behavior
- loading skeletons for detail and list rows
- do not render all recipes at once
- abort stale requests during rapid selection/search changes

## 14. Risks and Blockers

1. Backend contracts are in flux.
   - Frontend must not hard-code directly against unstable payload shapes.

2. Current archive support is unstable across system layers.
   - The frontend should plan for archive state, but implementation must tolerate temporary backend inconsistency.

3. Current products page already assumes a lot from one detail payload.
   - Rebuild should reduce that coupling through an adapter layer.

4. No existing products component module exists.
   - Implementation will require a clean component decomposition from scratch.

5. Product quality warnings are not yet a first-class frontend concept.
   - The adapter layer may need to derive some warnings until backend stabilizes.

6. Mobile interaction model is not currently established for admin master-detail pages.
   - This must be decided before implementation starts.

## 15. Final Frontend Planning Verdict

### Components to reuse

- `AdminDashboardLayout`
- `AdminSidebar`
- `AdminHeader`
- Inventory split-panel visual patterns
- `InventoryField` input/label pattern
- Inventory modal composition style
- Manila date helpers
- POS availability vocabulary

### Components to replace

- `ims-frontend/src/app/admin/products/page.tsx`
- inline variant editing blocks
- embedded create-product section inside the browse panel

### New components needed

- full `components/admin/products/` workspace module
- left-panel navigator components
- right-panel detail/tabs components
- product/variant form dialogs
- recipe editor
- quality warnings and availability summary components
- skeleton and empty-selection components

### API contracts needed

- stable list contract
- stable detail contract
- lazy recipe contract
- lazy usage contract
- optional delete-eligibility contract
- archive metadata and warning contract

### Frontend risks

- backend churn
- archive-state instability
- overfetching if the detail contract stays too large
- another monolith if component boundaries are not enforced early

### Responsive decision

- desktop/tablet: split master-detail
- mobile: list-first, then detail view with back navigation

### Form decision

- modal-driven add/edit product
- modal-driven add/edit variant
- dedicated recipe editor panel/tab with dirty-state protection

### Recommended implementation direction

Build the Products section as a new workspace, not a refactor-in-place of the existing 1,145-line route component. Reuse the admin shell and inventory panel language, isolate API contracts behind frontend-facing types/adapters, and make the page selection-driven first, CRUD second.

