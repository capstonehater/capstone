# Products Backend + Database Audit and Redesign Plan

## 1. Executive Summary

This audit was completed against the current backend source, Prisma schema, Prisma migrations, the checked-in SQL backup, and a read-only inspection of the connected PostgreSQL database.

The strongest current foundation is the operational core:

- product/category/variant catalog exists
- POS menu composition exists
- recipe-based inventory deduction exists
- order-linked inventory ledger history exists
- availability summaries and availability event history exist
- stockout history, inventory daily snapshots, and forecasting foundation tables exist in schema/live DB

The biggest issue is **source/schema/database drift**:

- backend source and Prisma schema expect newer product archive fields on `products`
- the connected database and checked-in SQL backup do **not** currently have those archive columns
- live DB contains forecasting tables that are **not recorded** in `_prisma_migrations`

That means the codebase is not in a clean “single source of truth” state today. Some newer backend behaviors appear implemented in source but are not safely backed by the connected database structure yet.

Overall judgment:

- core inventory + order + availability architecture is real and reusable
- product domain is beyond prototype stage
- reporting-history and forecasting-history foundations were added later in phases
- product-management redesign work has started in source, but database rollout is incomplete
- the safest next move is **not** a rewrite; it is a controlled alignment pass between source, Prisma migrations, live DB, and backup expectations

## 2. Scope and Method

This audit used:

- backend source under [`ims-backend/src`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src)
- Prisma schema at [`ims-backend/prisma/schema.prisma`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/prisma/schema.prisma)
- Prisma migrations under [`ims-backend/prisma/migrations`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/prisma/migrations)
- static SQL backup at [`ims-backend/ims_db_backup.sql`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/ims_db_backup.sql)
- read-only SQL inspection against the connected PostgreSQL database configured from [`ims-backend/.env`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/.env)

Important constraint:

- no backend code, Prisma schema, migrations, or database data were changed during this audit
- no backup restore was performed
- no write queries were executed against the connected database

## 3. Current Backend Architecture Overview

### 3.1 Application modules

The NestJS app currently wires these major modules through [`ims-backend/src/app.module.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/app.module.ts):

- `UsersModule`
- `AuthModule`
- `CatalogModule`
- `RecipesModule`
- `InventoryModule`
- `StockRunsModule`
- `OrdersModule`
- `AvailabilityModule`
- `EventsModule`
- `ReportsModule`
- `AlertsModule`
- `ForecastingModule`

This is a modular backend with the product domain spread across several cooperating modules rather than one monolith.

### 3.2 Product-domain module split

Verified source split:

- catalog browsing and POS menu composition live in [`ims-backend/src/catalog/catalog.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/catalog/catalog.service.ts)
- admin product CRUD and recipe/usage management live in [`ims-backend/src/catalog/product-management.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/catalog/product-management.service.ts)
- admin product endpoints live in [`ims-backend/src/catalog/admin-products.controller.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/catalog/admin-products.controller.ts)
- inventory availability resolution lives in [`ims-backend/src/availability/availability.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/availability/availability.service.ts)
- availability/stockout history event persistence lives in [`ims-backend/src/availability/inventory-state-history.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/availability/inventory-state-history.service.ts)
- order checkout and reversal flows live in [`ims-backend/src/orders/orders.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/orders/orders.service.ts)
- inventory ledger writing lives in [`ims-backend/src/inventory/inventory-ledger.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/inventory/inventory-ledger.service.ts)

This is a good sign. The system already treats products as part of an operational graph:

- products/variants
- recipes
- stock
- availability
- orders
- ledger
- reporting history

## 4. Verified Product/Admin API Surface

The admin product controller currently exposes these verified endpoints in [`ims-backend/src/catalog/admin-products.controller.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/catalog/admin-products.controller.ts):

1. `GET /admin/products`
2. `GET /admin/products/:id`
3. `POST /admin/products`
4. `PATCH /admin/products/:id`
5. `PATCH /admin/products/:id/manual-availability`
6. `POST /admin/products/:id/archive`
7. `POST /admin/products/:id/restore`
8. `GET /admin/products/:id/delete-eligibility`
9. `DELETE /admin/products/:id`
10. `POST /admin/products/:id/variants`
11. `PATCH /admin/variants/:id`
12. `PATCH /admin/variants/:id/manual-availability`
13. `DELETE /admin/variants/:id`
14. `GET /admin/variants/:id/recipe`
15. `PUT /admin/variants/:id/recipe`
16. `GET /admin/products/:id/ingredient-usage`
17. `GET /admin/products/:id/orders/:orderId/ingredient-usage`

Access control is controller-level admin-only.

Audit implication:

- there is already a meaningful backend-admin surface for product lifecycle management
- this is not a greenfield product module
- archive/restore and delete-eligibility logic have already been designed in source

## 5. Current Business Rules Already Implemented in Source

The following rules were directly verified in [`ims-backend/src/catalog/product-management.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/catalog/product-management.service.ts):

### 5.1 Product identity and uniqueness

- product names are checked for uniqueness within category
- initial variant payloads must be distinct
- variant SKU uniqueness is enforced

### 5.2 Product lifecycle protections

- archived products cannot be edited
- archived products cannot accept new variants
- archived products cannot have recipe/manual-availability changes applied
- restore flow revalidates category existence and name uniqueness

### 5.3 Delete protections

Product delete eligibility checks references from:

- `order_items`
- `inventory_transaction_lines`
- `variant_availability_events`
- `stockout_events`

Variant delete eligibility checks the same kinds of historical references.

This is a strong architectural choice. It shows the backend is already trying to preserve transactional and analytical history instead of doing unsafe hard deletes.

### 5.4 Recipe protections

- duplicate raw materials in one recipe are rejected
- non-positive quantities are rejected
- nonexistent raw materials are rejected
- inactive raw materials are rejected

### 5.5 Usage reporting linkage

Ingredient usage for products/orders is derived from ledger history using transaction types:

- `CHECKOUT`
- `VOID`
- `REFUND`

This is a strong data-design decision because it ties product usage analytics to actual inventory movements rather than frontend estimates.

## 6. Current Product/Inventory/Availability Data Model in Practice

## 6.1 Core catalog tables observed in schema/backup/live DB

Verified as present:

- `categories`
- `products`
- `product_variants`
- `modifier_groups`
- `modifiers`
- `product_modifier_groups`
- `variant_recipe_items`
- `modifier_recipe_adjustments`

### 6.2 Operational tables observed in schema/backup/live DB

- `raw_materials`
- `units`
- `stock_batches`
- `inventory_transactions`
- `inventory_transaction_lines`
- `orders`
- `order_items`
- `payments`

### 6.3 History/foundation tables observed in schema/live DB

- `variant_availability_summaries`
- `variant_availability_events`
- `stockout_events`
- `inventory_daily_snapshots`
- `raw_material_demand_observations`
- `forecast_runs`
- `raw_material_forecast_outputs`
- `forecast_evaluations`
- `raw_material_forecast_policies`

This confirms the project has already evolved beyond pure CRUD into history-aware reporting and forecasting foundations.

## 7. Availability and Stock State Design

### 7.1 Current-state summaries

Verified in [`ims-backend/src/availability/availability.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/availability/availability.service.ts):

- raw-material state is summarized in `raw_material_inventory_summaries`
- variant state is summarized in `variant_availability_summaries`

Variant sellability is computed from:

- product enablement
- variant enablement
- recipe presence
- raw-material sufficiency
- required modifier viability

Blocking reasons are explicit:

- `NO_RECIPE`
- `DISABLED_PRODUCT`
- `DISABLED_VARIANT`
- `INSUFFICIENT_STOCK`
- `NO_VALID_REQUIRED_MODIFIER`
- `NONE`

### 7.2 State-change history

Verified in [`ims-backend/src/availability/inventory-state-history.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/availability/inventory-state-history.service.ts):

- raw-material stockouts are tracked in `stockout_events`
- variant sellability transitions are tracked in `variant_availability_events`

Important limitation verified from live DB:

- `stockout_events` currently appear populated for `RAW_MATERIAL` only
- no product-variant stockout rows were observed in live data

Audit implication:

- raw-material stock risk is real
- product/menu availability-over-time is real
- variant stockout semantics are not yet materially used in live data

## 8. Order, Inventory, and Product Usage Coupling

The product domain is strongly coupled to inventory and orders in a useful way.

Verified flow in [`ims-backend/src/orders/orders.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/orders/orders.service.ts):

1. checkout validates order items and payments
2. recipe requirements are resolved
3. FEFO allocation is used for inventory consumption
4. inventory ledger transaction is written with `CHECKOUT`
5. order item COGS and order total COGS are updated
6. availability/summary refresh runs after deduction
7. outbox/event emission occurs

This means product demand, usage, COGS, and availability are not isolated guesswork. They are tied to actual order execution.

That is one of the best existing foundations in the entire system.

## 9. Reporting and Forecasting Foundations

### 9.1 Inventory daily snapshots

Verified in [`ims-backend/src/inventory/inventory-daily-snapshot.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/inventory/inventory-daily-snapshot.service.ts):

- the backend captures daily inventory snapshots
- it uses Manila business-date helpers
- it appears to run from an in-process timer on module init
- it avoids duplicate same-day snapshot creation

### 9.2 Raw-material daily demand observations

Verified in [`ims-backend/src/forecasting/raw-material-demand-observation.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/forecasting/raw-material-demand-observation.service.ts):

- observations are derived from `CHECKOUT` inventory transaction lines
- grouping uses Manila business date
- the service rebuilds observation rows for target days

### 9.3 Legacy/mixed reports still exist

Verified from [`ims-backend/src/reports/reports.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/reports/reports.service.ts):

- reporting logic still contains mixed or broader report families, including legacy inventory/POS/admin style reporting

Audit implication:

- newer history foundations are present
- reporting surface has likely evolved in phases rather than being comprehensively re-normalized

## 10. Manila Business-Date Strategy

Verified in [`ims-backend/src/common/utils/manila-business-date.util.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/common/utils/manila-business-date.util.ts):

- canonical timezone constant: `Asia/Manila`
- business-date input format: `YYYY-MM-DD`
- date-only persistence helper uses UTC midnight representation for date-only storage
- business-day ranges are created as Manila local `00:00:00.000` to `23:59:59.999`

This is a meaningful improvement over ad hoc timestamp handling.

However, audit caution:

- the helper layer is present
- that does not prove every older report/query in the whole codebase already uses it consistently

## 11. Test Coverage State

Direct test file listing under app source/test folders found only:

- [`ims-backend/test/app.e2e-spec.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/test/app.e2e-spec.ts)

Audit implication:

- product/inventory/reporting behaviors are mostly not protected by meaningful backend test coverage in the repository
- current system maturity relies more on implementation reality than automated regression safety

## 12. Prisma Schema vs Migration History vs Live DB vs SQL Backup

This is the most important audit section.

### 12.1 Prisma migrations present in source

Verified migration directories:

1. `20260328104034_init_auth`
2. `20260330170000_auth_session_foundation`
3. `20260331000000_cafe_phase1_core`
4. `20260331000100_cafe_phase1_constraints`
5. `20260331113000_inventory_actions_phase2`
6. `20260401170000_phase4_alerts_and_reversals`
7. `20260404093228_reporting_foundation_history`
8. `20260416233000_forecasting_foundation`
9. `20260726150000_product_management_archive_and_usage_indexes`

### 12.2 Live database `_prisma_migrations`

Verified live DB recorded only:

1. `20260328104034_init_auth`
2. `20260330170000_auth_session_foundation`
3. `20260331000000_cafe_phase1_core`
4. `20260331000100_cafe_phase1_constraints`
5. `20260331113000_inventory_actions_phase2`
6. `20260401170000_phase4_alerts_and_reversals`
7. `20260404093228_reporting_foundation_history`

Missing from live migration history:

- `20260416233000_forecasting_foundation`
- `20260726150000_product_management_archive_and_usage_indexes`

### 12.3 Live DB contents contradict migration history

Despite the missing migration record, the live DB **does contain** forecasting tables:

- `raw_material_demand_observations`
- `forecast_runs`
- `raw_material_forecast_outputs`
- `forecast_evaluations`
- `raw_material_forecast_policies`

That means one of these is true:

- schema was applied manually outside Prisma migration history
- schema was applied from another environment and migration bookkeeping drifted
- SQL was imported from a DB whose `_prisma_migrations` table did not fully represent the actual schema

This is a real operational risk.

### 12.4 Source/schema expect product archive fields, but live DB does not have them

Verified in source migration and Prisma schema:

- `products.archived_at`
- `products.archived_by_id`
- `products.archive_reason`

Verified absent in live DB and absent in checked-in backup:

- no archive columns on `products`
- no `products_archived_at_idx`
- no category/archive composite index

This is a direct incompatibility between backend source and connected database structure.

### 12.5 SQL backup aligns with live DB for product archive gap

Verified in [`ims-backend/ims_db_backup.sql`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/ims_db_backup.sql):

- `products` table only has `id, category_id, name, is_enabled, created_at, updated_at`
- no archive fields present

This suggests the backup and live DB are aligned on this issue, and the drift is between:

- source/Prisma/migration folder
- actual deployed database

### 12.6 Static row-count signals from backup/live DB

Selected verified row counts matched between backup inspection and live DB spot checks:

- `categories`: 16
- `products`: 70
- `product_variants`: 90
- `variant_recipe_items`: 139
- `variant_availability_summaries`: 85
- `variant_availability_events`: 9
- `stockout_events`: 3
- `orders`: 27
- `order_items`: 35
- `inventory_transactions`: 23
- `inventory_transaction_lines`: 25
- `raw_materials`: 67
- `inventory_daily_snapshots`: 1234
- `forecast_runs`: 0
- `raw_material_demand_observations`: 0

Audit implication:

- backup appears broadly representative of the inspected live DB state for these areas
- forecasting storage exists structurally but is not yet materially populated

## 13. Database Integrity Signals

Read-only integrity checks found:

- `products_without_variants = 0`
- `variants_missing_summary = 5`
- `variants_without_recipe_items = 33`
- `product_variant_stockout_events = 0`
- `raw_material_stockout_events = 3`
- no tested orphan references in key joins

Interpretation:

- core FK integrity appears healthy in inspected joins
- some variants intentionally or historically exist without recipe items
- some variants do not currently have availability summary rows, which is a consistency gap if sellability state is expected for every variant

## 14. What Is Clearly Working and Reusable

These areas look real, reusable, and worth preserving:

### 14.1 Catalog foundation

- categories/products/variants/modifier structures exist
- public/POS catalog read paths exist
- admin product-management service already exists

### 14.2 Operational order-to-inventory coupling

- checkout consumes recipe ingredients through backend logic
- inventory movements are ledger-backed
- COGS is computed and stored
- reverse flows exist for void/refund paths

### 14.3 Availability architecture

- current-state summary model exists
- transition-history model exists
- blocking reasons are explicit

### 14.4 Reporting-history foundation

- stockout event history exists
- variant availability history exists
- daily inventory snapshots exist

### 14.5 Forecasting foundation direction

- daily demand observation service exists in source
- forecast storage tables exist in schema/live DB
- the architecture direction is additive, not destructive

## 15. What Is Partial or Inconsistent

### 15.1 Product archive/restore rollout

Status: partially implemented in source, not safely backed by live DB

Evidence:

- archive/restore endpoints and service logic exist
- Prisma schema and migration folder include archive columns
- live DB and backup do not have those columns

### 15.2 Forecasting rollout

Status: schema/source foundation exists, data population is largely not active yet

Evidence:

- forecasting tables exist in schema/live DB
- raw material demand observation service exists
- live DB row counts for demand observations and forecast runs were zero

### 15.3 Availability summary completeness

Status: mostly implemented, but current data is not fully synchronized

Evidence:

- 90 variants exist
- 85 availability summary rows exist

### 15.4 Reporting surface normalization

Status: mixed-generation state

Evidence:

- newer history foundations exist
- reports module still contains broader legacy report logic

### 15.5 Migration discipline

Status: inconsistent

Evidence:

- live DB structure includes tables not reflected in `_prisma_migrations`
- source migration folder includes later migrations not present in live migration history

## 16. What Should Be Preserved in Any Redesign

Any redesign should preserve these architectural strengths:

1. backend-authoritative recipe consumption
2. append-only inventory ledger history
3. order-item linkage to inventory deductions
4. current-state availability summaries
5. event-based availability/stockout history
6. Manila business-date helper strategy
7. delete/archive protections that respect historical records

These are the parts that make the system operationally honest.

## 17. What Should Be Reworked or Tightened

### 17.1 Single source of truth alignment

Top priority is aligning:

- backend source expectations
- Prisma schema
- Prisma migration history
- live DB structure
- checked-in backup assumptions

Until that is clean, product/admin work remains risky.

### 17.2 Product lifecycle model

Archive/restore should remain the preferred soft-lifecycle mechanism, but only after the DB actually supports it everywhere the source assumes it.

### 17.3 Availability consistency

Every active variant should have a maintained summary row if the rest of the stack expects current sellability state.

### 17.4 Report layer boundaries

Reports should keep using backend-authoritative operational data, but the report layer should eventually be cleaned so newer product/inventory-history features are not buried inside older mixed report structures.

### 17.5 Forecasting execution maturity

The forecasting foundation exists structurally, but the data pipeline is not yet materially populated in the live DB snapshot inspected here.

## 18. Safest Redesign and Implementation Order

This is the recommended order based on the current state, not a speculative rewrite.

### Phase A. Lock reality before changing behavior

1. document the connected DB as the current operational baseline
2. confirm which environment the backend actually runs against
3. confirm whether the connected DB is the same DB used by the active app
4. decide whether the checked-in backup is the authoritative recovery artifact

Reason:

- source and DB are demonstrably out of sync today

### Phase B. Repair migration and schema truth

1. reconcile `_prisma_migrations` with actual live schema
2. decide whether forecasting tables were manually applied or imported from another DB state
3. safely roll out the missing product archive migration to the real database
4. validate indexes expected by current code

Reason:

- product archive logic cannot be trusted end-to-end until DB structure matches source

### Phase C. Rebuild consistency utilities, not features

1. verify all variants have availability summaries
2. verify summary refresh routines can backfill missing rows safely
3. verify daily demand observation jobs are actually running and writing rows

Reason:

- this hardens the existing architecture without changing product behavior

### Phase D. Tighten product-management contract

1. re-audit all admin product endpoints after DB alignment
2. verify archive/restore/delete-eligibility flows end-to-end
3. verify ingredient usage endpoints against real order/ledger data

Reason:

- these appear to be the newest product-management features and are most exposed to schema drift

### Phase E. Only then do redesign/expansion work

After the above is complete, any further redesign can focus on:

- cleaner product admin UX
- stronger product reporting
- forecasting activation
- deeper modifier/recipe behavior

## 19. Recommended Product-Domain Design Direction

This is not a rewrite proposal. It is the cleanest direction consistent with the existing code.

### 19.1 Keep the domain split

The current split is sensible:

- catalog browsing
- admin product management
- availability calculation
- order consumption
- inventory ledger
- history capture

Do not collapse these into one mega-service.

### 19.2 Keep product availability as derived state

Current design derives sellability from:

- product enablement
- variant enablement
- recipe viability
- raw-material sufficiency
- modifier viability

That is the correct direction. Do not replace it with frontend-computed heuristics.

### 19.3 Prefer archive over delete

The current delete-eligibility protections are a good sign. Historical references from:

- orders
- ledger lines
- availability events
- stockout events

mean product lifecycle should remain archive-first, delete-exceptional.

### 19.4 Keep usage analytics tied to ledger history

Ingredient usage endpoints built from `inventory_transaction_lines` are more trustworthy than query logic built from recipe assumptions alone.

## 20. Risks and Constraints

### High risk

- backend source using archive fields that do not exist in live DB
- migration history not matching actual DB structure
- forecasting tables existing without recorded Prisma migration history

### Medium risk

- missing availability summary rows for some variants
- report-layer legacy surface obscuring newer authoritative data paths
- low automated test coverage

### Lower risk but still important

- backup filename mismatch against request wording may cause confusion
- forecasting/data-history jobs may exist but not be active in deployed runtime conditions

## 21. Most Relevant Files and Modules

### Product/catalog

- [`ims-backend/src/catalog/catalog.module.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/catalog/catalog.module.ts)
- [`ims-backend/src/catalog/catalog.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/catalog/catalog.service.ts)
- [`ims-backend/src/catalog/admin-products.controller.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/catalog/admin-products.controller.ts)
- [`ims-backend/src/catalog/product-management.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/catalog/product-management.service.ts)

### Availability and stock state

- [`ims-backend/src/availability/availability.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/availability/availability.service.ts)
- [`ims-backend/src/availability/inventory-state-history.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/availability/inventory-state-history.service.ts)

### Orders and inventory coupling

- [`ims-backend/src/orders/orders.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/orders/orders.service.ts)
- [`ims-backend/src/inventory/inventory-ledger.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/inventory/inventory-ledger.service.ts)
- [`ims-backend/src/inventory/inventory.module.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/inventory/inventory.module.ts)

### Reporting/history/forecasting

- [`ims-backend/src/reports/reports.module.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/reports/reports.module.ts)
- [`ims-backend/src/reports/reports.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/reports/reports.service.ts)
- [`ims-backend/src/inventory/inventory-daily-snapshot.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/inventory/inventory-daily-snapshot.service.ts)
- [`ims-backend/src/forecasting/forecasting.module.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/forecasting/forecasting.module.ts)
- [`ims-backend/src/forecasting/raw-material-demand-observation.service.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/forecasting/raw-material-demand-observation.service.ts)

### Prisma and database state

- [`ims-backend/prisma/schema.prisma`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/prisma/schema.prisma)
- [`ims-backend/prisma/migrations/20260404093228_reporting_foundation_history/migration.sql`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/prisma/migrations/20260404093228_reporting_foundation_history/migration.sql)
- [`ims-backend/prisma/migrations/20260416233000_forecasting_foundation/migration.sql`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/prisma/migrations/20260416233000_forecasting_foundation/migration.sql)
- [`ims-backend/prisma/migrations/20260726150000_product_management_archive_and_usage_indexes/migration.sql`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/prisma/migrations/20260726150000_product_management_archive_and_usage_indexes/migration.sql)
- [`ims-backend/ims_db_backup.sql`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/ims_db_backup.sql)

### Shared date strategy

- [`ims-backend/src/common/utils/manila-business-date.util.ts`](/C:/Users/Deej/Desktop/capstoneIMS/inventory-management-system/ims-backend/src/common/utils/manila-business-date.util.ts)

## 22. Direct Answers to the Core Audit Questions

### What already exists and is working?

Verified:

- catalog/product/variant backend
- POS menu composition
- recipe-based inventory deduction
- order-linked ledger history
- availability summary calculation
- availability event capture
- raw-material stockout capture
- daily inventory snapshots
- forecasting schema foundation tables

### What is partially implemented?

Verified:

- product archive/restore flow in source, but DB support missing in connected DB
- forecasting pipeline foundation exists, but live data population appears minimal/empty
- availability summary state is not complete for all variants

### What is still missing?

Most important missing items:

- DB alignment with source for product archive fields
- migration-history repair/normalization
- stronger consistency jobs/verification for summary rows and demand observation rows
- meaningful automated backend coverage around product lifecycle and reporting-history behavior

### What looks like it was added later?

Clear later-phase additions:

- stockout event history
- variant availability event history
- inventory daily snapshots
- forecasting tables and daily demand observation service
- product archive/delete-eligibility and ingredient-usage admin flows

### What appears to have been reworked after planning changed?

Most visible signs:

- reports/history architecture expanded after earlier core inventory/order phases
- forecasting foundation was added after the initial core schema phases
- product-management archive/usage work appears newer than the connected DB rollout
- reports module still contains legacy/mixed patterns alongside newer history-aware foundations

## 23. Final Recommendation

The backend does **not** need a fresh rebuild.

The system already has a strong operational spine. The right move is:

1. align source, Prisma, migrations, and live DB
2. validate product lifecycle flows against that aligned schema
3. repair consistency gaps in summaries/history jobs
4. only then expand or redesign higher-level product/reporting features

That path preserves the real work already done and reduces the risk of breaking the most trustworthy parts of the system.

## 24. Assumptions and Unknowns

Verified unknowns that should be confirmed before implementation:

- whether the connected DB inspected here is exactly the same DB used by the actively running backend in all environments
- whether forecasting tables were applied manually, via SQL restore, or via a different migration workflow
- whether missing availability summary rows are operationally expected or an unfinished backfill issue
- whether the requested backup filename `ims_db_backup(1).sql` refers to a file outside the repo, because the repo currently contains `ims_db_backup.sql`

Where this document infers process history, those conclusions are based on:

- migration names/order
- source module layering
- schema/live DB drift patterns
- presence of later-phase history/forecasting tables and services
