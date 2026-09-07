# Product Management - Phase 1 Planning

## 1. Existing Repository Architecture

### Verified locations
- Frontend: `ims-frontend/`
- Backend: `ims-backend/`
- Prisma schema: `ims-backend/prisma/schema.prisma`
- Prisma migrations: `ims-backend/prisma/migrations/`
- Product-related backend module: `ims-backend/src/catalog/`
- Recipe-related backend module/services: `ims-backend/src/recipes/`
- Inventory-related backend module: `ims-backend/src/inventory/`
- Availability-related backend module: `ims-backend/src/availability/`
- POS / order-related backend module: `ims-backend/src/orders/`
- Reports backend module: `ims-backend/src/reports/`
- Relevant admin frontend routes: `ims-frontend/src/app/admin/`
- Relevant staff POS frontend route: `ims-frontend/src/app/staff/pos`

### Current architectural shape
The repository already has the foundations required for a future Administrator-facing product section, but they are distributed across existing modules rather than concentrated in a dedicated product-management feature.

Verified structure:
- Products and variants are currently exposed through the read-oriented catalog module in `ims-backend/src/catalog/catalog.controller.ts` and `ims-backend/src/catalog/catalog.service.ts`.
- Recipes are not exposed through a dedicated CRUD controller/service today. Instead, recipe logic is used internally for checkout and modifier validation via `ims-backend/src/recipes/recipe-resolver.service.ts` and `ims-backend/src/recipes/modifier-validation.service.ts`.
- Inventory deductions and historical usage are backend-authoritative through `ims-backend/src/inventory/inventory-ledger.service.ts`, `ims-backend/src/inventory/fefo-allocator.service.ts`, `ims-backend/src/inventory/inventory-actions.service.ts`, and `ims-backend/src/orders/orders.service.ts`.
- Availability and sellability are summarized in `ims-backend/src/availability/availability.service.ts` and persisted into `VariantAvailabilitySummary` in the Prisma schema.
- The frontend currently has no `/admin/products` route. The closest reusable admin surface is the raw-material inventory workspace at `ims-frontend/src/app/admin/inventory/page.tsx`, while the closest reusable product-facing surface is the live POS menu flow in `ims-frontend/src/components/staff-pos/StaffPOSPage.tsx` and `ims-frontend/src/components/staff-pos/modals/ProductConfiguratorModal.tsx`.

### Concise repository map
- `ims-backend/src/app.module.ts`: module composition root
- `ims-backend/src/catalog/`: current product/category/variant read APIs
- `ims-backend/src/recipes/`: recipe resolution and modifier validation only
- `ims-backend/src/inventory/`: raw-material CRUD, stock runs, transactions, ledger, FEFO, snapshots
- `ims-backend/src/availability/`: stock-derived availability summaries and history events
- `ims-backend/src/orders/`: checkout, order history, void/refund reversals
- `ims-backend/src/reports/`: inventory-linked and POS reporting
- `ims-frontend/src/app/admin/`: administrator route tree
- `ims-frontend/src/components/admin/inventory/`: strongest reusable admin CRUD/table/modal design system
- `ims-frontend/src/components/staff-pos/`: strongest reusable product/variant availability UI behavior

## 2. Existing Database Models

### Model review

| Model | Purpose | Important Fields | Relationships | Status Fields | Concerns | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `Category` | Product grouping | `id`, `name`, `parentId`, `sortOrder` | `products`, self-parent hierarchy | No active/archive field | Category management API was not found; uniqueness is `parentId + name` | `ims-backend/prisma/schema.prisma` |
| `Product` | Menu-level product | `id`, `categoryId`, `name`, `isEnabled` | `category`, `variants`, `productModifierGroups` | `isEnabled` only | No archive fields; no delete/archive API; uniqueness is `categoryId + name` | `ims-backend/prisma/schema.prisma` |
| `ProductVariant` | Sellable variant | `id`, `productId`, `name`, `price`, `sku`, `isEnabled` | `product`, `recipeItems`, `orderItems`, `transactionLines`, `availabilitySummary`, `availabilityEvents` | `isEnabled` only | No archive fields; variant-level recipe model only; no admin CRUD API found | `ims-backend/prisma/schema.prisma` |
| `ProductModifierGroup` | Product-level modifier-group assignment | `productId`, `modifierGroupId`, `minSelect`, `maxSelect`, `isRequired`, `allowQuantity`, `sortOrder` | `product`, `modifierGroup` | No separate active field | Relevant because required modifier availability affects sellability | `ims-backend/prisma/schema.prisma` |
| `ModifierGroup` | Logical group of modifiers | `name`, `selectionMode`, `defaultMinSelect`, `defaultMaxSelect`, `isActive` | `modifiers`, `productModifierGroups` | `isActive` | No dedicated admin CRUD found | `ims-backend/prisma/schema.prisma` |
| `Modifier` | Optional add-on affecting price and ingredients | `modifierGroupId`, `name`, `priceAdjustment`, `isActive` | `modifierGroup`, `recipeAdjustments`, `orderItemModifiers` | `isActive` | Modifier ingredient adjustments are part of recipe semantics | `ims-backend/prisma/schema.prisma` |
| `VariantRecipeItem` | Variant-level base recipe line | `productVariantId`, `rawMaterialId`, `quantity` | `productVariant`, `rawMaterial` | No status field | No explicit recipe-line unit override; quantity is implicitly in raw material unit | `ims-backend/prisma/schema.prisma` |
| `ModifierRecipeAdjustment` | Modifier-specific ingredient delta | `modifierId`, `rawMaterialId`, `quantityDelta` | `modifier`, `rawMaterial` | No status field | Important for effective ingredient usage and availability | `ims-backend/prisma/schema.prisma` |
| `RawMaterial` | Ingredient / stock item | `id`, `unitId`, `name`, `sku`, `reorderPoint`, `isActive` | `unit`, recipe links, stock, ledger, summary, alerts | `isActive` | Already supports archive-like deactivation pattern | `ims-backend/prisma/schema.prisma` |
| `Unit` | Unit-of-measure | `code`, `name`, `dimension`, `conversionFactor` | `rawMaterials` | No status field | No recipe-line unit override means recipe quantities are stored in material-native unit | `ims-backend/prisma/schema.prisma` |
| `InventoryTransaction` | Ledger header for stock movement | `type`, `sourceType`, `sourceId`, `actorUserId`, `reasonCode`, `metadata`, `occurredAt` | `lines`, `actorUser` | Type-based state only | Reversal attribution to original order sometimes relies on `sourceType`, `sourceId`, and metadata rather than direct order FK on header | `ims-backend/prisma/schema.prisma` |
| `InventoryTransactionLine` | Ledger line with material attribution | `inventoryTransactionId`, `rawMaterialId`, `stockBatchId`, `productVariantId`, `orderItemId`, `quantityDelta`, `unitCostSnapshot`, `totalCostDelta` | `inventoryTransaction`, `rawMaterial`, `stockBatch`, `productVariant`, `orderItem` | No status field | Strong historical attribution already exists; no index on `productVariantId` | `ims-backend/prisma/schema.prisma` |
| `RawMaterialInventorySummary` | Current material stock summary | `onHandQuantity`, `usableQuantity`, `nearestExpiryDate`, `activeBatchCount` | `rawMaterial` | No explicit status field | Current-state only, not historical | `ims-backend/prisma/schema.prisma` |
| `VariantAvailabilitySummary` | Current variant stock/sellability summary | `isInStock`, `isSellable`, `availableBaseQty`, `blockingReason` | `productVariant` | `isInStock`, `isSellable`, `blockingReason` | Variant-level only; no product-level persisted sellability summary | `ims-backend/prisma/schema.prisma` |
| `Order` | POS order header | `status`, `createdByUserId`, `idempotencyKey`, `totalAmount`, `totalCogsAmount`, `completedAt` | `items`, `payments`, `reversal`, `createdBy` | `status` (`COMPLETED`, `VOIDED`, `REFUNDED`) | Historical product snapshots live on items, not header | `ims-backend/prisma/schema.prisma` |
| `OrderItem` | Ordered sellable unit snapshot | `orderId`, `productVariantId`, `quantity`, `productNameSnapshot`, `variantNameSnapshot`, `skuSnapshot`, COGS fields | `order`, `productVariant`, `modifiers`, `inventoryLines` | No separate status field | Strong historical preservation after future product/variant edits | `ims-backend/prisma/schema.prisma` |
| `OrderPayment` | Order payments | `orderId`, `method`, `amount`, `reference`, `receivedAt` | `order` | Payment method only | Named `OrderPayment`, not generic `Payment` | `ims-backend/prisma/schema.prisma` |
| `OrderReversal` | Void/refund record | `orderId`, `actorUserId`, `type`, `reasonCode`, `note`, `amount`, `paymentReference`, `metadata`, `occurredAt` | `order`, `actorUser` | `type` (`VOID`, `REFUND`) | Inventory reversal lines link through transaction header and preserved `orderItemId` on lines | `ims-backend/prisma/schema.prisma` |

### Recipe ownership decision
Verified recipe ownership in the current schema:
- Base recipes belong to **product variants**, not products: `VariantRecipeItem.productVariantId` in `ims-backend/prisma/schema.prisma`.
- Modifier ingredient effects belong to **modifier options**, not products or variants directly: `ModifierRecipeAdjustment.modifierId` in `ims-backend/prisma/schema.prisma`.
- There is **no product-level recipe table**.

Therefore, recipes are stored as **a combination of variant-level base recipes plus modifier-level adjustments**.

### Existing active / archive / status fields relevant to products
Verified fields:
- `Product.isEnabled`
- `ProductVariant.isEnabled`
- `RawMaterial.isActive`
- `ModifierGroup.isActive`
- `Modifier.isActive`
- `VariantAvailabilitySummary.isInStock`
- `VariantAvailabilitySummary.isSellable`
- `Order.status`
- `OrderReversal.type`
- `InventoryTransaction.type`

Missing for products:
- No `archivedAt`
- No `archivedById`
- No `archiveReason`
- No `isArchived`

## 3. Existing Backend APIs and Services

### Verified backend modules and conventions
- Catalog controller/service: `ims-backend/src/catalog/catalog.controller.ts`, `ims-backend/src/catalog/catalog.service.ts`
- Recipes module/services: `ims-backend/src/recipes/recipes.module.ts`, `ims-backend/src/recipes/recipe-resolver.service.ts`, `ims-backend/src/recipes/modifier-validation.service.ts`
- Inventory ledger service: `ims-backend/src/inventory/inventory-ledger.service.ts`
- FEFO allocator: `ims-backend/src/inventory/fefo-allocator.service.ts`
- Availability service: `ims-backend/src/availability/availability.service.ts`
- Orders and checkout service: `ims-backend/src/orders/orders.service.ts`
- Reversal flow: same `OrdersService` plus `OrderReversal` model
- DTO patterns: `class-validator` + `class-transformer` in `ims-backend/src/orders/dto/` and `ims-backend/src/inventory/dto/`
- Guards and decorators: `ims-backend/src/auth/auth.module.ts`, `ims-backend/src/auth/guards/`, `ims-backend/src/auth/decorators/`
- Global validation: `ims-backend/src/main.ts`

### API / service matrix

| Method | Route | Purpose | Role | Service | Current Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/categories` | List categories | Authenticated only; no explicit role decorator found | `CatalogService.listCategories()` | Existing and reusable | `ims-backend/src/catalog/catalog.controller.ts` |
| `GET` | `/products` | List products with category | Authenticated only; no explicit role decorator found | `CatalogService.listProducts()` | Existing but incomplete for admin management | `ims-backend/src/catalog/catalog.controller.ts` |
| `GET` | `/products/:id/variants` | List variants for a product with availability summary | Authenticated only; no explicit role decorator found | `CatalogService.listProductVariants()` | Existing and reusable | `ims-backend/src/catalog/catalog.controller.ts` |
| `GET` | `/pos/menu` | Return POS menu with categories, products, variants, modifier groups, availability | Authenticated only; no explicit role decorator found | `CatalogService.getPosMenu()` | Existing and reusable | `ims-backend/src/catalog/catalog.controller.ts` |
| `POST` | `/pos/checkout` | Checkout, deduct stock, create order and ledger entries | Authenticated user | `OrdersService.checkout()` | Existing and reusable | `ims-backend/src/orders/orders.controller.ts` |
| `GET` | `/orders` | List orders | `ADMINISTRATOR`, `STAFF`, `SYSTEM_ADMINISTRATOR` | `OrdersService.listOrders()` | Existing and reusable | `ims-backend/src/orders/orders.controller.ts` |
| `GET` | `/orders/:id` | Get order detail | `ADMINISTRATOR`, `STAFF`, `SYSTEM_ADMINISTRATOR` | `OrdersService.getOrderById()` | Existing and reusable | `ims-backend/src/orders/orders.controller.ts` |
| `POST` | `/orders/:id/void` | Void order and restore stock | `ADMINISTRATOR`, `STAFF`, `SYSTEM_ADMINISTRATOR` with privileged approver requirement in service | `OrdersService.voidOrder()` | Existing and reusable | `ims-backend/src/orders/orders.controller.ts`, `ims-backend/src/orders/orders.service.ts` |
| `POST` | `/orders/:id/refund` | Refund order and restore stock | `ADMINISTRATOR`, `STAFF`, `SYSTEM_ADMINISTRATOR` with privileged approver requirement in service | `OrdersService.refundOrder()` | Existing and reusable | `ims-backend/src/orders/orders.controller.ts`, `ims-backend/src/orders/orders.service.ts` |
| `GET` | `/reports/pos-inventory-linked` | Inventory-linked sales consumption report | `ADMINISTRATOR`, `SYSTEM_ADMINISTRATOR` | `ReportsService.getPosInventoryLinked()` | Existing and reusable for ingredient-usage reporting foundations | `ims-backend/src/reports/reports.controller.ts`, `ims-backend/src/reports/reports.service.ts` |

### Existing support check

| Capability | Status | Notes | Evidence |
| --- | --- | --- | --- |
| Product list | Supported | Returns products + category only; no variants, counts, archive filter, or pagination | `ims-backend/src/catalog/catalog.service.ts` |
| Product details | Partially supported | No dedicated product detail route; product variants can be listed by product ID | `ims-backend/src/catalog/catalog.controller.ts` |
| Product create | Missing | No create product endpoint or service | Catalog and recipes modules inspected |
| Product edit | Missing | No update product endpoint or service | Catalog and recipes modules inspected |
| Activate / deactivate product | Present but disconnected | Manual availability field exists in schema as `Product.isEnabled`, but no API/controller found to manage it | `ims-backend/prisma/schema.prisma` |
| Archive product | Missing | No archive fields and no archive route | `ims-backend/prisma/schema.prisma` |
| Restore product | Missing | Same reason | `ims-backend/prisma/schema.prisma` |
| Delete product | Missing | No delete API found | Catalog module inspected |
| Recipe reads | Present but disconnected | Recipes are read internally for availability/checkout, not exposed as admin CRUD | `ims-backend/src/recipes/recipe-resolver.service.ts` |
| Recipe replacement | Missing | No recipe write API found | Recipes module inspected |
| Availability | Supported at variant level | `VariantAvailabilitySummary` plus `AvailabilityService` | `ims-backend/src/availability/availability.service.ts` |
| POS menu retrieval | Supported | Includes product, variant, modifier, and availability data | `ims-backend/src/catalog/catalog.service.ts` |

### Pagination conventions
Verified conventions are inconsistent by feature area:
- Reports commonly accept a validated `limit` via `ReportFiltersDto` with `1..50` bounds: `ims-backend/src/reports/dto/report-filters.dto.ts`
- Inventory transaction list accepts `limit` with `1..200`: `ims-backend/src/inventory/dto/list-inventory-transactions.dto.ts`
- Orders service contains an internal `listOrdersPaginated()` method, but the controller exposes non-paginated `listOrders()`: `ims-backend/src/orders/orders.service.ts`, `ims-backend/src/orders/orders.controller.ts`
- Catalog product/category endpoints currently do **not** expose pagination

Recommendation for product management: follow existing DTO validation style, but introduce explicit pagination on product/variant admin listings rather than copying the current non-paginated catalog list shape.

### Error handling conventions
Verified backend conventions:
- `NotFoundException` for missing resources
- `BadRequestException` for invalid state or invalid selection logic
- `ConflictException` for insufficient FEFO stock
- `UnauthorizedException` and `ForbiddenException` in guards

Evidence:
- `ims-backend/src/catalog/catalog.service.ts`
- `ims-backend/src/recipes/modifier-validation.service.ts`
- `ims-backend/src/inventory/fefo-allocator.service.ts`
- `ims-backend/src/auth/guards/session-auth.guard.ts`
- `ims-backend/src/auth/guards/roles.guard.ts`

## 4. Existing Frontend

### Verified existing admin/frontend patterns
- Admin route protection: `ims-frontend/src/app/admin/layout.tsx` uses `AuthGuard` with `allowedRoles={["ADMINISTRATOR"]}`.
- Auth guard behavior: `ims-frontend/src/components/auth/AuthGuard.tsx`
- Main admin shell: `ims-frontend/src/components/admin/AdminDashboardLayout.tsx`
- Admin sidebar/navigation: `ims-frontend/src/components/admin/AdminSidebar.tsx`
- Current reusable admin CRUD/table/modals: `ims-frontend/src/app/admin/inventory/page.tsx` and `ims-frontend/src/components/admin/inventory/`
- Current product-facing live UI: `ims-frontend/src/components/staff-pos/StaffPOSPage.tsx` and `ims-frontend/src/components/staff-pos/modals/ProductConfiguratorModal.tsx`
- Current reports-based ingredient consumption UI: `ims-frontend/src/components/admin/reports/PosInventoryLinkedSection.tsx`
- API helper pattern: `ims-frontend/src/lib/api.ts`, `ims-frontend/src/lib/inventory.ts`, `ims-frontend/src/lib/pos.ts`, `ims-frontend/src/lib/reports.ts`

### Current admin navigation
Verified admin nav items:
- Dashboard
- Inventory
- Forecasting
- Reports
- Alerts

There is **no current Products nav item** in `ims-frontend/src/components/admin/AdminSidebar.tsx`.

### Current product / catalog screens
Verified:
- No `/admin/products` route exists under `ims-frontend/src/app/admin/`
- No dedicated admin product CRUD component tree exists
- Products are currently surfaced in staff POS and POS reports, not in an administrator product-management workspace

### Current reusable UI patterns to preserve
The future product section should preserve these patterns from the live admin UI:
- fixed left navigation and orange accent shell: `ims-frontend/src/components/admin/AdminSidebar.tsx`, `ims-frontend/src/components/admin/AdminDashboardLayout.tsx`
- rounded white cards/panels with light background: `ims-frontend/src/components/admin/inventory/InventorySummaryPanel.tsx`
- form field styling via shared helper: `ims-frontend/src/components/admin/inventory/InventoryField.tsx`
- modal shell with rounded large white dialog: `ims-frontend/src/components/staff-pos/modals/Modal.tsx` and inventory modal system under `ims-frontend/src/components/admin/inventory/`
- inline success/error notices using page state, not a dedicated toast library: `ims-frontend/src/app/admin/inventory/page.tsx`, `ims-frontend/src/components/staff-pos/StaffPOSPage.tsx`
- confirmation patterns using modal confirmation for admin actions and occasional `window.confirm()` for quick staff actions: `ims-frontend/src/components/admin/inventory/RawMaterialModals.tsx`, `ims-frontend/src/components/staff-pos/StaffPOSPage.tsx`
- availability badges / sellability explanations from live POS variant selector: `ims-frontend/src/components/staff-pos/modals/ProductConfiguratorModal.tsx`

### Existing forms, tables, cards, dialogs, selectors
Strong reusable references:
- admin list/table pattern: `ims-frontend/src/components/admin/inventory/InventorySummaryPanel.tsx`
- admin detail panel pattern: `ims-frontend/src/components/admin/inventory/MaterialDetailPanel.tsx`
- modal-driven create/edit/archive pattern: `ims-frontend/src/components/admin/inventory/RawMaterialModals.tsx`
- stock-run modal workflow pattern: `ims-frontend/src/components/admin/inventory/StockRunModals.tsx`
- supplier selector form pattern: `ims-frontend/src/components/admin/inventory/SupplierManagementModal.tsx`
- raw-material selector pattern via existing inventory forms and waste/adjustment flows: `ims-frontend/src/components/admin/inventory/WasteModal.tsx`, `ims-frontend/src/components/admin/inventory/AdjustmentModal.tsx`
- product/variant availability display pattern: `ims-frontend/src/components/staff-pos/modals/ProductConfiguratorModal.tsx`

### Recommended route
Recommended route: `/admin/products`

Why:
- No existing admin route already owns product CRUD
- `/admin/inventory` is currently a raw-material / stock-run workspace, not a product catalog workspace
- Product management belongs at the same hierarchy level as Inventory, Reports, and Alerts

### Source-complete vs runtime-verified note
Verified in source:
- admin auth guard wiring
- sidebar structure
- inventory workspace structure
- product-facing POS components

Not runtime-verified in this planning phase:
- actual browser behavior of a future `/admin/products` route because it does not exist yet

## 5. Product-to-Inventory Trace

### Verified trace
Product
-> Product Variant
-> Variant base recipe (`VariantRecipeItem`)
-> Optional modifier recipe adjustments (`ModifierRecipeAdjustment`)
-> Raw Material
-> Checkout
-> FEFO batch consumption
-> Inventory Transaction
-> Inventory Transaction Line
-> Availability Refresh
-> POS State

### How checkout deducts ingredients
Verified in `ims-backend/src/orders/orders.service.ts`:
1. Checkout validates modifiers.
2. `RecipeResolverService.resolveVariantRequirements()` loads variant recipe items and applies modifier recipe deltas.
3. The service expands requirements by order quantity.
4. `FEFOAllocator.allocateAndConsume()` locks eligible batches and decrements remaining quantities in FEFO order.
5. `InventoryLedgerService.appendTransaction()` writes a `CHECKOUT` inventory transaction with line-level attribution.
6. `AvailabilityService.refreshRawMaterialSummaries()` and `refreshVariantSummariesForRawMaterialIds()` recompute stock/sellability after the ledger write.

### Whether FEFO is used
Yes.

Verified in `ims-backend/src/inventory/fefo-allocator.service.ts`:
- Eligible `stock_batches` are selected with positive remaining quantity and non-expired business-date eligibility.
- Ordering is by `expiration_date ASC NULLS LAST, received_at ASC, id ASC`.
- Rows are locked with `FOR UPDATE`.

### Whether transaction lines store attribution fields
Verified in `InventoryTransactionLine` schema and in checkout/reversal writes:
- `rawMaterialId`: Yes
- `orderItemId`: Yes, nullable but populated for checkout and preserved for reversal lines
- `productVariantId`: Yes, nullable but populated for checkout and preserved for reversal lines
- `orderId`: Not directly on line; indirect through `orderItem.orderId` and `inventoryTransaction.sourceId` for checkout transactions

Evidence:
- `ims-backend/prisma/schema.prisma`
- `ims-backend/src/orders/orders.service.ts`

### Whether deduction can be attributed to a specific product
Partially yes, and strong enough for Phase 1 planning.

Verified attribution layers:
- Product variant attribution is stored directly on `InventoryTransactionLine.productVariantId`
- Order item attribution is stored on `InventoryTransactionLine.orderItemId`
- Product snapshots for historical naming are stored on `OrderItem.productNameSnapshot`, `variantNameSnapshot`, and `skuSnapshot`
- Product-level attribution can be derived via `InventoryTransactionLine -> OrderItem -> ProductVariant/Product`

Concern:
- There is no direct `productId` on inventory transaction lines, so product-level aggregation is derived rather than stored.

### How reversals are recorded
Verified in `ims-backend/src/orders/orders.service.ts`:
- The service locates the original checkout inventory transaction for the order.
- It increments batch remaining quantities back into stock.
- It creates an `OrderReversal` record.
- It appends a new `VOID` or `REFUND` inventory transaction whose lines reuse the original `rawMaterialId`, `stockBatchId`, `orderItemId`, and `productVariantId`, but with positive `quantityDelta` and positive `totalCostDelta`.
- Availability summaries are refreshed again.

### Whether historical usage remains accurate after recipe changes
Yes for ledger-based usage; no for recipe-reconstruction-only calculations.

Verified reason:
- Actual checkout deductions are recorded into `InventoryTransactionLine` at the time of sale.
- Historical order display also keeps product/variant snapshots on `OrderItem`.
- Therefore, historical ingredient usage can be sourced from the ledger even after recipes change.

This is the correct foundation for the requested product management reporting.

## 6. Requested Feature Gap Analysis

| Capability | Database | Backend | Frontend | Integration | Classification | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Product list | Product/category tables exist | Read API exists | No admin screen | Partial | Existing but incomplete | `ims-backend/src/catalog/catalog.service.ts` |
| Product creation | Product schema exists | No create API | No UI | Missing | Missing | Catalog module inspected |
| Product editing | Product schema exists | No update API | No UI | Missing | Missing | Catalog module inspected |
| Variant management | Variant schema exists | Read-only list by product exists | No admin variant UI | Partial | Existing but incomplete | `ims-backend/src/catalog/catalog.controller.ts` |
| Ingredient management | Recipe tables exist | Internal recipe reads exist, no CRUD | No admin UI | Missing | Present but disconnected | `ims-backend/src/recipes/recipe-resolver.service.ts` |
| Ingredient count | Recipe data sufficient | No dedicated query yet | No UI | Missing | Existing but incomplete | `ims-backend/prisma/schema.prisma` |
| Per-order ingredient usage | Ledger attribution sufficient | No dedicated product-management endpoint | No UI | Partial | Existing but incomplete | `ims-backend/prisma/schema.prisma`, `ims-backend/src/orders/orders.service.ts` |
| One-day usage | Ledger + occurredAt sufficient | New query needed | No UI | Partial | Existing but incomplete | `ims-backend/src/common/utils/manila-business-date.util.ts` |
| Seven-day usage | Ledger + occurredAt sufficient | New query needed | No UI | Partial | Existing but incomplete | same as above |
| Thirty-day usage | Ledger + occurredAt sufficient | New query needed | No UI | Partial | Existing but incomplete | same as above |
| Manual availability | `Product.isEnabled` and `ProductVariant.isEnabled` exist | No admin write API | No admin UI | Partial | Present but disconnected | `ims-backend/prisma/schema.prisma` |
| Stock availability | `VariantAvailabilitySummary.isInStock` exists | Availability service exists | POS and reports use it | Strong | Existing and reusable | `ims-backend/src/availability/availability.service.ts` |
| Effective sellability | `VariantAvailabilitySummary.isSellable` and `blockingReason` exist | Computed in backend | POS uses it | Strong at variant level | Existing and reusable | `ims-backend/src/availability/availability.service.ts`, `ims-frontend/src/components/staff-pos/modals/ProductConfiguratorModal.tsx` |
| Archive | No product archive fields | No API | No UI | Missing | Requires schema change | `ims-backend/prisma/schema.prisma` |
| Restore | No product archive fields | No API | No UI | Missing | Requires schema change | `ims-backend/prisma/schema.prisma` |
| Safe permanent deletion | Restrictive relationships exist but no formal workflow | No API | No UI | Missing | Existing but incomplete | `ims-backend/prisma/schema.prisma` |
| POS synchronization | POS menu already reads product/variant availability | Existing backend and frontend | Existing | Strong | Existing and reusable | `ims-backend/src/catalog/catalog.service.ts`, `ims-frontend/src/components/staff-pos/StaffPOSPage.tsx` |

## 7. Product and Recipe Business Rules

The following rules are supported by the current repository and should guide Phase 1.

### Required product fields
Supported by current schema:
- `categoryId` required
- `name` required
- `isEnabled` exists and can represent manual sellability control

Evidence:
- `ims-backend/prisma/schema.prisma`

### Required variant fields
Supported by current schema:
- `productId` required
- `name` required
- `price` required
- `sku` required and unique
- `isEnabled` exists

### Category requirements
Supported by current schema:
- Product must belong to a category
- Category deletion would be restricted while products reference it

### Unique-name / SKU behavior
Verified constraints:
- Product unique within category: `@@unique([categoryId, name])`
- Variant unique within product: `@@unique([productId, name])`
- Variant SKU globally unique: `@unique`

### Price validation
Current repository behavior implies:
- Variant price must be present
- Explicit create/update variant DTO validation does not exist yet because variant CRUD API is missing
- POS logic assumes numeric, persisted variant price

Recommendation: future create/edit DTOs should validate positive or non-negative variant price according to business choice, but the repository does not yet encode that rule in a variant DTO.

### Recipe quantity validation
Current repository supports positive recipe requirement semantics at runtime:
- Base recipe quantities are consumed as decimals
- Checkout only keeps positive resulting requirements after modifier adjustments

Concern:
- There is no existing admin recipe write validator to enforce positive base quantities, zero/negative handling policy, or duplicate prevention at UI/API boundaries.

### Duplicate ingredient prevention
Current schema already prevents duplicate base recipe ingredients and duplicate modifier ingredient adjustments:
- `VariantRecipeItem @@unique([productVariantId, rawMaterialId])`
- `ModifierRecipeAdjustment @@unique([modifierId, rawMaterialId])`

This is strong reusable protection.

### Unit compatibility
Current repository model:
- Recipe lines do not store a separate unit FK
- Quantities are implicitly expressed in the raw material's own unit

Implication:
- Unit compatibility is simplified rather than deeply modeled
- Future product recipe UI should treat quantity entry as "in the selected raw material's unit"
- Do not introduce a duplicate conversion system in Phase 1

### Empty-recipe behavior
Verified behavior:
- A variant with zero `recipeItems` is considered unavailable
- Availability blocking reason becomes `NO_RECIPE`
- `availableBaseQty` becomes `0`

Evidence:
- `ims-backend/src/availability/availability.service.ts`

### Manual availability
Verified current meaning:
- `Product.isEnabled` participates in variant blocking reason as `DISABLED_PRODUCT`
- `ProductVariant.isEnabled` participates as `DISABLED_VARIANT`

This is the existing manual availability mechanism and should be reused.

### Stock availability
Verified current meaning:
- Stock availability is computed from current `RawMaterialInventorySummary.usableQuantity`
- Variant `isInStock` requires all base recipe ingredients to have enough usable quantity
- Required modifier groups must also have at least one valid in-stock option when required

### Effective sellability
Verified current meaning in backend:
- no base recipe -> `NO_RECIPE`
- disabled product -> `DISABLED_PRODUCT`
- disabled variant -> `DISABLED_VARIANT`
- insufficient stock -> `INSUFFICIENT_STOCK`
- no valid required modifier option -> `NO_VALID_REQUIRED_MODIFIER`
- otherwise -> `NONE` and `isSellable = true`

This matches the requested direction closely at the variant level.

### Archive restrictions
Current repository does not yet support product archive state. The closest reusable pattern is raw material archive via `isActive = false`.

Therefore, archive restrictions for products must be explicitly added rather than inferred.

### Restore behavior
Not currently supported for products.

### Deletion restrictions
Current safe-deletion implications from schema:
- `OrderItem.productVariant` uses `onDelete: Restrict`
- `ProductVariant.product` uses `onDelete: Restrict`
- Recipes cascade from variant delete, but order-item history blocks deleting variants in use

Recommended rule from current schema:
- Permanent product deletion should only be allowed when no variants remain and no historical order references exist through those variants
- In practice, current repository has no supported delete workflow, so archive/restore should come before any delete design

### Effects on POS
Current repository behavior:
- POS menu pulls product and variant `isEnabled`
- POS variant availability uses backend `availabilitySummary`
- Product card sellability is effectively derived from having at least one enabled + sellable variant in `StaffPOSPage.tsx`

### Effects on historical orders
Current repository preserves historical order readability through snapshots:
- `OrderItem.productNameSnapshot`
- `OrderItem.variantNameSnapshot`
- `OrderItem.skuSnapshot`
- inventory ledger line attribution

This should remain untouched by product-management implementation.

## 8. Ingredient Usage Semantics

The following semantics are recommended because they align with current ledger design and preserve historical correctness.

### Per Order
Intended behavior:
- Select one order
- Use actual `InventoryTransactionLine` rows from the order's `CHECKOUT` transaction for gross deductions
- Use `VOID` and `REFUND` inventory transactions that preserve the same `orderItemId`, `productVariantId`, and material attribution for reversed quantity
- Group where possible by product snapshot, variant snapshot, and raw material

Recommended scope details:
- Start / end timestamps: not date-window based; order-specific selection
- Included gross transaction types: `CHECKOUT` with `sourceType = ORDER`
- Included reversal transaction types: `VOID`, `REFUND`
- Excluded types: `ADJUSTMENT`, `WASTE`, `STOCK_RUN`, `SYSTEM_IMPORT`
- Gross deducted quantity: absolute sum of negative checkout `quantityDelta`
- Reversed quantity: sum of positive reversal `quantityDelta`
- Net deducted quantity: gross minus reversed
- Order count: always `1`
- Product units sold: sum of `OrderItem.quantity` for matching order items
- Unit-of-measure behavior: use the raw material's unit from `RawMaterial.unit`

### One Day
Recommended behavior:
- Use one Manila business date
- Default to today's Manila business date using the repository's Manila business-date convention
- Query ledger rows by `InventoryTransaction.occurredAt`

Recommended timestamps:
- Start: `YYYY-MM-DDT00:00:00.000+08:00`
- End: `YYYY-MM-DDT23:59:59.999+08:00`

### Last 7 Days
Recommended behavior:
- Include the selected/current Manila business day and previous six Manila business days
- Use day-aligned Manila boundaries, not rolling 168-hour UTC windows

Recommended timestamps:
- Start: start of Manila business day for `today - 6 days`
- End: end of Manila business day for `today`

### Last 30 Days
Recommended behavior:
- Include the selected/current Manila business day and previous twenty-nine Manila business days
- Use day-aligned Manila boundaries

Recommended timestamps:
- Start: start of Manila business day for `today - 29 days`
- End: end of Manila business day for `today`

### Scope rules by reporting mode

| Scope | Start / End timestamps | Included transaction types | Excluded transaction types | Gross deducted quantity | Reversed quantity | Net deducted quantity | Order count | Product units sold | Unit-of-measure behavior |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Per order | Exact order selection, not generic date window | `CHECKOUT` | `ADJUSTMENT`, `WASTE`, `STOCK_RUN`, `SYSTEM_IMPORT` | Absolute checkout consumption | Positive `VOID` + `REFUND` rows tied to same order attribution | Gross - reversed | 1 | Sum of order item quantities | Use raw material unit |
| One day | Manila day start/end | `CHECKOUT` for gross, `VOID`/`REFUND` for reversed | same exclusions | Absolute checkout consumption in day | Positive reversal lines in day | Gross - reversed | Distinct order count from checkout lines | Sum of order item quantities | Use raw material unit |
| Last 7 days | Manila day start/end over 7 business dates | same | same | same | same | same | Distinct orders over range | Sum of order item quantities | same |
| Last 30 days | Manila day start/end over 30 business dates | same | same | same | same | same | Distinct orders over range | Sum of order item quantities | same |

### Important implementation note
Current `getPosInventoryLinked()` in `ims-backend/src/reports/reports.service.ts` only reads `CHECKOUT` lines for completed sales-linked consumption. That is reusable for gross deductions, but **net deduction reporting for per-order/day/7-day/30-day usage will require a new backend query shape that also accounts for `VOID` and `REFUND` ledger rows**.

## 9. Schema Sufficiency Decision

### Overall decision
The current schema is **partially sufficient**.

Sufficient already for:
- product / variant identity
- variant-level recipes
- modifier-level recipe adjustments
- raw-material attribution
- historical ingredient deductions through the ledger
- manual availability enable/disable via `isEnabled`
- stock-derived availability and effective sellability at the variant level

Not sufficient for the full requested feature set because:
- product archive / restore is not modeled
- no explicit product-level archive audit fields exist

### Proposed schema changes that appear genuinely necessary

| Proposed change | Required? | Why | Why existing fields are insufficient | Nullability / default | Indexes / FK / backfill / historical impact |
| --- | --- | --- | --- | --- | --- |
| `Product.archivedAt` | Yes | Needed to distinguish archived from merely manually disabled | `isEnabled` is already the manual availability flag and cannot safely double as archive state | Nullable, default `null` | Add index if archived filtering becomes common; no backfill beyond null; no historical order impact |
| `Product.archivedById` | Likely yes | Needed for admin auditability of archive/restore operations | No existing product audit field captures who archived a product | Nullable, default `null` | FK to `User` with `onDelete: SetNull`; no historical order impact |
| `Product.archiveReason` | Optional but justified | Useful for operational/admin audit trail | No current place to preserve archive rationale | Nullable, default `null` | No special index required initially |

### Proposed changes that do **not** appear necessary right now
- New manual availability field on `Product`: **not needed**, because `Product.isEnabled` already exists.
- New manual availability field on `ProductVariant`: **not needed**, because `ProductVariant.isEnabled` already exists.
- `orderItemId` on `InventoryTransactionLine`: **already exists**.
- `productVariantId` on `InventoryTransactionLine`: **already exists**.
- A duplicate recipe system: **not needed** and would conflict with current architecture.
- A product-level recipe table: **not needed**, because recipes are already variant-based in the repository.

### Additional performance note, not a strict Phase 1 schema requirement
A future index on `InventoryTransactionLine.productVariantId` may become useful for heavy product-usage reporting, because the current schema indexes `orderItemId` but not `productVariantId`. This is a performance consideration, not a Phase 1 correctness requirement.

## 10. Risks

- Breaking POS menu retrieval: current POS menu relies on `CatalogService.getPosMenu()` and existing product/variant/modifier availability shape.
- Duplicate recipes: base and modifier recipe duplication is prevented in schema, but future admin write flows must preserve that behavior.
- Incorrect unit conversion: recipe quantities are implicitly in raw-material units; a careless UI could invent a second unit system and corrupt expectations.
- Historical calculations using current recipes: this would be incorrect; historical usage must remain ledger-based.
- Availability-state drift: product-management writes that change variants/recipes must trigger the same availability refresh path used elsewhere.
- Negative inventory: stock-changing actions must remain backend-authoritative and reuse current FEFO / ledger protections.
- Double-counted reversals: product usage reporting must distinguish checkout gross from reversal restoration to avoid overstating net usage.
- Date-boundary errors: reporting must use Manila business-day windows, not naive UTC date slicing.
- N+1 queries: product detail pages that load variants, recipe lines, modifier groups, ingredient counts, and availability can easily become chatty if not deliberately shaped.
- Expensive aggregation queries: order/day/7-day/30-day product usage reports will aggregate `InventoryTransactionLine` and `OrderItem`; indexes and query shape matter.
- Archive conflicts: once archive is modeled separately from `isEnabled`, list filters and POS filtering must not confuse disabled vs archived.
- Unsafe hard deletion: order-item `Restrict` relationships mean deletion must be treated as an exceptional, safety-gated operation.
- Race conditions during recipe updates: editing recipes while sales occur could desynchronize availability unless updates and refreshes are wrapped transactionally.

## 11. Planning Verdict

### Existing components to reuse
Backend:
- `CatalogService` and `CatalogController` as the starting product read surface
- `RecipeResolverService` for understanding current recipe semantics
- `AvailabilityService` for stock-derived and effective sellability
- `InventoryLedgerService` and `InventoryTransactionLine` for historical ingredient usage
- `OrdersService` reversal flow for net usage semantics
- `ReportsService.getPosInventoryLinked()` as the closest reusable ingredient-consumption report foundation

Frontend:
- `AdminDashboardLayout` and `AdminSidebar` for route placement and visual consistency
- admin inventory components under `ims-frontend/src/components/admin/inventory/` for table, form, modal, and confirmation patterns
- `ProductConfiguratorModal` for variant-level availability language and badge semantics
- `PosInventoryLinkedSection` for ingredient-consumption table/export/filter interaction patterns

### Necessary schema changes
Required:
- product archive state fields, preferably centered on `archivedAt` and audit metadata

Not required:
- new manual availability fields
- new historical attribution fields for order-item / product-variant usage
- a new recipe architecture

### Necessary backend changes
- New admin product APIs for list/detail/create/update
- New variant management APIs
- New recipe read/write APIs scoped to current variant-level recipe model and modifier adjustments
- New product-management reporting/query endpoints for per-order and business-day ingredient usage using ledger data
- Availability refresh hooks after recipe/product/variant changes
- Explicit archive/restore/delete workflows with safety checks
- Stronger role restrictions than the current read-only catalog endpoints, which are authenticated but not explicitly role-scoped

### Necessary frontend changes
- Add `/admin/products`
- Add Products nav item in admin sidebar
- Build product list + detail workspace matching the current orange-and-white admin system
- Add create/edit dialogs
- Add variant management UI
- Add ingredient management UI using raw-material selectors and quantity inputs tied to material units
- Add availability panel that separates manual availability, stock availability, and effective sellability
- Add ingredient-usage views for order / 1 day / 7 days / 30 days

### Features requiring no new architecture
These can reuse the current architecture rather than requiring a redesign:
- product-to-ledger attribution
- historical ingredient deductions
- FEFO-backed stock consumption
- variant-level stock availability and sellability
- manual enable/disable semantics through existing `isEnabled` fields
- POS synchronization via the existing menu and availability flow

### Blockers before implementation
- Product archive / restore cannot be implemented truthfully without new schema support
- There is no existing admin product CRUD route or UI to extend directly
- Recipes currently have internal runtime services but no admin CRUD API surface
- Current inventory-linked reporting is gross-checkout-focused and will need a new query shape for reversal-aware net usage reporting

### Recommended implementation direction
1. Add a dedicated `/admin/products` feature rather than overloading `/admin/inventory`.
2. Reuse the current product, variant, recipe, ledger, availability, and POS architecture exactly as-is.
3. Keep recipes at the current variant + modifier-adjustment model; do not invent a product-level recipe layer.
4. Use `Product.isEnabled` / `ProductVariant.isEnabled` for manual availability, and keep stock/effective availability backend-authoritative.
5. Add only the minimum archive schema needed to separate archived products from manually disabled products.
6. Build ingredient usage from `InventoryTransactionLine` and reversal ledger entries, not from historical recipe reconstruction.
