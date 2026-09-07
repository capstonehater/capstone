# Product Management - Phase 2 Implementation Plan

## 1. Phase 1 Findings Adopted

The following Phase 1 findings are accepted without change and shape the full implementation plan:

- `Product` remains the menu-level entity.
- `ProductVariant` remains the sellable, priced entity.
- Base recipes remain variant-owned through `VariantRecipeItem`.
- Modifier ingredient deltas remain modifier-owned through `ModifierRecipeAdjustment`.
- `Product.isEnabled` already exists and must remain the product-level manual availability field.
- `ProductVariant.isEnabled` already exists and must remain the variant-level manual availability field.
- `InventoryTransactionLine.rawMaterialId`, `productVariantId`, `orderItemId`, and `stockBatchId` already provide the historical attribution needed for ingredient-usage reporting.
- Checkout is already backend-authoritative and FEFO-backed through `OrdersService`, `RecipeResolverService`, `FEFOAllocator`, and `InventoryLedgerService`.
- Void/refund already produce positive reversal ledger lines with preserved attribution.
- `VariantAvailabilitySummary.isInStock`, `isSellable`, and `blockingReason` already provide the authoritative variant-level availability output.
- Product-level archive state is missing and must be modeled separately from `isEnabled`.
- There is no `/admin/products` route or administrator product-management workspace yet.
- The future UI must reuse the current orange-and-white admin patterns from the inventory/admin shell.

Accepted Phase 1 recommendations:
- Add `/admin/products` rather than overloading `/admin/inventory`.
- Reuse existing product, variant, recipe, ledger, availability, order, and POS architecture.
- Do not create a product-level recipe system.
- Build historical ingredient usage from inventory ledger records, not current recipe reconstruction.
- Keep manual availability separate from stock-derived availability.
- Add only the minimum product archive schema needed for archive/restore lifecycle behavior.

## 2. Final Feature Scope

### Included backend functionality
- Administrator-facing product list and product detail queries
- Product create and update lifecycle
- Variant create, update, manual enable/disable, and safe deletion checks
- Variant recipe read and replace operations
- Product-level distinct ingredient count derivation
- Product ingredient-usage analytics for:
  - specific order
  - one Manila business day
  - last 7 Manila business days
  - last 30 Manila business days
- Product archive and restore lifecycle
- Safe permanent-delete eligibility check and optional delete operation
- POS synchronization through existing menu/availability flows

### Included frontend functionality
- New `/admin/products` route
- Products navigation item in the admin sidebar
- Product list page with search, filters, sort, summary cards, and pagination
- Product detail workspace
- Product create/edit modal workflow
- Variant management UI
- Recipe editor UI
- Ingredient usage UI
- Archive / restore / delete confirmation flows

### Included database changes
- Product archive fields
- Supporting user relation for archive actor
- Only the indexes needed for product filters and usage-query performance

### Included integration work
- Availability refresh after recipe, variant-status, and product-status writes
- POS visibility alignment with archive + manual availability + variant sellability
- Backward-compatible `GET /pos/menu` behavior

### Included tests
- Backend unit/service tests
- Backend integration/e2e workflow plan
- Frontend behavioral/manual coverage plan
- POS regression coverage plan

### Explicit non-goals
- Rebuilding POS
- Replacing FEFO
- Replacing the inventory ledger
- Creating a product-level recipe table
- Creating a second availability engine
- Rewriting unrelated inventory or report pages
- AI recommendations
- Geolocation
- Forecasting
- Supplier recommendation
- Multi-branch support
- Product image upload support
- Advanced unit-conversion redesign

### Scope grouping
- Product-level operations: list, detail, create, edit, manual enable/disable, archive, restore, delete eligibility
- Variant-level operations: list, create, edit, manual enable/disable, recipe ownership, safe deletion
- Recipe-level operations: read, replace, validate, refresh availability
- Ledger-based analytics: ingredient count, per-order usage, 1/7/30-day usage
- Availability integration: current stock availability, effective sellability, product-level derived status
- Lifecycle operations: archive, restore, exceptional delete

## 3. Architecture Decision Summary

### Product ownership
`Product` remains the menu-level entity and owns:
- category relationship
- product name
- product-level manual availability
- product-level archive lifecycle
- product-to-modifier-group assignments

### Variant ownership
`ProductVariant` remains the sellable and priced entity and owns:
- sellable name
- SKU
- price
- variant-level manual availability
- variant-level current availability summary relation

### Recipe ownership
Base recipes remain owned by `ProductVariant` through `VariantRecipeItem`.

### Modifier ingredient behavior
Modifier ingredient deltas remain owned by `Modifier` through `ModifierRecipeAdjustment`.

### Manual availability
Confirmed:
- `Product.isEnabled` = product-level manual availability
- `ProductVariant.isEnabled` = variant-level manual availability

### Stock availability
Current inventory summaries and `VariantAvailabilitySummary.isInStock` remain authoritative.

### Effective sellability
`VariantAvailabilitySummary.isSellable` and `blockingReason` remain the variant-level source of truth.

### Product-level effective status
Product-level status will be derived from product lifecycle plus its variants, not stored in a second availability table.

Derived rules:
- `ARCHIVED`: product has `archivedAt`
- `MANUALLY_DISABLED`: product is not archived and `product.isEnabled = false`
- `SELLABLE`: at least one non-archived product variant is enabled and `isSellable = true`
- `PARTIALLY_AVAILABLE`: at least one variant is sellable and at least one other active variant is not
- `OUT_OF_STOCK`: no enabled variant is sellable and all enabled variants are blocked by `INSUFFICIENT_STOCK`
- `NO_VALID_RECIPE`: no enabled variant is sellable and all enabled variants are blocked by `NO_RECIPE`
- `NO_SELLABLE_VARIANT`: no enabled variant qualifies for another blocking pattern such as disabled variant or required modifier failure

Recommended product-level summary payload:
- manual status
- archive status
- effective status
- sellable variant count
- total active variant count
- top blocking reason summary

### Historical ingredient usage
Historical ingredient usage is derived from `InventoryTransactionLine`, optionally joined through `InventoryTransaction`, `OrderItem`, `Order`, and `ProductVariant`, not from current recipe tables.

### Archive state
Archive is modeled independently of `isEnabled`.

## 4. User Roles and Permissions

| Capability | Administrator | Staff | System Administrator | Notes |
| --- | --- | --- | --- | --- |
| View product list | Yes | No | Yes | `SYSTEM_ADMINISTRATOR` should mirror admin report access patterns |
| View product detail | Yes | No | Yes | Admin-only management UI |
| Create product | Yes | No | Yes | Write operations remain non-staff |
| Edit product | Yes | No | Yes | Same reasoning |
| Manage variants | Yes | No | Yes | Same reasoning |
| Manage recipes | Yes | No | Yes | Same reasoning |
| Toggle product availability | Yes | No | Yes | Uses `Product.isEnabled` |
| Toggle variant availability | Yes | No | Yes | Uses `ProductVariant.isEnabled` |
| View ingredient usage | Yes | No | Yes | Align with current reports controller roles |
| Archive | Yes | No | Yes | Admin lifecycle operation |
| Restore | Yes | No | Yes | Admin lifecycle operation |
| Permanent delete | Yes, if enabled | No | Yes, if enabled | Still exceptional and safety-gated |
| Consume POS menu | No direct admin requirement | Yes | Not primary | Existing operational flow remains available to authenticated users that use POS |

`SYSTEM_ADMINISTRATOR` decision:
- Final decision: **grant the same product-management permissions as `ADMINISTRATOR`**
- Basis: current repository already treats `SYSTEM_ADMINISTRATOR` as privileged for reports and inventory reads and as an all-system administrative role in `Role` usage and route protections.
- Implementation note: do not rely only on the frontend admin layout, since that currently allows only `ADMINISTRATOR`; Phase 2 implementation should explicitly decide whether `/admin/products` is `ADMINISTRATOR`-only in the frontend shell or whether the shell should be widened for `SYSTEM_ADMINISTRATOR`.

## 5. User Stories and Acceptance Criteria

### Story 1 - View Products
Acceptance criteria:
- Search by product name
- Search by variant name
- Search by SKU where practical
- Filter by category
- Filter by product manual availability
- Filter by variant availability summary
- Filter by effective product sellability
- Filter active versus archived
- Sort by product name
- Sort by category
- Sort by variant count
- Sort by distinct ingredient count
- Sort by updated date
- Server-side pagination
- Show product name
- Show category
- Show variant count
- Show distinct ingredient count
- Show manual availability
- Show stock availability summary
- Show effective POS status
- Show archive state
- Show updated date
- Show available actions

### Story 2 - View Product Details
Acceptance criteria:
- Product metadata
- Category
- Product manual status
- Archive status
- All variants
- Variant SKU
- Variant price
- Variant manual status
- Variant stock status
- Variant effective sellability
- Variant blocking reason
- Variant recipe
- Product-level ingredient count
- Ingredient usage access

### Story 3 - Add Product
Acceptance criteria:
- Create product
- Assign category
- Set product name
- Set product manual availability
- Add one or more variants
- Set each variant name
- Set unique SKU
- Set price
- Set variant manual availability
- Optionally configure recipes in the same workflow or immediately afterward
- Validate all unique constraints
- Persist product and variants transactionally
- Refresh availability after creation

### Story 4 - Edit Product
Acceptance criteria:
- Update product name
- Update category
- Update product manual status
- Update variants
- Preserve historical order snapshots
- Prevent invalid uniqueness conflicts
- Recalculate affected availability
- Do not rewrite historical ledger records

### Story 5 - Manage Variants
Acceptance criteria:
- Add variant
- Edit variant
- Enable or disable variant
- Prevent deleting variants with protected historical references
- Allow safe deletion only when unreferenced
- Preserve historical order items
- Recalculate availability after writes

### Story 6 - Manage Recipe Ingredients
Acceptance criteria:
- Select a product variant
- View current `VariantRecipeItem` records
- Add raw material
- Edit required quantity
- Remove raw material
- Display quantity using raw material's native unit
- Prevent duplicate raw materials
- Reject zero or negative quantities
- Reject inactive raw materials unless current rules explicitly allow them
- Replace or update recipe transactionally
- Recalculate affected availability
- Preserve historical checkout ledger records

### Story 7 - View Ingredient Count
Acceptance criteria:
- Product-level count is the distinct union of raw materials used across included variants
- Same raw material used by multiple variants is counted once
- Variant-level count is available in product details
- Modifier recipe adjustments are handled according to an explicit rule
- Archived or disabled variants are handled according to an explicit rule
- Query avoids N+1 behavior

Final rule:
- Product-level ingredient count should count raw materials from:
  - active non-archived variants
  - base recipe lines
  - positive-quantity modifier recipe adjustments associated through the product's modifier groups
- Disabled variants should still be included in detail-level count by default because they remain part of the product configuration; list-level count may be based on non-archived variants only for operational relevance

### Story 8 - View Ingredient Usage
Acceptance criteria:
- Per-order scope
- One-day scope
- Last-7-days scope
- Last-30-days scope
- Gross checkout deduction
- Reversed quantity
- Net deduction
- Distinct order count
- Product units sold
- Raw material name
- Unit
- Start and end timestamp
- No-data state
- Reversal-aware output
- Historical snapshots used for naming where appropriate

### Story 9 - Control Manual Availability
Acceptance criteria:
- Toggle `Product.isEnabled`
- Toggle `ProductVariant.isEnabled`
- Keep manual status independent of stock status
- Recalculate availability
- Update POS behavior
- Show why product remains unavailable when manually enabled but stock is insufficient

### Story 10 - Archive and Restore
Acceptance criteria:
- Archive product
- Record archive timestamp
- Record actor
- Optionally record reason
- Remove archived product from active admin views
- Remove archived product from POS
- Preserve variants, recipes, orders, ledger records, and reports
- Restore product
- Validate product-name conflicts before restore
- Recalculate availability after restore
- Do not force product sellability after restore

### Story 11 - Safe Permanent Deletion
Acceptance criteria:
- Only available for products with no protected history
- Block if variants are referenced by order items
- Block if ledger records reference product variants
- Block if other protected relationships exist
- Return clear blocking reasons
- Delete allowed dependent configuration transactionally
- Require explicit destructive confirmation in the UI

## 6. Database Implementation Plan

### Required Product archive fields
Plan these fields on `Product`:
- `archivedAt DateTime?`
- `archivedById String?`
- `archiveReason String?`

Recommended relation behavior:
- `archivedById` nullable
- foreign key to `User`
- `onDelete: SetNull`

Reverse relation:
- add a reverse relation on `User`, for example `archivedProducts Product[] @relation("ProductArchivedBy")`
- reason: Prisma relation clarity and future audit querying

### Do not add
- replacement for `Product.isEnabled`
- replacement for `ProductVariant.isEnabled`
- product-level recipe table
- new `orderItemId` on inventory lines
- new `productVariantId` on inventory lines
- direct `productId` on inventory lines in v1

### Index plan

| Index candidate | Query supported | Decision |
| --- | --- | --- |
| `Product.archivedAt` | active vs archived list filters | Add |
| composite on `Product(categoryId, archivedAt)` | category + active/archived product list | Add if Prisma/index ordering remains simple |
| composite on `Product(isEnabled, archivedAt)` | manual-status + archive filters | Add only if list query profiling shows benefit; otherwise defer |
| `InventoryTransactionLine.productVariantId` | product usage aggregation by variant | Add |
| existing `InventoryTransaction(type, occurredAt)` | date/type usage filtering | Reuse existing |
| existing `InventoryTransaction(sourceType, sourceId)` | per-order lookup and reversal association | Reuse existing |
| existing `OrderItem(orderId)` | per-order joins | Reuse existing |
| existing `OrderItem(productVariantId)` | usage joins by variant | Reuse existing |

### Migration
Recommended migration name:
- `YYYYMMDDHHMMSS_product_management_archive_and_usage_indexes`

Planned migration contents:
- add nullable archive fields to `Product`
- add `archivedById` foreign key to `User`
- add product archive filter indexes
- add `InventoryTransactionLine.productVariantId` index if not already present

Migration validation commands:
- `npx prisma migrate dev --name product_management_archive_and_usage_indexes`
- `npx prisma generate`
- `npx prisma migrate status`

### Migration safety
- no destructive table recreation
- no deletion of products, variants, orders, or ledger rows
- no mutation of historical order or recipe data
- archive fields default to `null`
- all existing products remain active and unarchived after migration

## 7. Backend Module and File Plan

Decision: **extend the existing `catalog` module instead of introducing a second parallel product domain module**.

Why:
- `Product`, `ProductVariant`, and POS menu reads already live there
- duplicating product ownership into a new module would create parallel service boundaries without evidence it is necessary
- product-management logic can remain in the same domain while using supporting services from recipes, availability, inventory, and reports

Recommended backend file plan:
- extend `ims-backend/src/catalog/catalog.module.ts`
- extend `ims-backend/src/catalog/catalog.controller.ts`
- extend `ims-backend/src/catalog/catalog.service.ts`
- add DTOs under `ims-backend/src/catalog/dto/`
- add optional helper/query builder files under `ims-backend/src/catalog/` if `catalog.service.ts` becomes too large

Recommended supporting service usage:
- reuse `AvailabilityService` from `ims-backend/src/availability/availability.service.ts`
- reuse `RecipeResolverService` concepts but add admin recipe-write logic in catalog domain
- reuse `InventoryLedgerService` indirectly through analytics, not for product writes
- reuse `ReportsService` patterns for date-bounded aggregation but keep product-management analytics in catalog/product domain unless a shared reporting helper clearly reduces duplication

Recommended DTO files:
- `list-products.dto.ts`
- `get-product-ingredient-usage.dto.ts`
- `create-product.dto.ts`
- `update-product.dto.ts`
- `create-variant.dto.ts`
- `update-variant.dto.ts`
- `set-product-availability.dto.ts`
- `set-variant-availability.dto.ts`
- `replace-variant-recipe.dto.ts`
- `archive-product.dto.ts`

## 8. Backend Endpoint Plan

Recommended endpoint set:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/admin/products` | Paginated product list with filters/sort |
| `GET` | `/admin/products/:id` | Product detail with variants, counts, statuses |
| `POST` | `/admin/products` | Create product + initial variants |
| `PATCH` | `/admin/products/:id` | Update product metadata |
| `PATCH` | `/admin/products/:id/manual-availability` | Set product `isEnabled` |
| `POST` | `/admin/products/:id/archive` | Archive product |
| `POST` | `/admin/products/:id/restore` | Restore product |
| `GET` | `/admin/products/:id/delete-eligibility` | Structured delete safety check |
| `DELETE` | `/admin/products/:id` | Permanent delete if safe |
| `POST` | `/admin/products/:id/variants` | Create variant |
| `PATCH` | `/admin/variants/:id` | Update variant |
| `PATCH` | `/admin/variants/:id/manual-availability` | Set variant `isEnabled` |
| `DELETE` | `/admin/variants/:id` | Delete variant if safe |
| `GET` | `/admin/variants/:id/recipe` | Read variant recipe |
| `PUT` | `/admin/variants/:id/recipe` | Replace variant recipe transactionally |
| `GET` | `/admin/products/:id/ingredient-usage` | Product usage for `ONE_DAY`, `LAST_7_DAYS`, `LAST_30_DAYS` |
| `GET` | `/admin/products/:id/orders/:orderId/ingredient-usage` | Per-order ingredient usage |

Controller placement:
- prefer a dedicated admin controller inside catalog domain, e.g. `AdminProductsController`, to avoid polluting public-ish catalog reads
- keep existing `/products` and `/pos/menu` routes stable

## 9. Product Listing Query Plan

List query must support:
- search by product name
- search by variant name
- search by SKU
- category filter
- product manual availability filter
- effective status filter
- archive filter
- sort
- page and page size

Recommended query shape:
- base query from `Product`
- include:
  - `category`
  - `variants` with `availabilitySummary`
  - recipe counts via grouped subquery/aggregation
- compute derived product status in service layer from variant summaries and archive/manual state

To avoid N+1:
- fetch products page
- fetch variant summaries and recipe aggregates in batched relations
- aggregate distinct ingredient count with group/query per page, not per row

Maximum page size:
- 100 hard max
- default 20 or 25

## 10. Product Detail Query Plan

Product detail response should include:
- product metadata
- category
- archive fields
- product manual status
- derived product effective status
- variants
- each variant's:
  - name
  - SKU
  - price
  - manual status
  - `availabilitySummary`
  - base recipe lines
- product-level distinct ingredient count
- variant-level ingredient counts
- usage-summary entry points
- deletion eligibility summary

Recommended response assembly:
- `Product` with `category`, `variants`, `variants.availabilitySummary`, `variants.recipeItems.rawMaterial.unit`, `productModifierGroups.modifierGroup.modifiers.recipeAdjustments`
- derive product-level status and counts in service

## 11. Product Create Plan

Write behavior:
1. validate category
2. validate product uniqueness within category
3. validate at least one initial variant
4. validate variant names unique within payload
5. validate variant SKUs unique within payload and globally absent
6. create product
7. create variants
8. trigger variant availability refresh for created variants
9. return created product detail

Transaction:
- one Prisma transaction for product + variants

Recipe timing decision:
- **Choose A after creation, not during initial create**
- final decision: create product and variants first, then configure recipes from product detail
- reason: safest with current architecture, keeps create flow simpler, and intentionally allows `NO_RECIPE` until setup is complete

## 12. Product Update Plan

Update behavior:
- validate product exists and not archived if edit-on-archived is disallowed
- validate category if changed
- validate uniqueness if name/category change
- update metadata only
- if product `isEnabled` changes, refresh variant summaries for all variants
- return updated detail response

Historical safety:
- no mutation of historical orders
- no mutation of ledger rows
- no mutation of snapshots

## 13. Variant Management Plan

Create variant:
- validate parent product exists
- validate parent product not archived
- validate unique variant name within product
- validate unique SKU globally
- create variant
- refresh that variant summary

Update variant:
- validate existence
- validate name uniqueness if changed
- validate SKU uniqueness if changed
- update price/name/manual status
- refresh summary if manual status changed

Delete variant:
- perform dependency check before delete
- block if:
  - `OrderItem` exists
  - `InventoryTransactionLine` exists
  - availability/history references are protected
- if safe, delete variant in transaction, relying on cascade only for non-historical dependent configuration such as recipe items

## 14. Recipe Administration Plan

Recommended API model:
- `GET /admin/variants/:id/recipe`
- `PUT /admin/variants/:id/recipe`

Write semantics:
- replace recipe transactionally for that variant
- validate:
  - variant exists
  - raw materials exist
  - raw materials active unless explicitly allowed by rule
  - no duplicates
  - positive decimal quantities only
- delete removed recipe items and upsert submitted rows in one transaction
- refresh:
  - raw material summaries are not changed by recipe edit alone
  - variant availability summaries for the edited variant must be recalculated

Important rule:
- recipe changes affect future sales only
- historical checkout ledger remains unchanged

## 15. Ingredient Count Plan

Algorithm:
1. collect target variants for a product
2. collect distinct `rawMaterialId` from:
   - `VariantRecipeItem`
   - positive `ModifierRecipeAdjustment` rows reachable from the product's assigned modifier groups
3. count unique raw material IDs

Default behavior decisions:
- include disabled variants in detail-level count because they are still part of current configuration
- exclude archived products entirely from active list output, but archived detail can still show full count
- include modifier adjustments only where `quantityDelta > 0`; negative or zero adjustments do not represent required material consumption

N+1 avoidance:
- use relation includes or grouped batched queries
- compute for the page, not one product at a time with isolated queries

## 16. Ingredient Usage Analytics Plan

Historical ingredient usage source:
- `InventoryTransactionLine`
- joined to `InventoryTransaction`
- joined to `OrderItem`
- optionally joined to `ProductVariant`, `Product`, and `RawMaterial`

### Per-order algorithm
1. find checkout lines for the order:
   - `InventoryTransaction.type = CHECKOUT`
   - `InventoryTransaction.sourceType = ORDER`
   - `InventoryTransaction.sourceId = orderId`
2. filter to lines whose variant/order item belongs to the target product
3. aggregate gross deduction as absolute value of negative `quantityDelta`
4. find reversal lines related to the same order through:
   - `InventoryTransaction.type IN (VOID, REFUND)`
   - same `orderItemId` / `productVariantId`
5. aggregate reversed quantity from positive deltas
6. compute net = gross - reversed

### Day / 7-day / 30-day algorithm
1. derive Manila business-date range boundaries
2. query checkout lines in range for target product
3. query reversal lines in range for target product
4. aggregate by raw material and variant where relevant
5. return:
   - gross deducted
   - reversed
   - net deducted
   - distinct order count
   - product units sold

### Business-date range rules
- `ONE_DAY`: selected Manila date start/end
- `LAST_7_DAYS`: selected/current Manila day and previous six
- `LAST_30_DAYS`: selected/current Manila day and previous twenty-nine

### Unit behavior
- never sum across incompatible units into one meaningless human-facing total
- row-level output always includes raw material unit
- product-level totals may include:
  - order count
  - units sold
  - row counts
- but not one merged cross-unit quantity

## 17. Availability Integration Plan

### Manual availability
- product-level: `Product.isEnabled`
- variant-level: `ProductVariant.isEnabled`

### Stock-derived availability
- use `VariantAvailabilitySummary.isInStock`
- use `availableBaseQty`

### Effective sellability
- use `VariantAvailabilitySummary.isSellable`
- use `blockingReason`

### Product-level availability
Derived from variants only.

Refresh triggers:
- product manual-status change -> refresh all product variants
- variant manual-status change -> refresh that variant
- recipe replacement -> refresh edited variant
- archive / restore -> refresh all product variants

Do not persist a product-level availability summary in Phase 2.

## 18. Product Lifecycle Plan

### Archive plan
Archive should:
1. verify product exists
2. verify not already archived
3. set `archivedAt`
4. set `archivedById`
5. set `archiveReason`
6. preserve existing `isEnabled` value
7. hide product from admin active list and POS menu
8. keep variants, recipes, orders, ledger, history, and reports intact
9. refresh product variant summaries and return derived lifecycle state

Final decision:
- **do not overwrite `isEnabled` during archive**
- archive state alone blocks POS visibility
- preserving `isEnabled` allows restore to return to prior manual state

### Restore plan
Restore should:
1. verify product exists
2. verify currently archived
3. validate category still exists
4. validate no restore-time uniqueness conflict on category/name
5. clear archive fields
6. preserve pre-existing manual availability
7. refresh all variant summaries
8. return derived status

If category has been removed:
- restore fails with a clear category-not-found / invalid-category-state error

## 19. Permanent Delete Plan

Decision:
- **Approach B for initial implementation**: do not expose general permanent product deletion as a routine lifecycle action
- allow only a tightly constrained exceptional backend path, or defer the actual delete button until eligibility is clear and safe

Why:
- current schema has strong restrictive historical relationships
- archive already satisfies the normal lifecycle need
- delete risk is high relative to business value

Practical Phase 2 plan:
- implement `delete-eligibility` endpoint first
- expose permanent delete in UI only when backend says safe
- safe means:
  - no `OrderItem` references for any variant
  - no `InventoryTransactionLine` references for any variant
  - no other protected historical references

If real delete is implemented:
- one transaction
- delete variants and non-historical dependent configuration only after eligibility passes
- never remove historical orders
- never remove ledger history

## 20. Archive Plan

Archive remains separate from manual availability.

Operational steps:
1. verify product exists
2. verify not archived
3. write archive fields
4. keep `isEnabled` unchanged
5. exclude archived product from active admin product list
6. exclude archived product from `/pos/menu`
7. preserve variants, recipes, modifier associations, orders, ledger lines, availability history, and reports
8. refresh or recompute current derived status
9. return updated lifecycle state

Decision on `isEnabled`:
- keep prior value unchanged

## 21. Restore Plan

Restore steps:
1. verify product exists
2. verify archived
3. validate category still valid
4. validate name/category uniqueness
5. clear archive fields
6. preserve `isEnabled`
7. recalculate variant availability
8. return derived product status
9. allow POS visibility only if non-archived and variant sellability rules pass

## 22. Permanent Delete Plan

Phase 2 operational decision:
- expose delete eligibility first
- treat actual permanent delete as exceptional
- UI may omit delete action initially if safe-path confidence is low

Dependency checks:
- variants
- order items
- inventory transaction lines
- availability events
- availability summaries
- recipe rows
- product-modifier-group assignments

Final choice:
- **archive is the normal lifecycle operation**
- **permanent delete is optional and only shown when backend eligibility is true**

## 23. Backend Authorization Plan

Authorization approach:
- keep `GET /pos/menu` available to authenticated operational users as today
- keep existing catalog read routes compatible where necessary
- add explicit role guards to management endpoints
- management endpoints allow `ADMINISTRATOR` and `SYSTEM_ADMINISTRATOR`
- deny `STAFF`

Placement:
- create admin controller with controller-level `@Roles(Role.ADMINISTRATOR, Role.SYSTEM_ADMINISTRATOR)`
- keep existing public-ish authenticated catalog controller unchanged unless later tightened intentionally

Reused pieces:
- `SessionAuthGuard`
- `RolesGuard`
- role decorators

## 24. Backend Validation and Errors

Plan DTO validation for:
- product name
- category ID
- product enabled state
- variant name
- SKU
- price
- variant enabled state
- raw-material ID
- recipe quantity
- archive reason
- page
- page size
- search
- filters
- sort
- business date
- usage scope
- order ID

Planned errors:
- Product not found
- Product archived
- Product already archived
- Product not archived
- Category not found
- Duplicate product name
- Variant not found
- Variant-product mismatch
- Duplicate variant name
- Duplicate SKU
- Raw material not found
- Inactive raw material
- Duplicate recipe ingredient
- Invalid recipe quantity
- Product referenced by history
- Variant referenced by history
- Invalid usage scope
- Invalid Manila date
- Order not found
- Product not present in order
- Forbidden role

Exception style:
- use existing NestJS exceptions only

## 25. Frontend Route and File Plan

Create:
- `ims-frontend/src/app/admin/products/page.tsx`

Add nav entry in:
- `ims-frontend/src/components/admin/AdminSidebar.tsx`

Recommended feature directory:
- `ims-frontend/src/components/admin/products/`

Planned components:
- `ProductsPage.tsx`
- `ProductSummaryCards.tsx`
- `ProductFilters.tsx`
- `ProductTable.tsx`
- `ProductRowActions.tsx`
- `ProductDetailPanel.tsx`
- `ProductFormModal.tsx`
- `VariantFormModal.tsx`
- `RecipeEditor.tsx`
- `IngredientUsagePanel.tsx`
- `ArchiveProductModal.tsx`
- `RestoreProductModal.tsx`
- `DeleteProductModal.tsx`
- `ProductAvailabilityBadges.tsx`

Planned API helper:
- `ims-frontend/src/lib/products.ts`

## 26. Frontend Page Design

Preserve:
- existing admin shell
- orange left navigation
- orange accent buttons
- light neutral page background
- rounded white cards
- existing input styles
- existing modal patterns
- inline success/error notices
- current availability badge language

### Header
- Title: `Products`
- supporting description
- `Add Product` button
- active / archived control

### Summary cards
- Active products
- Sellable products
- Partially available products
- Manually disabled products
- Stock unavailable products
- Archived products

### Filters
- Search
- Category
- Product manual status
- Effective status
- Archive status
- Sort
- Clear filters

### Product table
Columns:
- Product
- Category
- Variants
- Ingredients
- Manual status
- Stock status
- POS status
- Updated
- Actions

`Updated` column:
- supported by existing `Product.updatedAt`

### Responsive behavior
- desktop: table + detail panel
- tablet/mobile: stacked cards, compact filters, action menus

## 27. Product Create/Edit UX Plan

### Product information
- Product name
- Category
- Product manual availability

### Variants
Each variant:
- Name
- SKU
- Price
- Manual availability
- Remove action when safe

### Recipe timing decision
Final decision:
- create product and variants first
- configure recipes in product detail afterward

Why:
- lower transactional complexity
- aligns with current `NO_RECIPE` availability behavior
- keeps create flow small and safer

## 28. Recipe Editor UX Plan

Per variant show:
- variant name
- SKU
- availability badge
- current ingredient count
- recipe lines

Recipe line fields:
- raw material selector
- quantity
- read-only native unit display
- remove button

Behavior:
- prevent duplicates client-side
- backend is final authority
- show inactive raw materials clearly
- warn about unsaved changes
- explain recipe changes affect future sales only
- explain historical deductions remain unchanged
- display `NO_RECIPE` until at least one valid line exists

## 29. Availability UX Plan

Show three separate states:

### Manual product status
- Enabled
- Disabled

### Ingredient/variant stock status
- Available
- Partially available
- Insufficient stock
- No recipe
- Required modifier unavailable

### Effective POS status
- Sellable
- Unavailable
- Archived

Display user-friendly blocking reasons derived from backend `blockingReason`.

## 30. Ingredient Usage UX Plan

Add an `Ingredient Usage` section in product details.

Scope controls:
- Per Order
- One Day
- Last 7 Days
- Last 30 Days

### Per Order
- order ID / receipt search
- recent matching orders
- order date
- order status
- variant and quantity
- gross deduction
- reversed quantity
- net deduction

### One Day
- date selector
- Manila business-date label
- default to current Manila business date

### Last 7 Days / Last 30 Days
- optional end-date selector
- display exact covered dates

### Usage table
Columns:
- Ingredient
- Variant where relevant
- Unit
- Gross deducted
- Reversed
- Net deducted
- Orders
- Product units sold

Never show meaningless cross-unit totals.

## 31. Archive, Restore, and Delete UX

### Archive
Confirmation explains:
- product disappears from POS
- historical transactions remain
- recipes and reports remain
- manual enabled state is preserved

Optional archive reason field.

### Restore
Archived view includes:
- restore action
- previous manual state
- current recalculated stock status
- conflict errors

### Permanent delete
- only expose when backend says safe
- if blocked, show backend reasons
- require explicit destructive confirmation
- never rely on frontend-only eligibility

## 32. Frontend State and API Plan

Follow current helper conventions from:
- `ims-frontend/src/lib/api.ts`
- `ims-frontend/src/lib/inventory.ts`
- `ims-frontend/src/lib/pos.ts`
- `ims-frontend/src/lib/reports.ts`

Planned functions in `ims-frontend/src/lib/products.ts`:
- `listProducts`
- `getProduct`
- `createProduct`
- `updateProduct`
- `setProductAvailability`
- `createVariant`
- `updateVariant`
- `setVariantAvailability`
- `getVariantRecipe`
- `replaceVariantRecipe`
- `getProductIngredientUsage`
- `getProductOrderIngredientUsage`
- `archiveProduct`
- `restoreProduct`
- `deleteProductEligibility`
- `deleteProduct`

State plan:
- local React state
- no new state-management dependency
- filter and pagination state synchronized to URL query params
- reload after writes
- inline success/error notices
- modal focus and accessibility follow current modal patterns

## 33. Backend Test Plan

### Product service tests
- list active products
- list archived products
- search product name
- search variant name
- search SKU
- category filter
- availability filters
- sort
- pagination
- product detail
- create
- duplicate product name
- invalid category
- update
- product manual availability
- archive
- archive already archived
- restore
- restore conflict
- safe deletion
- blocked deletion

### Variant tests
- create variant
- duplicate variant name
- duplicate SKU
- update variant
- variant manual availability
- safe variant deletion
- blocked historical variant deletion

### Recipe tests
- read recipe
- replace recipe
- duplicate raw material
- missing raw material
- inactive raw material
- zero quantity
- negative quantity
- empty recipe
- availability refresh
- transaction rollback

### Ingredient count tests
- no recipe
- one ingredient
- multiple variants
- same ingredient across variants
- disabled variant behavior
- modifier adjustment rule

### Ingredient usage tests
- one order
- multiple order items
- multiple variants
- same ingredient across variants
- gross deduction
- full void
- full refund
- no reversal
- one-day Manila boundary
- seven-day Manila range
- thirty-day Manila range
- no matching records
- product not present in order
- no double-counting of product units sold
- no cross-unit aggregate totals

### Authorization tests
- administrator allowed
- staff forbidden
- unauthenticated forbidden
- system administrator allowed

## 34. Integration and E2E Test Plan

Current e2e harness is known to be stale relative to newer bootstrap services.

Plan:
- isolate or mock boot-time services that are unrelated to product workflows
- expand Prisma mocks or use a controlled test database strategy
- keep assertions strong on auth, writes, and ledger/availability effects

Workflow tests:
1. Administrator creates product.
2. Administrator creates variants.
3. Administrator assigns recipes.
4. Availability changes from `NO_RECIPE`.
5. Product appears in POS when sellable.
6. Staff completes checkout.
7. Ledger lines contain product-variant and order-item attribution.
8. Per-order usage matches checkout lines.
9. Daily usage includes the order.
10. Administrator disables product.
11. Product becomes unavailable in POS.
12. Administrator archives product.
13. Product disappears from POS.
14. Historical order remains readable.
15. Administrator restores product.
16. Availability recalculates.
17. Void/refund creates reversal quantity.
18. Net ingredient usage updates correctly.
19. Permanent deletion with historical records is blocked.

## 35. Frontend Test Plan

If an existing frontend test harness is present, cover:
- products page rendering
- loading state
- empty state
- API error
- search
- category filter
- availability filter
- archived filter
- pagination
- ingredient count display
- add-product validation
- edit product
- variant form
- recipe duplicate prevention
- native unit display
- manual availability toggle
- availability badges
- usage scope switching
- per-order selection
- date selection
- archive confirmation
- restore
- delete blocked reason

If no formal frontend test harness is available:
- provide manual acceptance coverage instead of inventing a new framework during this feature

## 36. POS Regression Plan

Verify product-management changes do not break:
- `GET /pos/menu`
- existing POS response shape
- product category grouping
- product and variant enabled filtering
- variant availability summaries
- modifier-group requirements
- product configuration
- checkout
- FEFO
- ledger append
- COGS
- receipt history
- void
- refund
- offline queue behavior

Specific regression checks:
- archived products absent from POS
- restored but manually disabled products remain unavailable
- restored and sellable products reappear
- products with `NO_RECIPE` remain unavailable until recipe setup

## 37. Performance Plan

Address:
- paginated product listing
- ingredient-count aggregation
- variant-summary aggregation
- ingredient-usage date ranges
- order and reversal joins
- index requirements
- maximum page size
- query-count control
- N+1 avoidance
- decimal-safe aggregation

Targets:
- default page size 20-25
- max page size 100
- analytics windows constrained to requested scopes only
- no full-ledger in-memory scans
- use database aggregation for counts and usage, then a small service-layer derivation step

## 38. Documentation Plan

Update:
- backend API documentation
- migration instructions
- product lifecycle behavior docs
- recipe native-unit behavior docs
- ingredient usage definitions
- availability definitions
- archive and delete rules
- manual acceptance checklist

## 39. Implementation Work Packages

| Work Package | Exact Files | Dependencies | Implementation Tasks | Risks | Acceptance Criteria | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| WP1 - Database archive fields and indexes | `ims-backend/prisma/schema.prisma`, new migration folder | None | Add archive fields, relation, indexes | migration safety | schema compiles, migration is non-destructive | S |
| WP2 - Product list/detail DTOs and queries | `ims-backend/src/catalog/dto/*`, `ims-backend/src/catalog/catalog.service.ts`, `ims-backend/src/catalog/catalog.controller.ts` | WP1 | Add paginated list + detail read contracts | N+1, filter drift | admin list/detail endpoints return derived status | M |
| WP3 - Product create/update lifecycle | `ims-backend/src/catalog/catalog.service.ts`, `ims-backend/src/catalog/catalog.controller.ts`, new DTOs | WP2 | Create/update product metadata and initial variants | uniqueness conflicts | transactional create/update works | M |
| WP4 - Variant management | same backend catalog files + DTOs | WP3 | Create/update/delete-eligibility/manual toggle for variants | history-protected deletes | safe variant lifecycle works | M |
| WP5 - Recipe administration | `ims-backend/src/catalog/catalog.service.ts`, DTOs, possible helper file | WP4 | Read/replace variant recipes, validations, refresh availability | invalid quantities, duplicates | recipe editor APIs work and recalc status | M |
| WP6 - Ingredient count | `ims-backend/src/catalog/catalog.service.ts` | WP2 | Add distinct ingredient count derivation | query complexity | counts are correct and deduplicated | S |
| WP7 - Ingredient usage analytics | `ims-backend/src/catalog/catalog.service.ts` or helper, DTOs | WP2 | Add per-order and date-range ledger analytics | reversal double counting, unit handling | gross/reversed/net outputs are correct | L |
| WP8 - Availability and archive integration | `ims-backend/src/catalog/catalog.service.ts`, `ims-backend/src/availability/availability.service.ts` usage points | WP3-WP7 | Trigger refreshes and archive-aware POS visibility | stale availability | archive/manual/recipe changes affect POS safely | M |
| WP9 - Backend tests | `ims-backend/test/`, catalog tests, service tests | WP2-WP8 | Add unit/integration coverage | stale e2e harness | key workflows covered | L |
| WP10 - Frontend API client and types | `ims-frontend/src/lib/products.ts` | WP2-WP8 | Add product client helpers and types | payload mismatch | frontend can call backend safely | S |
| WP11 - Products page and filters | `ims-frontend/src/app/admin/products/page.tsx`, `ims-frontend/src/components/admin/products/ProductsPage.tsx`, `ProductFilters.tsx`, `ProductTable.tsx`, `ProductSummaryCards.tsx`, `ims-frontend/src/components/admin/AdminSidebar.tsx` | WP10 | Build products landing page, filters, list, cards | filter complexity | page loads and filters/pagination work | L |
| WP12 - Product and variant forms | `ProductFormModal.tsx`, `VariantFormModal.tsx`, `ProductRowActions.tsx` | WP11 | Create/edit flows and manual-status controls | modal complexity | product/variant lifecycle UI works | M |
| WP13 - Recipe editor | `RecipeEditor.tsx`, `ProductDetailPanel.tsx` | WP10, WP12 | Variant recipe editing UI | duplicate prevention, unit clarity | recipe updates validated and reflected | M |
| WP14 - Ingredient usage UI | `IngredientUsagePanel.tsx`, `ProductDetailPanel.tsx` | WP10, WP11, WP7 | Per-order and date-scope usage screens | heavy queries, UX clarity | usage output is understandable and reversal-aware | M |
| WP15 - Archive, restore, and deletion UI | `ArchiveProductModal.tsx`, `RestoreProductModal.tsx`, `DeleteProductModal.tsx`, `ProductRowActions.tsx` | WP10, WP11, WP8 | Lifecycle confirmations and blocked-delete messaging | destructive UX | archive/restore safe, delete guarded | M |
| WP16 - POS regression validation | backend + frontend POS files touched only for verification | WP3-WP15 | Validate menu, sellability, checkout, reversals | regression risk | POS behavior remains intact | M |
| WP17 - Build, lint, test, and documentation | repo-wide relevant docs/tests | WP1-WP16 | Run validation and update docs | existing lint/test debt | feature is verifiable and documented | M |

## 40. Recommended Implementation Sequence

Safe sequence:
1. Finalize schema decisions.
2. Prepare non-destructive migration.
3. Add backend read contracts.
4. Add lifecycle writes.
5. Add variant and recipe writes.
6. Add ingredient-count query.
7. Add ingredient-usage aggregation.
8. Integrate availability refresh.
9. Add backend tests.
10. Add frontend API helpers.
11. Add product list and detail UI.
12. Add forms and recipe editor.
13. Add usage UI.
14. Add archive/restore UI.
15. Validate POS regression.
16. Run builds, lint, tests, and manual acceptance.

Why this is safe:
- archive schema lands before lifecycle code depends on it
- read contracts arrive before UI work
- recipe and availability integration happen before usage UI exposes misleading states
- POS regression validation happens after behavior-affecting changes are in place

## 41. Phase 3 Entry Checklist

- Product recipes remain variant-owned.
- Modifier adjustments remain modifier-owned.
- Existing `isEnabled` fields are reused.
- Archive state is separate.
- Existing ledger attribution is reused.
- No new order-item attribution fields are needed.
- Ingredient usage is reversal-aware.
- Product-unit counts avoid duplication.
- Cross-unit totals are not combined meaninglessly.
- Product availability is derived from variant availability.
- POS menu integration is identified.
- Archive preserves history.
- Permanent deletion is either safely constrained or excluded.
- Manila date ranges are precisely defined.
- Migration is non-destructive.
- Exact files and endpoints are identified.
- Test strategy accounts for the stale e2e harness.

## 42. Final Phase 2 Verdict

- Final database changes: product archive fields plus targeted indexes, especially archive filters and likely `InventoryTransactionLine.productVariantId`.
- Final backend structure: extend `catalog` with an admin-focused controller/service surface, reuse availability/recipes/inventory/orders, and keep POS menu stable.
- Final endpoint list: admin product list/detail/create/update, variant create/update/delete/manual status, recipe read/replace, ingredient usage analytics, archive/restore, delete eligibility, and optional safe delete.
- Final frontend structure: new `/admin/products` route, new `src/components/admin/products/` feature folder, `src/lib/products.ts`, and sidebar navigation addition.
- Ingredient-count algorithm: distinct union of base recipe raw materials plus positive modifier recipe-adjustment raw materials across the product's reachable variants/modifiers.
- Ingredient-usage algorithm: ledger-first, reversal-aware aggregation from `InventoryTransactionLine` + `InventoryTransaction` + `OrderItem`, with gross / reversed / net outputs.
- Availability behavior: manual availability from existing `isEnabled` fields, stock and sellability from `VariantAvailabilitySummary`, product-level status derived from variants.
- Archive and restore behavior: archive is separate from manual availability, preserves history, hides from POS, and restore recalculates availability without forcing sellability.
- Permanent deletion decision: archive is the normal lifecycle path; permanent deletion is exceptional and exposed only when backend eligibility is true, otherwise deferred.
- Test strategy: add backend unit/integration coverage, repair or isolate stale e2e bootstrap dependencies, and use manual frontend acceptance where formal frontend testing is unavailable.
- POS regression strategy: explicitly verify `/pos/menu`, sellability filtering, checkout, FEFO, ledger append, and reversal behavior after product-management changes.
- Main implementation risks: POS regression, reversal double counting, archive/manual-status confusion, availability refresh drift, and heavy usage queries.
- Recommended first work package: **WP1 - Database archive fields and indexes**.
