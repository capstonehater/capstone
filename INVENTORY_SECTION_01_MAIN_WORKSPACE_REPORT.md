# Inventory Section 01 — Main Workspace Redesign

## Scope

Presentation redesign of `/admin/inventory`, followed by the requested complete removal of the Record Adjustment workflow and write endpoint. Existing Inventory data responsibilities and other handlers remain in place. Supplier, Products, Dashboard, Reports, Forecasting, POS, Prisma, database, and authentication were not changed.

## Files changed

- `ims-frontend/src/app/admin/inventory/page.tsx`
- `ims-frontend/src/components/admin/inventory/InventoryBusinessInsights.tsx`
- `ims-frontend/src/components/admin/inventory/InventorySummaryPanel.tsx`
- `ims-frontend/src/components/admin/inventory/MaterialDetailPanel.tsx`
- `ims-frontend/src/components/admin/inventory/RawMaterialModals.tsx`
- `ims-frontend/src/components/admin/inventory/StockRunModals.tsx`
- `ims-frontend/src/components/admin/inventory/WasteModal.tsx`
- `ims-frontend/src/components/admin/inventory/StockRunsPanel.tsx`
- `ims-frontend/src/lib/inventory.ts`
- `ims-frontend/src/lib/inventory-reason-options.ts`
- `ims-frontend/src/store/inventoryStore.ts`
- `ims-frontend/src/components/layout/shell-navigation.ts`
- `ims-frontend/src/app/admin/inventory/suppliers/page.tsx`
- `ims-frontend/src/components/admin/suppliers/SupplierWorkspace.tsx`
- `ims-backend/src/inventory/inventory.controller.ts`
- `ims-backend/src/inventory/inventory-actions.service.ts`
- Deleted `ims-frontend/src/components/admin/inventory/AdjustmentModal.tsx`
- Deleted `ims-backend/src/inventory/dto/create-inventory-adjustment.dto.ts`

## Components changed

- The Inventory route now has a compact page header, existing operational action buttons, live overview metrics, business insights, material master-detail workspace, and recent stock runs.
- `InventoryBusinessInsights` now presents high-value materials, waste, supplier spend, near-expiry batches, and low-stock materials in compact cards. Active Alerts is not duplicated here because it has its own page.
- `InventorySummaryPanel` retains its search, status/supplier filters, selection, refresh, and summary data while presenting a denser material table.
- `MaterialDetailPanel` retains the selected-material information, actions, batches, and transaction history. Its metric tiles show On Hand, Usable, Reorder Point, and Inventory Value.
- `StockRunsPanel` retains draft open/delete actions and posted-run history.

## Layout changes

- Uses a compact navy-to-blue gradient banner with the page heading, remaining operational actions, and live metrics.
- Overview metrics show Materials, In Stock, Low Stock Items, Out of Stock Items, and Inventory Value from the inventory health response. Values show an em dash until data loads.
- Moved active alerts into the Inventory Overview cards to avoid a separate duplicate section.
- Kept the material list and detail as a master-detail workspace, with the list narrower than the detail at wide desktop sizes and stacked layouts at smaller widths.
- The material list and detail workspace share an aligned 42rem desktop height: the material table fills and scrolls within the left panel, while the right detail panel scrolls vertically through its content. Smaller screens retain a stacked layout. Stock-run tables and insight table bodies use bounded scrolling; the page itself remains normally scrollable.
- Applied the requested #f5f5f5 page background, white panels, #232d46 primary controls/text, lime active indicators, and orange warning states with thin borders and minimal shadow.

## Data sources and behavior preserved

- Existing `fetchInventorySummary` search/filter request and selection behavior.
- Existing `fetchInventoryHealth`, `fetchStockRunSpend`, and `fetchWasteSummary` calls.
- Existing `fetchRawMaterial`, `fetchRawMaterialBatches`, and `fetchRawMaterialTransactions` detail requests.
- Existing create/edit/archive material, stock-run, waste, batch drilldown, and store-availability handlers and modals.
- Supplier management continues to navigate to the existing standalone Suppliers route.
- No placeholder inventory numbers were introduced. Missing report data is represented as unavailable/empty rather than fabricated counts or totals.

## Record Adjustment removal

- Removed the Record Adjustment banner action, detail-panel action, modal, frontend form state, submit callback, API wrapper, and adjustment-only reason options.
- Removed `POST /inventory/adjustments`, its controller DTO wiring, and the backend `createAdjustment` service method.
- Kept the Prisma transaction/source enum values and transaction-history filter/read display so existing adjustment ledger records remain readable. No schema or data migration was performed.

## Visual differences addressed

- Removed oversized gradient banner, large rounded/shadowed cards, redundant insight KPI row, duplicate alert area, locked tall panels, and the obsolete stock-run mock-only notice.
- Tightened panel padding, table density, status badges, headers, and action controls to match the compact admin reference.

## Backend changes

For the original presentation redesign: **NONE**. In the subsequent user-requested feature removal, the adjustment write route and service implementation were removed. No Prisma, database, or authentication changes were made.

## Sanity check

- Route/component structure and callback wiring were checked statically: material selection, filters, detail, batch drilldown, edit, waste, archive, stock-run draft actions, supplier navigation, and insight data calls remain connected. No adjustment create/write path remains.
- Targeted ESLint: **0 errors, 4 existing React-hook dependency warnings** in the Inventory route.
- Backend TypeScript check: passed after removing the adjustment service path.
- Frontend TypeScript check: reported no Inventory errors; the project check remains blocked by three `manualAvailability` type errors in `src/components/admin/products/ProductsWorkspace.tsx`, outside this task's scope.
- Backend unit tests: **11 suites, 52 tests passed**.
- `git diff --check`: passed.
- Browser rendering and formal workflow tests were not run; formal testing remains deferred as requested.
