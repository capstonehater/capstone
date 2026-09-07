# Frontend Products Phase 2 Implementation Plan

## 1. Phase 1 Findings Adopted

The following Phase 1 findings are adopted without change and directly shape implementation:

- The current Products route is a route-level monolith in [page.tsx](C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-frontend/src/app/admin/products/page.tsx).
  - It is approximately 1,145 lines and mixes fetching, selection, mutation flows, recipe editing, usage loading, notices, and rendering.
- Inventory already demonstrates the correct visual and structural direction for an admin master-detail workspace.
  - Reference files:
    - [page.tsx](C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-frontend/src/app/admin/inventory/page.tsx)
    - [InventorySummaryPanel.tsx](C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-frontend/src/components/admin/inventory/InventorySummaryPanel.tsx)
    - [MaterialDetailPanel.tsx](C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-frontend/src/components/admin/inventory/MaterialDetailPanel.tsx)
- Existing reusable field and modal patterns are good enough to carry into Products.
  - [InventoryField.tsx](C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-frontend/src/components/admin/inventory/InventoryField.tsx)
  - [RawMaterialModals.tsx](C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-frontend/src/components/admin/inventory/RawMaterialModals.tsx)
- Existing availability vocabulary from POS is reusable and should remain separate by meaning.
  - [ProductConfiguratorModal.tsx](C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-frontend/src/components/staff-pos/modals/ProductConfiguratorModal.tsx)
- The current API helper in [products.ts](C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-frontend/src/lib/products.ts) couples transport, frontend types, and UI expectations too tightly.
- URL state should own selection, filters, pagination, and detail tab where practical.
- Mobile should use list-first, then detail-second behavior rather than forcing a split layout.
- Product detail, recipe, and ingredient usage should be lazy-loaded.
- Frontend-facing types must be stable and sit behind an adapter boundary.

### Adopted decisions

- Replace the existing page structurally.
- Create a dedicated products feature folder.
- Use Inventory-style master-detail layout.
- Use URL state plus workspace-local state.
- Do not introduce a new global Zustand store.
- Add a frontend adapter layer between backend DTOs and UI models.
- Lazy-load detail resources.
- Use dedicated dialogs for add/edit product and variant.
- Use a focused recipe editor with dirty-state protection.

## 2. Final UX Architecture

## Desktop layout

Use a two-column master-detail workspace.

### Left panel

- Search
- Add Product button
- Active / Archived segmented tabs
- Category filter
- Manual availability filter
- Effective availability filter
- Product list
- Pagination

### Right panel

- Product detail header
- Product actions
- Detail tabs
- Tab content
- Empty selection state
- Right-panel loading state
- Right-panel error state

## Tablet layout

- Keep the two-column structure while narrowing the master panel.
- Filters become compact and may collapse below the toolbar.
- Header actions wrap to multiple lines or move into a compact overflow cluster if needed.
- The detail panel remains visible in landscape tablet widths.

## Mobile layout

Adopt the approved list-first/detail-second flow.

- Initial mobile view is the list screen.
- Selecting a product shows the detail view.
- A back-to-products control returns to the filtered list.
- Search and filters remain preserved in URL/query state.
- Selected product remains encoded in URL where practical.
- The desktop split layout is not rendered at phone widths.

## 3. Page Layout Specification

## Final hierarchy

- Page container
- Page heading / intro card
- Products workspace
  - Product master panel
  - Product detail panel

## Chosen master panel width

Use a **fixed-width master panel between 380px and 400px on large desktop**.

### Why this option

- It matches the current visual rhythm of the Inventory workspace more closely than a percentage-based panel.
- Product list rows contain more metadata than inventory rows, but still benefit from a predictable scan width.
- A fixed-width navigator reduces layout jitter when the detail panel changes tab content.

### Recommended desktop grid

- `xl:grid-cols-[392px_minmax(0,1fr)]`

## Right panel

- Flexible remaining width
- Minimum usable width target: approximately 640px before the layout should transition
- Independent scrolling inside panel sections where necessary

## Panel heights and scrolling

### Desktop / large screens

- Workspace should fill the visible content area below the header as much as practical.
- Left panel:
  - sticky toolbar region inside panel
  - scrollable list body
- Right panel:
  - sticky detail header + tabs when appropriate
  - scroll-contained tab content

### Scroll containment

- Do not make the full page the only scroll container once the workspace is active.
- Keep:
  - product list scroll isolated
  - detail content scroll isolated

### Overflow behavior

- Tables in Ingredient Usage and variants recipe detail should use deliberate horizontal containers if needed.
- Mobile must avoid accidental full-page horizontal overflow.

### Spacing

- Keep the current admin shell spacing cadence:
  - outer sections `p-5` to `p-6`
  - card radii in the `rounded-2xl` to `rounded-[28px]` range
  - consistent 4/5/6 gap scale

### Empty states

- Left panel empty states should live inside the list body.
- Right panel empty state should fill the detail panel when nothing is selected.

## 4. Routing and URL-State Plan

## Final selection strategy

Use:

- `/admin/products?productId=<id>`

This becomes the canonical selection model for desktop, tablet, and mobile.

## Final URL parameters

- `productId=<id>`
- `view=active|archived`
- `search=<string>`
- `categoryId=<id>`
- `manualAvailability=enabled|disabled`
- `effectiveAvailability=<status>`
- `sortBy=name|updatedAt|variantCount|ingredientCount`
- `sortDirection=asc|desc`
- `page=<number>`
- `detailTab=overview|variants|usage`
- `variantId=<id>` optional, only when `detailTab=variants`

## Behavior rules

### Direct product URL

- If `productId` is valid and accessible under current filters, load the detail panel directly.
- If valid but excluded by current filters:
  - keep URL selection
  - show a detail-level notice that the selected product is outside the current list view
  - offer “clear filters” or “show product” behavior during implementation

### Refresh

- Refresh preserves:
  - active/archived view
  - filters
  - pagination
  - selected product
  - detail tab
  - selected variant when relevant

### Browser back and forward

- Query-state changes should be reflected through `router.replace` for transient typing updates where appropriate and `router.push` for meaningful navigation state changes where needed.
- Selection and tab changes should be back/forward navigable.

### Invalid product ID

- Clear `productId` from local resolved state.
- Show `ProductDetailError` or a not-found empty state in the detail panel.
- Preserve the list state.

### Product removed from current filters

- Keep current list response authoritative.
- If the selected product no longer belongs in the list:
  - preserve detail if URL still points at it
  - show that it is outside current filters
  - avoid silently switching selection unless the selected product was deleted

### Product archived while selected

- If current view is `active`:
  - archive success should refresh list
  - clear selection or move to next available active product
  - redirect URL away from the archived product unless the plan intentionally switches to archived view
- If current view is `archived`:
  - keep the archived product selected

### Product restored while selected

- If current view is `archived`:
  - refresh list
  - clear selection or offer switch to active view
- If current view is `active` after a restore action path:
  - keep selected if present in refreshed active results

### Mobile back navigation

- On mobile, when a product is selected:
  - show detail view
  - back button clears `productId` from URL and returns to list view

### Clear selection

- Clearing selection removes `productId`
- `variantId` should also be cleared
- `detailTab` may stay or reset to `overview`

## 5. Component Architecture

Create the feature folder:

- `ims-frontend/src/components/admin/products/`

### Workspace

| Component | Responsibility | Props | Local State | Data Dependency | Reusable Pattern |
|---|---|---|---|---|---|
| `ProductsWorkspace.tsx` | Own workspace orchestration, URL-state sync, data loading, dialog coordination, caches | none or thin route props | request state, dialog state, caches | list, categories, selected detail, recipe, usage | inventory page orchestration pattern |
| `ProductsMasterPanel.tsx` | Left-panel shell: toolbar, filters, list, pagination | list data, filters, selection, callbacks | none or minimal | list response | `InventorySummaryPanel` panel shell |
| `ProductDetailPanel.tsx` | Right-panel shell: header, tabs, tab content, empty/loading/error states | selected product state and callbacks | minimal tab-adjacent state only if needed | detail, recipe, usage | `MaterialDetailPanel` shell discipline |

### Master panel

| Component | Responsibility | Props | Local State | Data Dependency | Reusable Pattern |
|---|---|---|---|---|---|
| `ProductListToolbar.tsx` | Search, add button, active/archived segmented control | search value, view, callbacks | debounced input mirror if desired | none | inventory toolbar + report controls |
| `ProductFilters.tsx` | Category/manual/effective filters + clear filters | filter values, categories, callbacks | none | categories | inventory filter block |
| `ProductList.tsx` | Render list body, loading rows, empty states | list items, loading, selected id, callbacks | none | list items | inventory scroll table/card hybrid |
| `ProductListItem.tsx` | Compact product row | item, selected, focused, onSelect | hover/focus only | one product list item | inventory selected-row styling |
| `ProductListSkeleton.tsx` | Row skeletons during list loading | count | none | none | report/inventory loading placeholders |
| `ProductListEmptyState.tsx` | No results / no products / no archived products | mode, callbacks | none | none | dedicated empty-state card |
| `ProductPagination.tsx` | Prev/next and page summary | page, totalPages, totalItems, callbacks | none | pagination | reports pagination pattern |

### Detail header and tabs

| Component | Responsibility | Props | Local State | Data Dependency | Reusable Pattern |
|---|---|---|---|---|---|
| `ProductDetailHeader.tsx` | Name, category, archive state, action buttons | detail, action callbacks, loading flags | responsive overflow toggle only if needed | product detail | Material detail header action row |
| `ProductDetailTabs.tsx` | Overview / Variants / Usage tabs | active tab, callbacks, disabled states | none | none | tab group pattern |
| `ProductAvailabilitySummary.tsx` | Shared availability badges and copy | product or variant availability model | none | availability model | POS availability vocabulary |
| `ProductQualityWarnings.tsx` | Render warnings list/cards | warnings | none | detail warnings | alert/warning card pattern |

### Detail tabs

| Component | Responsibility | Props | Local State | Data Dependency | Reusable Pattern |
|---|---|---|---|---|---|
| `ProductOverviewTab.tsx` | Overview metrics, metadata, archive info, warnings, delete blockers | detail | none | product detail | metric tiles + warning panels |
| `ProductVariantsRecipeTab.tsx` | Variant nested master-detail and recipe summary | detail variants, selected variant, recipe data, callbacks | none or tiny display state | detail variants + recipe | nested master-detail based on Inventory |
| `ProductIngredientUsageTab.tsx` | Usage scope controls, caveats, metrics, usage table, variant breakdown | usage state, callbacks | scope/date control mirror if needed | usage report | report section pattern |

### Forms and dialogs

| Component | Responsibility | Props | Local State | Data Dependency | Reusable Pattern |
|---|---|---|---|---|---|
| `ProductFormDialog.tsx` | Create/edit product dialog | mode, initial values, categories, submit handlers, close handlers | full form draft, validation, dirty state | categories | Raw material modal structure |
| `VariantFormDialog.tsx` | Create/edit variant dialog | mode, initial values, submit handlers | full form draft, validation, dirty state | selected product/variant | modal form pattern |
| `RecipeEditor.tsx` | Focused recipe editor in large modal/dialog | variant, recipe draft, raw material options, submit handlers | draft rows, validation, dirty state | recipe + raw material options | dedicated editor, not inline |
| `ArchiveProductDialog.tsx` | Archive confirmation and optional reason | product, submit/close | reason input | selected product | destructive modal pattern |
| `RestoreProductDialog.tsx` | Restore confirmation | product, submit/close | none | selected product | confirmation modal |
| `DeleteProductDialog.tsx` | Conditional permanent delete flow | eligibility, submit/close | confirm state | delete eligibility | destructive modal |

### Utility states

| Component | Responsibility | Props | Local State | Data Dependency | Reusable Pattern |
|---|---|---|---|---|---|
| `EmptyProductSelection.tsx` | No selected product detail placeholder | actions optionally | none | none | dedicated panel empty state |
| `ProductDetailSkeleton.tsx` | Detail loading shell | none | none | none | report/inventory skeleton inspiration |
| `ProductDetailError.tsx` | Detail load failure or not-found state | message, retry | none | none | inline retryable error panel |

### Architectural rules

- No single component should own all requests.
- No component should own every dialog and every render branch besides `ProductsWorkspace`.
- Presentation components should not receive raw backend DTOs.
- Availability formatting must be centralized through shared formatter utilities or shared UI components.

## 6. Route-Level Responsibility

The new route file:

- [page.tsx](C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-frontend/src/app/admin/products/page.tsx)

should become a thin route wrapper.

### It should do only this

- render the page intro wrapper if retained
- render `ProductsWorkspace`

### It should not do this

- own large forms
- own API mapping logic
- own tab logic
- own all list/detail requests
- directly orchestrate every mutation

### Target size

- approximately **40 to 100 lines**

The route must not become another monolith.

## 7. Frontend API Adapter

Refactor [products.ts](C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-frontend/src/lib/products.ts) into a clearer boundary.

### Recommended structure

- `ims-frontend/src/lib/products/types.ts`
  - frontend-facing types only
- `ims-frontend/src/lib/products/dto.ts`
  - transport DTO request/response types
- `ims-frontend/src/lib/products/mappers.ts`
  - adapter functions from DTO to frontend models
- `ims-frontend/src/lib/products/api.ts`
  - request functions
- `ims-frontend/src/lib/products/errors.ts`
  - normalized error mapping
- `ims-frontend/src/lib/products/index.ts`
  - public exports

If the team prefers fewer files, the minimum acceptable split is still:

- transport DTOs
- frontend types
- mapping functions
- request helpers

### Function plan

| Function | Request | Raw Response | Frontend Return Type | Error Cases | Refresh/Invalidation |
|---|---|---|---|---|---|
| `listProducts` | filters + pagination + `AbortSignal` | list DTO | `ProductListResponse` | 400, network, unauthorized, malformed payload | invalidates list cache key only |
| `getProductDetail` | `productId`, optional `AbortSignal` | detail DTO | `ProductDetail` | 404, 409, network | invalidates detail cache for product |
| `createProduct` | `ProductFormInput` | detail DTO | `ProductDetail` | validation, duplicate name/SKU, network | refresh list + detail selection |
| `updateProduct` | `productId`, partial form input | detail DTO | `ProductDetail` | validation/conflict | refresh detail + list summary |
| `setProductManualAvailability` | `productId`, boolean | detail DTO | `ProductDetail` | conflict/network | refresh detail + list summary |
| `createVariant` | `productId`, `VariantFormInput` | detail DTO | `ProductDetail` | duplicate SKU/name, validation | refresh detail + list summary |
| `updateVariant` | `variantId`, `VariantFormInput` subset | detail DTO | `ProductDetail` | validation/conflict | refresh detail + list summary |
| `setVariantManualAvailability` | `variantId`, boolean | detail DTO | `ProductDetail` | conflict/network | refresh detail + list summary |
| `deleteVariant` | `variantId` | detail DTO | `ProductDetail` | blocked/conflict | refresh detail + list summary; clear selected variant if removed |
| `getVariantRecipe` | `variantId`, optional `AbortSignal` | recipe DTO | `ProductRecipe` | 404, network | invalidates recipe cache for variant |
| `replaceVariantRecipe` | `variantId`, `RecipeFormInput` | recipe+detail DTO | `{ recipe: ProductRecipe; product: ProductDetail }` | validation/conflict | invalidate recipe cache + refresh detail summary |
| `getProductIngredientUsage` | `productId`, scope/date filters, optional `AbortSignal` | usage DTO | `ProductIngredientUsage` | validation, unavailable history, network | cache by product/scope/date key |
| `archiveProduct` | `productId`, optional reason | detail DTO | `ProductDetail` | blocked/conflict | refresh list + selection handling by current view |
| `restoreProduct` | `productId` | detail DTO | `ProductDetail` | conflict/network | refresh list + detail |
| `getProductDeleteEligibility` | `productId`, optional `AbortSignal` | eligibility DTO | `DeleteEligibility` | 404/conflict/network | no broad invalidation |
| `deleteProduct` | `productId` | delete DTO | `{ deleted: true; productId: string }` | blocked/conflict | refresh list, clear selection |

### Adapter requirements

- No raw Prisma model types on the frontend.
- No `any`.
- Decimal prices and quantities remain strings.
- Accept `AbortSignal` where practical for list/detail/recipe/usage/eligibility reads.
- Normalize backend errors into stable `Error` messages plus optional structured metadata later.
- Map unstable backend status values into stable frontend enums/unions.
- Prevent backend contract churn from leaking into presentation components.

## 8. Frontend-Facing Type Plan

### Core unions

```ts
export type ProductArchiveState = "ACTIVE" | "ARCHIVED";

export type ProductEffectiveStatus =
  | "SELLABLE"
  | "PARTIALLY_AVAILABLE"
  | "MANUALLY_DISABLED"
  | "OUT_OF_STOCK"
  | "NO_RECIPE"
  | "REQUIRED_MODIFIER_UNAVAILABLE"
  | "NO_SELLABLE_VARIANT"
  | "ARCHIVED"
  | "UNKNOWN";

export type ProductUsageScope = "ONE_DAY" | "LAST_7_DAYS" | "LAST_30_DAYS";
```

### Availability models

```ts
export type ProductManualAvailability = {
  isEnabled: boolean;
  label: "Enabled" | "Disabled";
};

export type ProductStockAvailability = {
  isInStock: boolean | null;
  label: "In Stock" | "Out of Stock" | "Partial" | "Unknown";
  availableBaseQty: number | null;
};
```

### Warnings and delete eligibility

```ts
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

export type DeleteEligibility = {
  eligible: boolean;
  blockingReasons: Array<{
    code: string;
    message: string;
    count: number;
  }>;
};
```

### Primary models

```ts
export type ProductListItem = {
  id: string;
  name: string;
  category: {
    id: string;
    name: string;
  };
  archiveState: ProductArchiveState;
  manualAvailability: ProductManualAvailability;
  effectiveStatus: ProductEffectiveStatus;
  effectiveStatusLabel: string;
  effectiveStatusDetail: string | null;
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
  manualAvailability: ProductManualAvailability;
  stockAvailability: ProductStockAvailability;
  effectiveStatus: ProductEffectiveStatus;
  effectiveStatusLabel: string;
  blockingReason: string | null;
  ingredientCount: number;
};

export type ProductDetail = {
  id: string;
  name: string;
  category: {
    id: string;
    name: string;
  };
  archiveState: ProductArchiveState;
  manualAvailability: ProductManualAvailability;
  effectiveStatus: ProductEffectiveStatus;
  effectiveStatusLabel: string;
  effectiveStatusDetail: string | null;
  variantCount: number;
  ingredientCount: number;
  updatedAt: string | null;
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
  deleteEligibility?: DeleteEligibility;
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
  usageDataComplete: boolean;
  caveat: string | null;
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

### Fallback strategy for unknown backend values

- Unknown backend effective statuses should map to:
  - `effectiveStatus: "UNKNOWN"`
  - `effectiveStatusLabel: "Unknown"`
  - `effectiveStatusDetail: raw backend value if useful`

This prevents rendering failure during backend redesign.

## 9. State Ownership Plan

## URL state

- `productId`
- `view`
- `search`
- `categoryId`
- `manualAvailability`
- `effectiveAvailability`
- `sortBy`
- `sortDirection`
- `page`
- `detailTab`
- optional `variantId`

## Workspace state

- product list response
- categories
- selected product detail cache
- recipe cache keyed by variant id
- ingredient usage cache keyed by product + scope + date key
- request loading flags by resource
- request errors by resource
- active dialog key
- success/error notices

## Form-local state

- product draft
- variant draft
- recipe draft
- validation map
- dirty state
- submission state

## Global state

No Products Zustand store is planned.

### Why URL state + workspace state is sufficient

- Product state is page-specific and tied to route filters.
- Selection and filters benefit from URL persistence.
- Loaded resources and transient request state belong to the workspace boundary.
- Dialog form state is short-lived and isolated.
- A global store would add coupling without meaningful cross-route benefit.

## 10. Data-Loading Strategy

## Product list

- Load on URL filter changes.
- Debounce search.
- Abort stale list requests.
- Show row skeletons during first load.
- Keep previous list visible during filter transitions where helpful.

## Product detail

- Load on selected `productId` change.
- Cache recently selected details in workspace state.
- Abort stale selection requests.
- Show right-panel skeleton only.

## Recipe

- Load only when:
  - `detailTab=variants`
  - and a selected variant exists
- Cache per variant id.
- Invalidate after recipe save or variant deletion.

## Ingredient usage

- Load only when:
  - `detailTab=usage`
  - and the scope/date inputs are valid
- Cache by:
  - product id
  - scope
  - date key
- Cancel stale scope/date requests.

## Categories

- Load once on workspace initialization.
- Failure must not block the full page.
- Category filter should disable gracefully if categories fail to load.
- Product form should explain category-loading failure clearly if it cannot proceed.

## Mutation refresh policy

- Prefer:
  - local optimistic-safe UI updates only where trivial
  - followed by authoritative detail refresh
- Avoid full-page reload behavior.

## 11. Product Master Panel Plan

## Toolbar

- Search input
- Add Product button
- Active / Archived segmented control

## Filters

- Category
- Manual availability
- Effective availability
- Clear filters action

### Filter visibility decision

- Desktop: always visible below toolbar
- Tablet: compact row with wrapping
- Mobile: collapsible filter block under toolbar

## Product list item design

Each row shows:

- Product name
- Category
- Ingredient count
- Effective status badge
- Variant count only when space permits

### Manual status in row

- Keep manual status as a secondary compact badge or omit it from the row if density becomes too high.
- It must remain clearly visible in the detail header.

### Selected item treatment

- Strong selected background
- Visible accent border or left indicator
- Keyboard focus distinct from selection

## 12. Product Detail Header Plan

Header shows:

- Product name
- Category
- Archive state
- Manual availability
- Effective POS availability

### Primary actions

- Edit Product
- Enable / Disable Product
- Archive Product
- Restore Product when archived

### Optional actions

- Delete Product only when backend eligibility allows it

### Responsive action behavior

- Desktop: full labeled buttons
- Tablet: wrapped buttons
- Mobile: compact action row and optional overflow grouping

### Action state behavior

- each action disables itself during submit
- prevent double-submit
- keep unrelated actions disabled when a conflicting destructive action is running

## 13. Overview Tab Plan

Display:

- Variant count
- Distinct ingredient count
- Manual availability
- Effective availability
- Updated date
- Product quality warnings
- Archive metadata when archived
- Delete blockers when relevant

## Warning source strategy

Prefer:

- backend-authoritative warnings for integrity issues

Fallback:

- derive lightweight warnings in adapter for clearly observable conditions

Best practical implementation:

- combination of backend + adapter-derived warnings
- adapter may add `UNKNOWN` or UI-only caveats without claiming system truth

## 14. Variants and Recipe Tab Plan

Use a nested master-detail pattern.

### Variant area

- Variant list or compact table in one region
- Selected variant recipe in adjacent or lower region depending on width

### Variant row contents

- Name
- SKU
- Price
- Manual availability
- Stock availability
- Effective availability
- Blocking reason
- Ingredient count

### Variant actions

- Add Variant
- Edit Variant
- Enable / Disable Variant
- Delete Variant when safe
- Edit Recipe

### Recipe view

- Ingredient
- Quantity
- Native unit
- Empty recipe state
- Edit Recipe button

### Variant selection behavior

- Auto-select first variant when tab opens if none selected
- Preserve current variant where possible
- If deleted, select next available variant or clear selection
- `variantId` may be stored in URL only when the variants tab is active

## 15. Recipe Editor Plan

## Final interaction pattern

Use a **large modal or right-side dialog**, not an inline editor inside dense detail content.

### Fields

- Raw material selector
- Quantity
- Read-only native unit
- Remove row
- Add ingredient

### Validation

- duplicate raw material
- missing raw material
- empty quantity
- zero quantity
- negative quantity
- invalid decimal
- inactive raw material if surfaced by source data

### Dirty-state behavior

- warn on close
- warn on selected variant change
- warn on product change
- preserve draft until explicit discard or successful save

### Clarifying message

The editor should explain:

- recipe changes affect future sales and future availability calculations
- historical usage remains unchanged

## 16. Ingredient Usage Tab Plan

### Supported scopes

- 1 Day
- 7 Days
- 30 Days

Per-order mode is excluded from the Phase 2 implementation plan because the current brief says not to include it unless it remains in the approved backend contract.

### Controls

- segmented scope switch
- one-day date picker for `ONE_DAY`
- end-date picker for 7-day and 30-day views

### Display

- covered date range
- distinct order count
- product units sold
- ingredient usage table

### Table columns

- Ingredient
- Unit
- Gross deducted
- Reversed
- Net deducted

### Optional secondary display

- variant breakdown panel

### Rules

- Never aggregate unlike units into one grand total.
- Explain reversed values in plain language.
- Show data-quality caveat when backend or adapter indicates incomplete usage history.
- Provide explicit loading, error, and no-data states.

## 17. Product Form Plan

Use one reusable dialog with `create` and `edit` modes only because scope remains manageable.

## Create mode

Fields:

- Product name
- Category
- Product manual availability
- Initial variants
  - name
  - SKU
  - price
  - manual availability

Requirements:

- at least one variant
- add/remove variant rows
- duplicate variant name detection within form
- duplicate SKU detection within form
- decimal-safe price handling
- backend remains final authority

### After creation

- close dialog
- refresh list
- select created product
- open `detailTab=variants`
- guide the user to configure recipes

## Edit mode

Fields:

- Product name
- Category
- Product manual availability

Variants and recipes remain separate flows.

## 18. Variant Form Plan

Fields:

- Variant name
- SKU
- Price
- Manual availability

Modes:

- Create
- Edit

Behavior:

- client validation
- backend error mapping
- loading state
- preserve unsaved values on failed submit
- refresh detail after success
- refresh list summary if counts or availability change

### Delete behavior

- use backend eligibility response or conflict handling
- show structured blockers
- never infer delete safety from frontend-only knowledge

## 19. Availability UX Plan

Keep these separate:

### Product manual state

- Enabled
- Disabled

### Variant manual state

- Enabled
- Disabled

### Stock state

- In Stock
- Out of Stock
- Partial
- Unknown

### Effective POS state

- Sellable
- Partially Available
- Unavailable
- Archived

### Blocking reasons

- No recipe
- Insufficient stock
- Disabled product
- Disabled variant
- Required modifier unavailable
- Unknown backend state

### Shared formatting decision

Create a shared formatter or presentation helper so labels are consistent across:

- product list
- detail header
- overview tab
- variants tab
- dialogs

## 20. Archive and Restore Plan

## Archive dialog

Explain:

- product disappears from POS availability
- historical orders remain
- recipes remain
- ingredient usage remains
- manual enabled state may still exist but does not make archived items sellable
- restore does not guarantee sellability

Fields:

- optional archive reason

### After success

- refresh list
- if archived view is active, keep selection where possible
- if active view is active, clear selection or move to next active product

## Restore dialog

Explain:

- product returns to the active catalog
- actual sellability still depends on manual status, recipe, stock, and modifiers

### After success

- refresh list
- if active view is current, preserve selection where practical
- refresh detail

## 21. Delete Plan

Permanent delete remains secondary.

### Flow

- request delete eligibility only when user opens delete action
- show blocking reasons
- disable destructive confirmation when blocked
- recheck through backend during delete call
- handle conflict if eligibility changed
- refresh list after success

Delete must not be the primary header action.

Archive is the normal lifecycle operation.

## 22. Empty, Loading, and Error States

## Product list states

- initial loading
- filter transition loading
- no products exist
- no search results
- no archived products
- request error

## Product detail states

- no selection
- loading
- product not found
- archived product still viewable in archived mode
- request error

## Recipe states

- loading
- empty recipe
- request error

## Usage states

- loading
- no data
- incomplete-data warning
- request error

Every retryable failure should include a retry path.

## 23. Responsive Implementation Plan

## Large desktop

- full two-panel layout
- left panel about 392px
- right panel flexible
- independent scrolling

## Laptop / tablet landscape

- narrower master panel if needed
- reduced padding
- action wrapping
- compact filters

## Tablet portrait

- may transition to a single-pane behavior when width becomes too constrained
- list and detail can switch based on selection
- back button becomes visible

## Mobile

- list-first
- detail replaces list on selection
- back navigation clears selection
- dialogs become full-screen or near-full-screen
- touch targets stay comfortably tappable
- horizontal overflow only inside intentional scroll containers

## 24. Accessibility Plan

### Acceptance criteria

- product list keyboard navigable
- selected and focused rows visually distinct
- tabs use proper ARIA semantics
- dialogs trap focus
- focus returns to the triggering control
- escape closes non-destructive dialogs when safe
- fields have explicit labels
- validation messages associate with fields
- statuses use text and color
- icon-only actions have accessible names
- archive and delete require explicit confirmation
- errors are announced where practical
- mobile back control is accessible

## 25. Performance Plan

- debounced search
- request cancellation
- paginated list
- lazy detail
- lazy recipe
- lazy usage
- workspace-level caching
- stable component keys
- memoization only where clearly useful
- avoid loading every recipe
- avoid loading usage before tab open
- avoid full-page reload after mutations
- update local UI where safe, then refetch authoritative detail
- prevent duplicated requests during rapid selection

### Acceptable query behavior

- one list request per filter state
- one detail request per selected product
- one recipe request per selected variant when needed
- one usage request per product/scope/date combination

## 26. Test Strategy

## Current test setup inspection

- `ims-frontend/package.json` includes:
  - `build`
  - `lint`
- It does **not** declare:
  - Jest
  - Vitest
  - Playwright
  - React Testing Library
- A Playwright reference exists only inside `package-lock.json`, not as a clearly supported repository workflow.

### Conclusion

There is no reliable first-party frontend feature test setup to assume for this implementation phase.

## Planned validation strategy

### Automated where currently supported

- TypeScript correctness through Next build
- ESLint through `npm run lint`

### Manual acceptance plan

#### Workspace

- route renders under admin guard
- empty selection state appears correctly
- direct `productId` URL opens detail
- back/forward restores list and detail state

#### Product list

- loading state
- empty state
- error state
- search
- filters
- active/archived switching
- pagination
- selected state persistence

#### Product detail

- header
- overview
- availability summary
- warnings
- archived metadata

#### Variants and Recipe

- variant selection
- recipe loading
- empty recipe
- recipe error
- add/edit variant flows
- recipe validation and dirty-state protection

#### Usage

- scope switching
- date changes
- loading
- no data
- reversal explanations
- incomplete-data warning

#### Actions

- edit product
- enable/disable product
- archive
- restore
- delete blocked
- delete allowed

#### Accessibility

- keyboard selection
- tab navigation
- dialog focus return
- accessible action labels

## 27. Implementation Work Packages

| Work Package | Exact Files | Dependencies | Tasks | Risks | Acceptance Criteria | Effort |
|---|---|---|---|---|---|---|
| `WP1 - Frontend-facing types and API adapter` | `ims-frontend/src/lib/products/` new module files or refactor of existing [products.ts](C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-frontend/src/lib/products.ts) | none | define stable types, DTOs, mappers, request helpers | backend contract churn | UI can consume stable models without raw DTO leakage | M |
| `WP2 - URL state and route shell` | [page.tsx](C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-frontend/src/app/admin/products/page.tsx), new URL helper utilities if needed | WP1 | thin route, query parsing, selection/filter sync | duplicate URL/local state | route becomes thin and query-driven | M |
| `WP3 - Workspace and master-detail layout` | `ims-frontend/src/components/admin/products/ProductsWorkspace.tsx`, `ProductsMasterPanel.tsx`, `ProductDetailPanel.tsx` | WP2 | create overall workspace shell and panel structure | layout rework | split layout works on desktop/tablet/mobile | M |
| `WP4 - Product master panel` | `ProductListToolbar.tsx`, `ProductFilters.tsx`, `ProductList.tsx`, `ProductListItem.tsx`, `ProductListSkeleton.tsx`, `ProductListEmptyState.tsx`, `ProductPagination.tsx` | WP3 | implement toolbar, filters, list, pagination | row density and filter complexity | left panel fully functional and scannable | M |
| `WP5 - Product detail header and tabs` | `ProductDetailHeader.tsx`, `ProductDetailTabs.tsx`, `ProductAvailabilitySummary.tsx`, `ProductQualityWarnings.tsx`, `EmptyProductSelection.tsx`, `ProductDetailSkeleton.tsx`, `ProductDetailError.tsx` | WP3 | build detail shell states and actions | action density | right panel has stable header, tabs, states | M |
| `WP6 - Overview tab` | `ProductOverviewTab.tsx` | WP5 | overview metrics, archive metadata, warnings, blockers | warning source ambiguity | overview is readable and complete | S |
| `WP7 - Variants and Recipe tab` | `ProductVariantsRecipeTab.tsx` | WP5, WP1 | nested variant selector and recipe display shell | selection complexity | variant browsing is clear | M |
| `WP8 - Recipe editor` | `RecipeEditor.tsx` | WP7, WP1 | dialog/editor, validation, dirty-state handling | unsaved change handling | recipe editing is focused and safe | M |
| `WP9 - Ingredient Usage tab` | `ProductIngredientUsageTab.tsx` | WP5, WP1 | lazy usage loading UI, scope/date controls, caveats | incomplete backend support | usage data is understandable and lazy-loaded | M |
| `WP10 - Product form` | `ProductFormDialog.tsx` | WP5, WP1 | create/edit product form, validation, success flow | category loading failures | create/edit product flow works cleanly | M |
| `WP11 - Variant form` | `VariantFormDialog.tsx` | WP7, WP1 | create/edit variant form | backend conflicts | variant flows are isolated and safe | S |
| `WP12 - Availability actions` | primarily `ProductDetailHeader.tsx`, variant action areas, adapter helpers | WP5, WP7, WP1 | enable/disable product and variant actions | ambiguous status feedback | manual availability actions remain distinct from computed status | S |
| `WP13 - Archive and restore` | `ArchiveProductDialog.tsx`, `RestoreProductDialog.tsx`, detail header wiring | WP5, WP1 | archive/restore dialogs and selection/list refresh behavior | backend archive instability | archive/restore flows are understandable and state-safe | S-M |
| `WP14 - Delete eligibility` | `DeleteProductDialog.tsx`, detail header/action wiring | WP5, WP1 | lazy eligibility request and destructive flow | changing eligibility state | delete remains secondary and safe | S |
| `WP15 - Loading, empty, and error states` | all new products components | WP3-WP14 | unify skeletons, empty states, retry states | inconsistent UX | every major resource has a dedicated state | S |
| `WP16 - Responsive behavior` | all new products components, especially workspace/panels/dialogs | WP3-WP15 | desktop/tablet/mobile behavior tuning | layout regressions | mobile list-first/detail-second works cleanly | M |
| `WP17 - Accessibility` | all new products components and dialogs | WP3-WP16 | ARIA, focus, keyboard flows, labels, confirmations | dialog and tab semantics | defined a11y criteria are met | M |
| `WP18 - Tests and manual acceptance` | manual QA checklist doc updates and any lightweight repo-native checks if later discovered | WP3-WP17 | execute manual scenarios and document gaps | no formal test runner | manual acceptance is explicit and repeatable | S |
| `WP19 - Build, lint, and documentation` | updated docs if needed, final product module files | WP1-WP18 | run build/lint, tighten docs | repo-wide unrelated lint issues | feature builds and lint checks pass or issues are documented | S |

## 28. Implementation Sequence

### Safest order

1. Define frontend types.
2. Build adapter mappings.
3. Establish URL-state utilities.
4. Create workspace shell.
5. Build product list.
6. Build product detail header.
7. Add detail tabs.
8. Add Overview.
9. Add Variants and Recipe.
10. Add recipe editor.
11. Add Ingredient Usage.
12. Add product form.
13. Add variant form.
14. Add availability actions.
15. Add archive and restore.
16. Add delete eligibility.
17. Add responsive behavior.
18. Add accessibility.
19. Add tests/manual acceptance.
20. Run build and lint validation.

### Why this order is safest

- Types and adapter boundaries come first, which prevents unstable backend DTO assumptions from spreading into UI code.
- URL-state utilities come before the workspace so selection and filter ownership are settled early.
- Layout shell comes before feature-specific tabs, reducing rework.
- Variants, recipe, and usage are added after the stable detail shell exists.
- Form flows come after the display structure, which keeps mutations from driving layout decisions.
- Responsive and accessibility passes come after the full interaction tree exists, but before final validation.

## 29. Backend-Contract Readiness

| Frontend Need | Endpoint | Contract Status | Adapter Strategy | Blocker |
|---|---|---|---|---|
| Product list | `GET /admin/products` | Stable | map into `ProductListResponse` | none major |
| Product detail | `GET /admin/products/:id` | Provisional | adapt current payload into stable `ProductDetail` and derive fallbacks | backend may evolve warning/archive fields |
| Categories | `GET /categories` | Stable | pass through minimal mapped category model | none major |
| Product create | `POST /admin/products` | Provisional | map current detail response | backend create payload could evolve |
| Product update | `PATCH /admin/products/:id` | Provisional | map current detail response | archive/manual state semantics may shift |
| Product manual availability | `PATCH /admin/products/:id/manual-availability` | Provisional | normalize to stable detail model | none major |
| Archive product | `POST /admin/products/:id/archive` | Provisional | tolerate archive metadata gaps | backend archive state may be unstable |
| Restore product | `POST /admin/products/:id/restore` | Provisional | same as above | same |
| Delete eligibility | `GET /admin/products/:id/delete-eligibility` | Stable enough | map directly to `DeleteEligibility` | none major |
| Delete product | `DELETE /admin/products/:id` | Provisional | treat conflicts as authoritative blockers | depends on backend lifecycle rules |
| Create variant | `POST /admin/products/:id/variants` | Provisional | map refreshed detail | none major |
| Update variant | `PATCH /admin/variants/:id` | Provisional | map refreshed detail | none major |
| Variant manual availability | `PATCH /admin/variants/:id/manual-availability` | Provisional | map refreshed detail | none major |
| Delete variant | `DELETE /admin/variants/:id` | Provisional | handle blockers and refresh detail | none major |
| Variant recipe | `GET /admin/variants/:id/recipe` | Stable enough | map to `ProductRecipe` | contract could widen |
| Replace recipe | `PUT /admin/variants/:id/recipe` | Provisional | map recipe + detail response | validation contract may evolve |
| Product ingredient usage | `GET /admin/products/:id/ingredient-usage` | Provisional | map to stable usage model and support caveats | backend completeness signal may not exist yet |
| Raw materials for recipe editor | currently derived from inventory summary or existing inventory source | Mockable / Provisional | wrap behind products adapter or temporary feature helper | backend may later provide a dedicated lightweight endpoint |

### Adapter rule

Provisional contracts must be normalized before reaching presentation components.

### If endpoints are missing in Phase 3

- use typed temporary fixtures only behind the adapter
- clearly mark them as temporary
- do not hardcode production UI data directly in components
- do not claim integration success until backend wiring is real

## 30. Phase 3 Entry Checklist

- Route selection strategy is final.
- URL parameter names are final.
- Component tree is final.
- API adapter boundary is defined.
- Frontend-facing types are defined.
- Product list data is known.
- Product detail data is known.
- Recipe data is lazy-loaded.
- Usage data is lazy-loaded.
- Forms are separated.
- Availability states are separate.
- Archive state is separate.
- Mobile behavior is final.
- Accessibility requirements are defined.
- Test strategy is defined.
- Backend contract gaps are documented.

## 31. Final Phase 2 Verdict

### Final route behavior

- `/admin/products` remains the route
- query string owns selection and filter/navigation state
- route file becomes thin and renders a workspace

### Final master-detail dimensions

- desktop left panel: about 392px
- desktop right panel: flexible remaining width
- independent scroll containment in both panels

### Final component tree

- dedicated `components/admin/products/` feature module
- workspace shell
- master panel
- detail panel
- tabs
- dialogs
- empty/loading/error states

### Final API adapter structure

- separate DTOs, frontend types, mappers, request helpers, and error normalization
- no raw backend payloads in presentation components

### Final frontend types

- stable unions for archive/effective status
- explicit manual and stock availability models
- decimal-safe string fields
- safe `UNKNOWN` fallback

### Final state ownership

- URL state for navigation/filter/selection
- workspace state for loaded data, caches, dialogs, request state
- form-local state for drafts and validation
- no new global store

### Final data-loading strategy

- paginated list
- lazy detail
- lazy recipe
- lazy usage
- request cancellation
- cache by entity/scope key

### Final product-list design

- search
- add button
- active/archived segmented view
- compact filters
- selected-row emphasis
- compact, scannable rows

### Final product-detail design

- strong header
- clear action zone
- overview / variants / usage tabs
- dedicated empty/loading/error states

### Final recipe-editing design

- focused modal/dialog editor
- validation + dirty-state protection
- no dense inline editing as the primary interaction

### Final ingredient-usage design

- one-day / seven-day / thirty-day scopes
- no per-order mode in this phase plan
- clear reversal and data-quality handling

### Final availability design

- keep manual, stock, effective, and archive state separate
- centralize labels and badges

### Final archive/restore design

- archive is the primary lifecycle action
- restore has explicit caveats
- delete remains secondary and guarded

### Final responsive design

- desktop/tablet split workspace
- mobile list-first then detail
- back navigation clears selection

### Final accessibility requirements

- keyboard list navigation
- accessible tabs
- dialog focus control
- labeled actions and validation
- non-color-only statuses

### Final test strategy

- manual acceptance plus build/lint validation
- no assumption of a supported frontend unit/integration test runner yet

### Main risks

- backend contract churn
- archive endpoint/state instability
- accidental reintroduction of a monolith
- overfetching if adapter/cache boundaries are weak

### Recommended first implementation work package

- `WP1 - Frontend-facing types and API adapter`

