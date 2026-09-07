# Full Database and Products Planning Report

## 1. Executive Summary

The system is a moderately mature café inventory/POS platform with a strong operational core and a newer layer of reporting-history and forecasting-foundation work on top. The connected database is **not fully aligned** with the current Prisma schema or migration source. The biggest product-management strength is that real backend and frontend product workflows already exist for product CRUD, variants, recipes, manual availability, ingredient usage, archive/restore flows, and guarded delete checks. The biggest gaps are schema drift, incomplete product archive rollout in the live database, thin product lifecycle auditability, and weak historical order-to-ledger/payment coverage for analytics-grade product reporting.

The most important immediate conclusion is this: **the Products section can continue to evolve, but migration drift should be treated as a P0 blocker before relying on archive/restore and deeper product analytics in runtime testing.**

## 2. Environment Classification

- Classification: **Local development**
- Confidence: **High**
- Basis:
  - Prisma is connected to a localhost PostgreSQL instance.
  - Seed logic includes local/demo bootstrap users.
  - The database contains mixed imported/demo-style operational data and partially applied schema history.
- Caveat:
  - I did **not** assume development until evidence supported it.
  - Even as local development, the database should be treated carefully because it contains meaningful operational relationships and drifted history state.

## 3. Prisma and Migration Status

### Prisma validation

- `npx prisma validate`: **passed**

### Migration status

- Migration folders present in source: **9**
- Applied in `_prisma_migrations`: **7**
- Reported unapplied by Prisma:
  - `20260416233000_forecasting_foundation`
  - `20260726150000_product_management_archive_and_usage_indexes`

### Important observation

The forecasting tables from `20260416233000_forecasting_foundation` **do exist in the actual database**, but the migration is **not recorded as applied** in `_prisma_migrations`. That implies manual SQL application, partial migration history loss, or database state assembled outside normal Prisma migration tracking.

By contrast, the product archive migration is both:

- present in source
- absent from `_prisma_migrations`
- **not fully present in the actual database**

This is the most important current schema drift affecting Product Management.

## 4. Complete Database Model Inventory

| Model | Business Purpose | Primary Key | Important Fields | Relations | Status Fields | Referenced By | Product Relevance | Concerns |
|---|---|---|---|---|---|---|---|---|
| `User` | identity, auth actor, ownership | `id` | `email`, `username`, `role`, `isActive` | sessions, orders, stock runs, archive actor | `role`, `isActive`, lock fields | auth, orders, stock runs, products | medium | actual DB missing archive FK usage on products |
| `AuthSession` | session persistence | `id` | `sessionToken`, `expiresAt`, `revokedAt` | user | revoked/expiry | auth middleware | low | operational only |
| `PasswordResetToken` | password recovery | `id` | token, expiry, usedAt | user | used/expired | auth | none | low |
| `EmailVerificationToken` | email verification | `id` | token, expiry, usedAt | user | used/expired | auth | none | low |
| `Category` | product grouping | `id` | `name`, `parentId` | products, self-parent | none | product list, catalog | high | hierarchy quality should be validated more deeply later |
| `Product` | menu/catalog parent entity | `id` | `categoryId`, `name`, `isEnabled`, `archivedAt`, `archivedById`, `archiveReason` in Prisma | category, variants, modifier assignments, archivedBy | `isEnabled`, `archivedAt` | catalog, POS, availability, reports | critical | actual DB missing archive columns/FK |
| `ProductVariant` | sellable SKU/price node | `id` | `productId`, `name`, `sku`, `price`, `isEnabled` | product, recipe items, availability, order items, ledger | `isEnabled` | POS, orders, availability, reports | critical | 5 variants lack availability summaries |
| `ModifierGroup` | option group definition | `id` | `name`, `selectionMode`, min/max defaults | modifiers, product assignments | none | POS/catalog | high | structurally sound |
| `Modifier` | selectable add-on | `id` | `modifierGroupId`, `name`, `priceAdjustment`, `isActive` | modifier group, recipe adjustments, order item modifiers | `isActive` | POS/catalog | high | no recipe adjustments currently populated |
| `ProductModifierGroup` | assigns modifier groups to products | `id` | selection overrides, required flags | product, modifier group | required/quantity rules | POS/catalog | high | good config layer |
| `Unit` | measurement normalization | `id` | `code`, `name`, `dimension`, `conversionFactor` | raw materials | dimension | recipes, inventory | medium | solid foundation |
| `RawMaterial` | inventory ingredient master | `id` | `name`, `sku`, `unitId`, `isActive` | unit, recipes, inventory, forecasting | `isActive` | inventory, availability, reports | critical | 4 materials missing summaries |
| `Supplier` | procurement/vendor master | `id` | `name`, location/contact | stock batches, forecast policy | none | stock runs, forecasting | medium | adequate for current scope |
| `VariantRecipeItem` | base recipe bill of materials | `id` | `productVariantId`, `rawMaterialId`, `quantity` | variant, raw material | none | availability, checkout usage | critical | 33 variants lack recipes |
| `ModifierRecipeAdjustment` | material deltas from modifiers | `id` | `modifierId`, `rawMaterialId`, `quantityDelta` | modifier, raw material | none | modifier-aware availability/usage | high | table exists but row count is 0 |
| `StockRun` | receiving/procurement header | `id` | `name`, `status`, `totalCost`, `postedAt` | items, creator | `status` | inventory | medium | implemented |
| `StockRunItem` | received line items | `id` | material, qty, cost, expiry | stock run, raw material, batches | none | inventory | medium | implemented |
| `StockBatch` | batch-level stock ledger store | `id` | material, qty, remaining, cost, expiry, supplier | raw material, supplier, stock run item, ledger lines | none | inventory, availability | critical | actual DB has no `status` column, unlike some assumptions in code/history |
| `InventoryTransaction` | inventory ledger header | `id` | `type`, `sourceType`, `sourceId`, `occurredAt`, actor | lines, user | `type`, `sourceType` | inventory, orders, waste, reports | critical | only 10 checkout headers for 25 completed orders |
| `InventoryTransactionLine` | inventory ledger line | `id` | material, batch, qty delta, cost delta, variant, order item | header, material, batch, order item, variant | implicit via header | reports, analytics | critical | live DB missing intended product-variant index |
| `RawMaterialInventorySummary` | current inventory aggregate | `rawMaterialId` | on-hand, usable, expiry, batch count | raw material | none | inventory UI, availability | critical | 4 raw materials missing summaries |
| `StockoutEvent` | stockout history | `id` | entity type, start/end, reason | material or variant | open/closed by `endedAt` | reports/history | high | sparse but real |
| `VariantAvailabilityEvent` | sellability history | `id` | variant, previous/new sellable, reason, occurredAt | variant | previous/new state | reports/history | high | sparse but real |
| `InventoryDailySnapshot` | daily inventory history | `id` | date, material, quantities, value | raw material | none | reporting, turnover | high | populated and usable |
| `RawMaterialDemandObservation` | daily demand observation | `id` | business date, consumed qty/cost, counts | raw material | none | forecasting | medium | schema present, zero data |
| `ForecastRun` | forecast job header | `id` | run type, dates, method metadata | outputs, evaluations | run type | forecasting | medium | schema present, zero data |
| `RawMaterialForecastOutput` | forecast results | `id` | 7/30/90 demand, runway, risk, confidence | run, raw material | risk classification | forecasting | medium | schema present, zero data |
| `ForecastEvaluation` | prediction-vs-actual accuracy | `id` | predicted, actual, error | run, output, material | none | forecasting | medium | schema present, zero data |
| `RawMaterialForecastPolicy` | minimal procurement policy | `rawMaterialId` | lead time, reorder min, preferred supplier | material, supplier | none | forecasting | low | schema present, zero data |
| `VariantAvailabilitySummary` | current availability snapshot | `productVariantId` | in-stock, sellable, available qty, blocking reason | variant | `isInStock`, `isSellable`, `blockingReason` | POS, catalog, products | critical | 5 variants missing rows |
| `Order` | POS transaction header | `id` | status, totals, COGS, completedAt | items, payments, reversals, creator | `status` | POS, reports | critical | 9 completed orders lack payments; 9 completed orders have zero COGS |
| `OrderItem` | POS line item | `id` | variant, qty, price snapshots, COGS snapshots | order, variant, modifiers, ledger lines | none | reports, product usage | critical | 22 order items have zero line COGS |
| `OrderItemModifier` | selected add-ons | `id` | order item, modifier, snapshots, pricing | order item, modifier | none | POS, analytics | medium | structurally good |
| `OrderPayment` | payment row | `id` | method, amount, receivedAt | order | method | POS, reports | medium | fewer rows than completed orders |
| `OrderReversal` | void/refund reversal header | `id` | order, type, reason, occurredAt | order | reversal type | inventory/order correction flows | high | present and linked for voided/refunded orders |
| `Alert` | operational/admin alerts | `id` | type, severity, state, payload | optional material/variant | `state` | admin/reporting | medium | not core to products |
| `OutboxEvent` | integration/event delivery | `id` | aggregate, event type, payload, status | none | `status` | async/event flows | low | supports event-driven architecture |

## 5. Product-Centric Relationship Map

### Core catalog chain

- `Category` -> `Product`
  - Cardinality: one-to-many
  - Required: `Product.categoryId` required
  - On delete: `RESTRICT`
  - Backend usage: yes, admin products and public catalog
  - Frontend usage: yes, admin products filters and product creation
  - Products UI should expose: category membership and category filtering

- `Product` -> `ProductVariant`
  - Cardinality: one-to-many
  - Required: `ProductVariant.productId` required
  - On delete: `RESTRICT`
  - Historical importance: high, because variants anchor sales and ledger history
  - Backend usage: yes
  - Frontend usage: yes
  - Products UI should expose: full variant management, but permanent delete must remain blocked when history exists

- `ProductVariant` -> `VariantRecipeItem` -> `RawMaterial` -> `Unit`
  - Cardinality: variant one-to-many recipe items; material one-to-many recipe usage
  - Required: both FKs required
  - On delete:
    - variant -> recipe items: `CASCADE`
    - raw material -> recipe items: `RESTRICT`
  - Historical importance: high for availability and ingredient usage
  - Backend usage: availability, product recipe editor, reports
  - Frontend usage: recipe editor and ingredient usage views
  - Products UI should expose: recipe completeness, ingredient counts, per-variant recipe detail

### Modifier chain

- `Product` -> `ProductModifierGroup` -> `ModifierGroup` -> `Modifier` -> `ModifierRecipeAdjustment` -> `RawMaterial`
  - Product-to-group assignment is one-to-many
  - Group-to-modifier is one-to-many
  - Modifier-to-adjustment is one-to-many
  - On delete:
    - `ProductModifierGroup.productId`: `RESTRICT`
    - `ModifierRecipeAdjustment.modifierId`: `CASCADE`
    - `ModifierRecipeAdjustment.rawMaterialId`: `RESTRICT`
  - Historical importance: medium-to-high
  - Backend usage: public catalog reads modifier config; ingredient count logic accounts for positive modifier adjustments
  - Frontend usage: not surfaced in the current admin product page
  - Product UI should expose: at least read-only modifier group assignment and modifier ingredient implications
  - Concern: adjustment table has zero rows, so modifier-driven ingredient usage is structurally supported but not operationally populated

### Availability chain

- `ProductVariant` -> `VariantAvailabilitySummary`
  - Cardinality: expected one-to-one
  - Required logically, not enforced by complete data
  - On delete: `CASCADE`
  - Backend usage: POS/menu availability, product effective status
  - Frontend usage: product list/detail, POS
  - Concern: 5 variants currently have no summary row

- `ProductVariant` -> `VariantAvailabilityEvent`
  - Cardinality: one-to-many history
  - On delete: `CASCADE`
  - Historical importance: high for availability-over-time
  - Backend usage: reporting foundation/history
  - Frontend usage: not currently visible in products UI

- `ProductVariant` / `RawMaterial` -> `StockoutEvent`
  - Cardinality: one-to-many history
  - On delete: `SET NULL`
  - Historical importance: high
  - Backend usage: retained for reports/readiness
  - Frontend usage: not currently surfaced in products UI

### Orders and usage chain

- `ProductVariant` -> `OrderItem` -> `Order` -> `OrderPayment` / `OrderReversal`
  - Historical importance: very high
  - On delete:
    - variant -> order items: `RESTRICT`
  - Backend usage: product ingredient usage and order-based reporting
  - Frontend usage: ingredient usage views in admin products, POS history elsewhere
  - Concern: sales history exists, but payment and checkout-ledger completeness is not strong enough yet for high-trust product profitability reporting

- `ProductVariant` -> `InventoryTransactionLine` -> `InventoryTransaction` -> `StockBatch` / `RawMaterial`
  - Historical importance: critical for actual ingredient consumption
  - On delete:
    - variant -> ledger lines: `SET NULL`
    - order item -> ledger lines: `SET NULL`
    - stock batch -> ledger lines: nullable reference
  - Backend usage: ingredient usage reports rely on these joins
  - Frontend usage: admin product ingredient usage
  - Concern: only 10 checkout ledger headers exist for 25 completed orders

## 6. Actual Database Alignment and Drift

| Database Object | Prisma | Migration | Actual DB | Drift | Severity | Required Action |
|---|---|---|---|---|---|---|
| `products.archived_at` | present | present in `20260726150000...` | **missing** | schema and runtime mismatch | critical | apply/fix archive migration in controlled way |
| `products.archived_by_id` | present | present | **missing** | schema and runtime mismatch | critical | same as above |
| `products.archive_reason` | present | present | **missing** | schema and runtime mismatch | critical | same as above |
| `products_archived_at_idx` | expected | present | **missing** | index drift | medium | add when migration is properly applied |
| `products_category_id_archived_at_idx` | expected | present | **missing** | index drift | medium | add with migration |
| `products_archived_by_id_fkey` | expected | present | **missing** | FK drift | high | add with migration |
| `inventory_transaction_lines_product_variant_id_idx` | expected | present | **missing** | performance drift | medium | add with migration |
| forecasting tables | present | present in `20260416233000...` | **present** | migration history drift, not schema absence | high | reconcile migration history before future migrations |
| forecasting enums | present | present | present | aligned structurally | low | none |
| `variant_availability_summaries` shape | present | present | present | aligned | low | none |
| `stockout_events` shape | present | present | present | aligned | low | none |
| `inventory_daily_snapshots` shape | present | present | present | aligned | low | none |
| `_prisma_migrations` rows for forecasting migration | expected | source folder exists | **missing row** | migration bookkeeping drift | high | audit how forecasting tables were created |
| `_prisma_migrations` rows for product archive migration | expected | source folder exists | **missing row** | unapplied migration | critical | resolve before product archive runtime usage |

### Drift summary

- Prisma schema and source migrations are **ahead of the actual database** for product archive support.
- The actual database is **ahead of `_prisma_migrations` tracking** for forecasting support.
- This combination means future Prisma migration work is at elevated risk unless migration history is reconciled first.

## 7. Database Row and Status Counts

| Entity | Total Rows | Active | Disabled | Archived | Invalid/Suspicious | Notes |
|---|---:|---:|---:|---:|---:|---|
| Categories | 16 |  |  |  |  | no immediate orphan signal |
| Products | 70 | 70 enabled | 0 | 0 in actual DB | 0 missing categories | archive feature not materially present in DB yet |
| Product variants | 90 | 62 enabled | 28 disabled |  | 5 missing availability summaries | 33 variants have no recipe |
| Modifier groups | 5 |  |  |  |  | present |
| Modifiers | 18 | 18 active | 0 |  |  | present |
| Variant recipe items | 139 |  |  |  | 0 invalid quantity | structurally clean |
| Modifier recipe adjustments | 0 |  |  |  |  | schema exists, no operational data |
| Raw materials | 67 | 66 active | 1 inactive |  | 4 missing summaries | inventory aggregate coverage incomplete |
| Suppliers | 7 |  |  |  |  | present |
| Stock batches | 29 |  |  |  | 0 negative qty | healthy on checked metric |
| Inventory transactions | 23 |  |  |  |  | 10 checkout, 5 stock run, 3 adjustment, 3 waste, 2 void |
| Inventory transaction lines | 25 |  |  |  |  | present |
| Raw material inventory summaries | 63 |  |  |  | 0 batch mismatch | 4 fewer than raw materials |
| Variant availability summaries | 85 |  |  |  | 5 missing variants | near-complete but not complete |
| Stockout events | 3 |  |  |  |  | sparse historical data |
| Variant availability events | 9 |  |  |  |  | sparse historical data |
| Inventory daily snapshots | 1167 |  |  |  |  | materially populated foundation |
| Orders | 27 | 25 completed | 2 void/refund |  | 9 completed without payments | also 9 completed with zero total COGS |
| Order items | 35 |  |  |  | 22 zero COGS lines | snapshots exist |
| Order payments | 23 |  |  |  |  | fewer than completed orders |
| Order reversals | 2 |  |  |  |  | present for void/refund cases checked |
| Alerts | 78 |  |  |  |  | not product-critical |
| Demand observations | 0 |  |  |  |  | forecasting observation layer not populated |
| Forecast runs | 0 |  |  |  |  | foundation only |
| Forecast outputs | 0 |  |  |  |  | foundation only |
| Forecast evaluations | 0 |  |  |  |  | foundation only |
| Forecast policies | 0 |  |  |  |  | foundation only |

### Product-specific counts

- Total products: **70**
- Active products: **70**
- Disabled products: **0**
- Archived products: **0** in actual DB
- Products without variants: **0**
- Products with one variant: **52**
- Products with multiple variants: **18**
- Products without any recipe coverage: **26**
- Products with partial recipe coverage: **0**
- Products with no sellable variants: **68**
- Products with stock-unavailable variants: **66**
- Products with modifiers: **28**
- Products with historical sales: **16**
- Products with no historical sales: **54**
- Products safe to delete: **54**
- Products blocked from delete: **16**

## 8. Data-Integrity Findings

| Check | Count | Sample IDs | Severity | Product-Section Impact | Recommendation |
|---|---:|---|---|---|---|
| Products referencing missing categories | 0 | not sampled | low | good | none |
| Variants without availability summaries | 5 | not sampled | high | product status and POS sellability can be incomplete | refresh/regenerate missing summaries |
| Variants without recipes | 33 | not sampled | medium | many products cannot be sellable and ingredient counts are incomplete | treat as incomplete configuration, not raw corruption |
| Recipe rows with zero/negative quantity | 0 | not sampled | low | recipe math trustworthy where present | none |
| Inactive materials used in recipes | 0 | not sampled | low | healthy | none |
| Sellable variants without recipe | 0 | not sampled | low | availability logic is guarding this case | none |
| Checkout lines missing `productVariantId` | 0 | not sampled | low | usage attribution okay on existing checkout lines | none |
| Checkout lines missing `orderItemId` | 0 | not sampled | low | usage attribution okay on existing checkout lines | none |
| Completed orders without payments | 9 | not sampled | high | revenue/payment analytics cannot be fully trusted | backfill or enforce payment creation consistency |
| Completed orders without checkout ledger records | 17 | not sampled | critical | ingredient usage and COGS cannot be trusted for all completed orders | audit order-finalization inventory flow immediately |
| Voided/refunded orders without reversal records | 0 | not sampled | low | reversal linkage for checked cases is present | none |
| Negative stock batches | 0 | not sampled | low | healthy | none |
| Inventory summaries mismatching stock batches | 0 | not sampled | low | current summary math is internally consistent for populated rows | none |
| Raw materials without inventory summaries | 4 | not sampled | medium | availability/inventory screens may be incomplete for some materials | ensure summary generation covers all active materials |
| Completed orders with zero `totalCogsAmount` | 9 | not sampled | high | product margin/COGS analytics weak | investigate whether checkout flow updates order COGS consistently |
| Order items with zero `lineCogsAmount` | 22 | not sampled | high | per-product profitability is not analytics-grade | same as above |
| Forecasting foundation tables with zero data | 5 tables effectively empty | not applicable | low now, medium later | schema exists but no forecasting capability yet | build observation/run population before UI claims |

### Overall integrity interpretation

- The **recipe and inventory summary math that exists is mostly internally consistent**.
- The main quality issue is **coverage**, not random corruption:
  - missing availability summaries for some variants
  - missing inventory summaries for some materials
  - missing checkout ledger/payment coverage for many completed orders
- This makes current product configuration management usable, but **analytics-grade product reporting is only partially trustworthy**.

## 9. Product Feature Capability Matrix

| Feature | Supported by Current Schema | Supported by Current Data | Backend Exists | Frontend Exists | Schema Change Needed | Notes |
|---|---|---|---|---|---|---|
| Product list | yes | yes | yes | yes | no | strong |
| Search | yes | yes | yes | yes | no | searches product, variant, SKU |
| Category filters | yes | yes | yes | yes | no | implemented |
| Active/disabled filters | yes | yes | partial | partial | no | schema supports; admin page currently uses archive/category/search prominently |
| Archived filters | source yes, actual DB no | no | yes in code | yes in UI | **DB alignment first** | blocked by live schema drift |
| Product details | yes | yes | yes | yes | no | strong |
| Product creation | yes | yes | yes | yes | no | implemented |
| Product editing | yes | yes | yes | yes | no | implemented |
| Variant management | yes | yes | yes | yes | no | implemented |
| SKU management | yes | yes | yes | yes | no | uniqueness checks exist |
| Price management | yes | yes | yes | yes | no | no price history |
| Recipe management | yes | partial | yes | yes | no | many variants still not configured |
| Modifier management | yes | partial | backend read path exists | not in product admin page | no immediate schema change | admin workspace lacks modifier editing UX |
| Product ingredient count | yes | partial | yes | yes | no | derived from base recipes + positive modifier adjustments |
| Variant ingredient count | yes | partial | yes | yes | no | recipe coverage gaps remain |
| Base ingredient count | yes | partial | yes | yes | no | reliable where recipe exists |
| Possible ingredient count incl. modifiers | yes | weak data | yes | not clearly surfaced | no | zero modifier adjustments means low operational value |
| Ingredient usage per order | yes | partial | yes | yes | no | depends on checkout ledger coverage |
| Ingredient usage per day | yes | partial | yes | yes | no | Manila business-date utilities are used |
| Ingredient usage for 7 days | yes | partial | yes | yes | no | same caveat |
| Ingredient usage for 30 days | yes | partial | yes | yes | no | same caveat |
| Gross, reversed, net usage | yes | partial | yes | yes | no | implemented in service |
| Product units sold | yes | yes | yes | partial | no | derivable from orders/order items |
| Product sales history | yes | yes | partial | not dedicated | no | order snapshots exist |
| Product revenue | yes | partial | not dedicated in product module | no | no | doable, but payment/order coverage caveat |
| Product COGS | yes | weak | partial | no | no | many orders/items have zero COGS |
| Product gross margin | schema yes | weak | no dedicated product endpoint | no | no schema, but data hardening first | should not be shipped yet |
| Product availability | yes | partial | yes | yes | no | missing 5 summaries |
| Partial variant availability | yes | partial | yes | yes | no | implemented |
| Manual availability | yes | yes | yes | yes | no | implemented |
| Archive and restore | source yes | **no in actual DB** | yes | yes | **DB fix needed** | not trustworthy until migration applied |
| Permanent delete eligibility | yes | yes | yes | yes | no | conservative but incomplete if archive layer missing |
| Product lifecycle history | weak | weak | no | no | yes | only created/updated, no full lifecycle log |
| Recipe version history | no | no | no | no | yes | needs schema |
| Price history | no | no | no | no | yes | needs schema |
| Product change audit trail | no meaningful full trail | no | no | no | yes | needs audit log model or generic audit layer |
| Product images | no | no | no | no | yes | optional enrichment |
| Product descriptions | no | no | no | no | yes | optional enrichment |
| Product tax settings | no | no | no | no | yes | depends on business need |
| Product preparation time | no | no | no | no | yes | optional |
| Product barcode support | no | no | no | no | yes | optional |
| Product tags | no | no | no | no | yes | optional |
| Product allergens | no | no | no | no | yes | optional |
| Product dietary labels | no | no | no | no | yes | optional |
| Product reorder relevance | partial through ingredient/material links | weak | no dedicated product endpoint | no | maybe later | better as inventory/forecast concern than product core field |
| Product popularity | yes | partial | not dedicated | no | no | derivable from order items |
| Product performance ranking | yes | weak-to-partial | not dedicated | no | no | blocked by COGS/payment/ledger coverage for richer metrics |

## 10. Missing Product Data

| Candidate Data | Business Value | Existing Alternative | Schema Change | Priority | Recommendation |
|---|---|---|---|---|---|
| Description | medium | none | yes | useful later | add only if admin/catalog UX needs richer merchandising |
| Image URL/media relation | medium | none | yes | useful later | optional P4 enrichment |
| Display order | medium | category+name sort only | yes | useful later | worthwhile if curated menu order matters |
| Tax category | low-to-medium | order-level totals only | yes | later | only if tax rules vary per product |
| Preparation time | low-to-medium | none | yes | later | operationally useful but not core now |
| Barcode | low | SKU exists | yes | later | not needed unless scanning workflow appears |
| Product code | low | SKU exists at variant level | probably no | not appropriate now | variant SKU likely enough |
| Tags | low | category partly substitutes | yes | later | optional enrichment only |
| Dietary labels | medium | none | yes | later | useful if customer-facing catalog expands |
| Allergen information | medium | recipe can imply, but not explicitly | yes | later | valuable if customer-facing POS/menu expands |
| Cost estimate | partial already derivable from recipes + material costs | recipe + stock costs | no immediate schema | needed later | can be derived after ledger/COGS hardening |
| Gross margin | derivable in theory | orders + COGS | no immediate schema | later | do not ship until COGS coverage is fixed |
| Target margin | medium | none | yes | later | only after actual gross margin is reliable |
| Recipe yield | medium | none | yes | later | useful for advanced costing |
| Portion size | medium | recipe quantity only | yes | later | optional |
| Recipe version | high for auditability | none | yes | future | justified once recipe editing is active in production-like use |
| Price history | high for auditability | none | yes | future | justified |
| Product audit history | high | none | yes | future | justified |
| Archive history | medium-high | one current archive state in source only | yes | future | useful after archive base layer is fixed |
| Availability override reason | medium | blocking reason exists for computed state, not manual override rationale | maybe | later | useful if manual disables need audit context |
| Product notes | low | none | yes | later | optional |
| Sales channel visibility | low-to-medium | isEnabled is too coarse | yes | later | useful if channels split |
| Featured status | low | none | yes | later | optional |
| Seasonal availability | low-to-medium | none | yes | later | only if seasonal menu management is real |
| Start/end availability dates | low-to-medium | archive/manual enable only | yes | later | only if scheduled catalog changes matter |

## 11. Product Analytics Opportunities

| Metric | Existing Data Source | Reliable Now? | Missing Data | Query Complexity | Product UI Recommendation |
|---|---|---|---|---|---|
| Units sold | `order_items` + `orders` | yes | none major | low | build now |
| Revenue | `order_items`, `orders` | partial | payment/order completion consistency | low-medium | build with caveat |
| COGS | `orders.total_cogs_amount`, `order_items.line_cogs_amount`, ledger | weak | many zero COGS rows | medium | do not present as authoritative yet |
| Gross margin | revenue + COGS | no | trustworthy COGS coverage | medium | defer |
| Ingredient consumption | checkout/reversal ledger lines | partial | 17 completed orders missing checkout ledger | medium | keep internal/admin with caveat |
| Waste contribution | waste ledger lines + recipe/material joins | partial | product attribution may be indirect | medium-high | later |
| Refund rate | orders + reversals | partial | enough base data exists | low | build later |
| Void rate | orders + reversals | partial | enough base data exists | low | build later |
| Availability rate | variant availability events | partial foundation only | event volume/history depth | medium | report module candidate, not product core first |
| Stockout frequency | stockout events | partial foundation only | sparse data | medium | later |
| Days unavailable | availability/stockout events | partial foundation only | sparse data | medium | later |
| Most-used ingredients | checkout ledger lines | partial | ledger coverage gaps | medium | build with caveat after coverage fix |
| Highest-cost ingredients | recipe/ledger cost deltas | partial | same ledger/COGS gaps | medium | later |
| Variant performance | orders, order items | yes for units/revenue, weak for margin | COGS coverage | medium | build units/revenue first |
| Modifier popularity | order item modifiers | yes | none major | low | build later |
| Product profitability | orders + COGS + usage | no | COGS/ledger coverage | high | defer |
| Recipe cost | recipe + stock batch cost proxies | partial | costing policy definition | medium-high | later |
| Price versus cost | variant price + recipe/COGS | weak | same cost reliability issue | medium | defer |
| Sales by day | orders/order items with completedAt | yes | none major | low | build now |
| Sales by hour | orders completedAt | yes | none major | low | build later if needed |
| Sales trends | orders/order items | yes | none major | medium | build now or next |
| Product demand observations | could be derived from ledger/orders | not yet canonical | no product-specific observation table | medium | raw-material forecasting foundation exists, product layer not needed yet |

### Trust boundary

- **Directly stored and trustworthy enough now**:
  - product/variant master data
  - recipes where present
  - order snapshots
  - current availability summaries where present
  - inventory daily snapshots
- **Reliably derivable with caveat**:
  - ingredient usage
  - product revenue
  - product popularity
- **Not currently trustworthy enough**:
  - product COGS
  - gross margin
  - profitability
  - archive lifecycle history

## 12. Product Lifecycle and Auditability

### Questions the current database can answer

- Who created the product? **No**
- When was it created? **Yes**
- Who last edited it? **No**
- When was it last edited? **Partially**, via `updatedAt`
- Who enabled or disabled it? **No**
- Why was it disabled? **No**
- Who archived it? **In source schema yes, in actual DB no**
- Why was it archived? **In source schema yes, in actual DB no**
- How many times was it archived/restored? **No**
- What was the previous recipe? **No**
- What was the previous price? **No**
- What changed before a specific sale? **No**

### Auditability assessment

Current product lifecycle visibility is **minimal**. The system has operational timestamps, current state, and some historical dependencies, but not true product change history.

### Recommended future models if product lifecycle becomes important

- `ProductAuditLog`: justified
- `ProductPriceHistory`: justified
- `RecipeVersion`: justified
- `ProductLifecycleEvent`: justified if the team wants event-style product state history
- Generic audit-event model: plausible if multiple admin modules need the same pattern

### Recommendation

Do **not** add lifecycle-history schema before fixing live archive drift and current operational correctness. Audit/history should be a later controlled phase, not a distraction from current correctness.

## 13. Foreign-Key and Delete Safety

| Parent | Child | On Delete | Historical Data Risk | Safe for Product Delete? | Recommendation |
|---|---|---|---|---|---|
| Category | Product | `RESTRICT` | high | no | keep restrictive |
| Product | ProductVariant | `RESTRICT` | very high | no | keep restrictive |
| Product | ProductModifierGroup | `RESTRICT` | low-medium | yes if deleting config-only product | current service deletes assignment rows explicitly |
| Product | archivedBy `User` | source intends `SET NULL` | medium | yes | not active in DB yet because FK absent |
| ProductVariant | VariantRecipeItem | `CASCADE` | low for config-only variants | yes if no protected history | acceptable |
| ProductVariant | OrderItem | `RESTRICT` | very high | no | correct |
| ProductVariant | InventoryTransactionLine | `SET NULL` | high | delete only if service blocks history cases | current delete-eligibility logic counts ledger history first |
| ProductVariant | VariantAvailabilitySummary | `CASCADE` | low | yes | acceptable |
| ProductVariant | VariantAvailabilityEvent | `CASCADE` | medium-high | current service blocks if events exist | mismatch between FK permissiveness and service safety is acceptable but should stay explicit |
| ProductVariant | StockoutEvent | `SET NULL` | medium-high | current service blocks if stockout history exists | acceptable |
| Modifier | ModifierRecipeAdjustment | `CASCADE` | low-medium | conditional | okay if modifiers are configuration-only |
| RawMaterial | recipe rows | `RESTRICT` | high | no | correct |
| RawMaterial | inventory history | mix of `RESTRICT`/`SET NULL`/`CASCADE` by table | very high | no | retain conservative behavior |

### Delete-safety assessment

- The **service-level product delete eligibility logic is meaningfully protective**.
- It checks blockers from:
  - historical orders
  - inventory ledger lines
  - availability events
  - stockout events
- That is good.
- However, permanent delete safety is only as good as the live schema and full usage coverage.
- Because archive fields are missing in actual DB, the intended safer “archive instead of delete” lifecycle is not yet dependable.

## 14. Index and Performance Findings

| Query/Feature | Existing Indexes | Gap | Expected Impact | Recommendation |
|---|---|---|---|---|
| Product list by category + enabled | `products_category_id_is_enabled_idx` | archive-aware index missing in actual DB | moderate when archive filter becomes real | apply archive migration |
| Product name uniqueness per category | unique `(category_id, name)` | none | good | keep |
| Product archived filtering | none in actual DB | missing `products_archived_at_idx` and `(category_id, archived_at)` | medium | add with migration |
| Variant list per product | `product_variants_product_id_is_enabled_idx` + unique `(product_id,name)` | good | low | keep |
| Variant SKU lookup | unique `product_variants_sku_key` | good | low | keep |
| Recipe lookup by variant | unique `(product_variant_id, raw_material_id)` | good | low | keep |
| Recipe lookup by material | `variant_recipe_items_raw_material_id_idx` | good | low | keep |
| Modifier adjustment by material | `modifier_recipe_adjustments_raw_material_id_idx` | no row volume yet | low | fine |
| Ingredient usage by variant from ledger | missing `inventory_transaction_lines_product_variant_id_idx` in actual DB | yes | medium-high for growing analytics queries | add migration/index |
| Ingredient usage by order item | `inventory_transaction_lines_order_item_id_idx` | good | low | keep |
| Ingredient usage by material/date | `inventory_transaction_lines_raw_material_id_created_at_idx` | partial because business queries usually join through header `occurredAt`/type | medium | consider future index strategy aligned with actual query patterns |
| Inventory transaction filtering by type/date | `inventory_transactions_type_occurred_at_idx` | good | low | keep |
| Inventory transaction joins by source | `inventory_transactions_source_type_source_id_idx` | good | low | keep |
| Order analytics by status/date | `orders_status_created_at_idx` | partial because business logic often wants `completedAt` | medium | future completedAt index may help analytics |
| Order item by product variant | `order_items_product_variant_id_idx` | good | low | keep |
| Forecast observation lookup | source indexes exist; actual tables present | zero data now | low | fine for now |

### Performance interpretation

- The product-management core is reasonably indexed.
- The most relevant live gap is the **missing `inventory_transaction_lines.product_variant_id` index** expected by the latest product-management migration.
- Product analytics should continue to be **database-aggregated**, not app-memory-heavy, especially for usage, revenue, and variant performance.

## 15. Recommended Products Section

### A. Product list

- Recommended columns:
  - product name
  - category
  - variant count
  - ingredient count
  - manual availability
  - effective availability status
  - top blocking reason
  - updated date
  - archive state once DB is aligned
- Recommended filters:
  - search
  - category
  - manual enabled/disabled
  - effective status
  - archive state
- Support status:
  - database: yes, except live archive drift
  - backend: mostly yes
  - frontend: largely yes

### B. Product details

- Recommended panels/tabs:
  - overview
  - variants
  - recipe
  - ingredient usage
  - availability status
  - lifecycle
- Missing work:
  - lifecycle/audit panel is not yet real
  - modifier assignment visibility is too thin

### C. Variants

- Recommended capabilities:
  - create
  - edit name/SKU/price
  - manual enable/disable
  - delete if no protected history
  - per-variant sellability state
- Support status:
  - database: yes
  - backend: yes
  - frontend: yes

### D. Recipes and ingredients

- Recommended behavior:
  - base recipe editor per variant
  - ingredient count on product and variant
  - warnings for variants with no recipe
  - warnings for inactive materials
  - later: modifier adjustment visibility
- Support status:
  - database: yes
  - backend: yes
  - frontend: partial

### E. Availability

- Recommended display:
  - manual product enable state
  - manual variant enable state
  - computed sellability
  - in-stock flag
  - available base quantity
  - blocking reason
- Missing work:
  - repair missing summary rows
  - optionally show availability history later

### F. Usage and sales

- Recommended now:
  - ingredient usage one day / 7 day / 30 day
  - per-order ingredient usage
  - units sold
  - sales trend basics
- Recommended later:
  - revenue by product
  - variant performance
  - modifier popularity
- Do not ship yet as authoritative:
  - gross margin
  - profitability
  - cost-heavy rankings

### G. Lifecycle

- Recommended now:
  - archive/restore after DB alignment
  - permanent delete eligibility warnings
- Recommended later:
  - price history
  - recipe versions
  - product audit events

### H. Audit and history

- Recommended now:
  - none beyond current timestamps and archive actor once migration is fixed
- Recommended future:
  - explicit audit/history tables

### I. Product data quality

- Recommended warnings:
  - no recipe
  - no sellable variants
  - missing availability summary
  - incomplete ingredient cost coverage
  - historical usage blocked by ledger incompleteness

## 16. Prioritized Database-Driven Roadmap

| Priority | Feature/Issue | Database Work | Backend Work | Frontend Work | Dependencies | Effort | Reason |
|---|---|---|---|---|---|---|---|
| P0 | Reconcile migration drift | audit/apply missing product archive migration; reconcile forecasting migration history | verify Prisma compatibility | none or minimal | controlled DB migration plan | M | prevents future schema breakage |
| P0 | Fix product archive schema in actual DB | add archive columns, FK, indexes | validate archive endpoints against live DB | small QA pass | migration reconciliation | S-M | archive/restore currently not trustworthy |
| P0 | Restore missing `inventory_transaction_lines.product_variant_id` index | add index | none | none | migration reconciliation | S | supports product usage analytics |
| P0 | Audit completed-order payment gaps | maybe data repair or stricter constraints/process | enforce payment creation consistency | optional admin warnings | order flow review | M | revenue trust issue |
| P0 | Audit completed-order checkout-ledger gaps | no new schema likely, maybe repair scripts later | fix order finalization / inventory deduction consistency | optional warnings | orders/inventory flow review | L | critical for ingredient usage trust |
| P1 | Finish current Product Management safely | none major | harden product CRUD validations and summary regeneration | refine admin product workspace | P0 drift fix | M | current product section is close |
| P1 | Add product quality warnings | none | expose warning counts/flags | show warnings in list/detail | summary + integrity checks | S-M | helps admin users complete setup |
| P1 | Expose modifier assignment visibility in product admin | none | add read/update endpoints as needed | add UI | existing schema | M | product configuration is incomplete without this |
| P1 | Ensure all variants/materials have current summary rows | none major | backfill/refresh jobs or admin action | optional status UI | availability/inventory services | S-M | removes current coverage gaps |
| P2 | Product units sold and revenue insights | none | add product analytics endpoints | add analytics panels | order integrity acceptable | M | existing data already supports this fairly well |
| P2 | Variant performance | none | aggregate order/item metrics | UI panels | same as above | M | useful next-level product insight |
| P2 | Modifier popularity | none | aggregate order item modifiers | UI panel | existing data | S-M | supported by current schema |
| P2 | Availability history insights | none | report over availability events/stockout events | UI cards/charts | enough historical volume | M | history foundation already exists |
| P3 | Product audit log | new tables | write audit events on product actions | history panel | P0/P1 stable product flows | M-L | lifecycle visibility |
| P3 | Price history | new table | write on price change | history panel | audit/history phase | M | needed for pricing traceability |
| P3 | Recipe versioning | new tables | write versions on recipe replace | comparison UI | audit/history phase | L | important if recipes change often |
| P4 | Description/media/catalog enrichment | new fields/models | CRUD support | UI display/editing | none major | S-M | optional, not correctness-critical |
| P4 | Allergens/dietary labels/tags | new fields/models | CRUD/filter support | UI | business decision | M | optional customer-facing enrichment |

## 17. Critical Blockers

1. **Actual database is not fully aligned with Prisma for product archive support.**
2. **Forecasting migration history is inconsistent with actual schema state.**
3. **17 completed orders lack checkout ledger records, weakening product usage trust.**
4. **9 completed orders lack payments, weakening product revenue/payment trust.**
5. **9 completed orders and 22 order items have zero COGS, blocking trustworthy product margin analytics.**
6. **5 variants lack availability summaries and 4 raw materials lack inventory summaries, indicating incomplete summary coverage.**

## 18. Final Verdict

### Direct answers

1. Is the entire database aligned with Prisma?
   - **No.**

2. Which migrations are unapplied?
   - `20260416233000_forecasting_foundation`
   - `20260726150000_product_management_archive_and_usage_indexes`

3. Is the database safe for Product Management runtime testing?
   - **Partially.** Basic product CRUD/recipes/variants can be evaluated, but archive/restore should not be trusted until schema drift is fixed.

4. Is current product data complete enough?
   - **For core product management, mostly yes. For analytics and lifecycle, no.**

5. Which products have incomplete configuration?
   - At least:
     - **26 products without recipe coverage**
     - **68 products with no sellable variants**
     - **66 products with stock-unavailable variants**

6. Which product records contain integrity problems?
   - The main issues are:
     - products whose variants lack availability summaries
     - products whose variants lack recipes
     - products depending on incomplete historical ledger/payment coverage

7. Can ingredient counts be trusted?
   - **Yes where recipes exist.** Not all products are fully configured, so trust is conditional on recipe coverage.

8. Can ingredient usage reports be trusted?
   - **Only partially.** Checkout line attribution is good for existing ledger rows, but too many completed orders lack checkout ledger headers.

9. Can archive and restore be trusted?
   - **No, not on the actual connected database right now.**

10. Is permanent deletion safe?
    - **Reasonably safe through service-level guards**, but it should remain secondary to archive once archive schema is fixed.

11. Which additional Product features can be built with existing data?
    - Units sold
    - Product revenue with caveat
    - Variant performance basics
    - Modifier popularity
    - Sales trends
    - Availability insights once event volume grows

12. Which Product features need schema changes?
    - Full lifecycle audit trail
    - Price history
    - Recipe versioning
    - Images
    - Descriptions
    - Tags/dietary/allergen fields
    - Rich archive history

13. What should the team implement next?
    - **P0 database alignment and order/ledger integrity hardening**, then P1 product-management completion and quality warnings.

14. What should not be implemented yet?
    - Gross margin/profitability dashboards
    - Full archive UX reliance
    - Lifecycle-history UI
    - Catalog enrichment fields with no current operational need

