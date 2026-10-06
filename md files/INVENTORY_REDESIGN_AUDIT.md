# Inventory Redesign Audit

**Audit date:** 17 September 2026  
**Scope:** Current Inventory frontend, relevant API client and Zustand state, design references in `design.zip`, and read-only backend contract/schema inspection to identify gaps.  
**Method:** Source/import tracing, component and state enumeration, design PDF text/dimension inspection, controller/DTO/schema inspection. No browser or live API session was used.

> **No implementation changes were made.** The only file created for this audit is this report. The worktree already contained the approved Supplier page changes and the earlier frontend redesign audit/report before this task; those files were not modified.

## 1. Current Inventory Architecture

Canonical Inventory route: `/admin/inventory`. It is an administrator page wrapped in `AdminDashboardLayout`, which supplies the application shell. The page is a long operational dashboard and stock workspace rather than a dedicated full-screen material editor.

At desktop widths, the main material workspace uses a two-column split: `InventorySummaryPanel` on the left and `MaterialDetailPanel` on the right. The page also places overview metrics, business-insight panels and alerts above this split, then recent Stock Runs below it. At smaller widths the grid stacks. The summary and detail panels have their own internal scrolling and fixed large-screen heights; the document itself also scrolls through the surrounding dashboard content.

Most workflow state and API orchestration currently live in the large `app/admin/inventory/page.tsx` client component. Dedicated child components render list, details, insights and modal forms, but the route owns loading/refresh functions, form state, mutation callbacks, selected material/batch/run state and report state.

The approved Supplier workflow is now separate at `/admin/inventory/suppliers`. The Inventory page loads suppliers for supplier selection on receiving/adjustment operations and navigates to the Suppliers route from its Manage Suppliers and supplier-journey entry points. It no longer owns or opens supplier management as a modal.

### Relevant Zustand stores

- `store/inventoryStore.ts` contains shared search text, status filter, selected supplier filter, selected raw-material ID, active Inventory modal key and transaction-history filters. The route’s fetched data, forms, batches, stock runs and report results remain local React state.
- `store/authStore.ts` supplies authenticated UI identity through the application shell; it does not hold Inventory business data.

## 2. Active Component Tree

```text
app/admin/inventory/page.tsx
└─ AdminDashboardLayout
   ├─ Inventory overview / action buttons / summary metric cards (inline JSX)
   ├─ InventoryBusinessInsights
   ├─ Active Alerts (inline JSX)
   ├─ desktop two-column material workspace
   │  ├─ InventorySummaryPanel
   │  │  ├─ search, status and supplier filters
   │  │  └─ scrollable material summary table
   │  └─ MaterialDetailPanel
   │     ├─ material status and actions
   │     ├─ metric tiles
   │     ├─ batch table
   │     └─ transaction history filters/table
   ├─ StockRunsPanel
   └─ active workflows, mounted conditionally
      ├─ RawMaterialModals (create, edit, archive)
      ├─ StockRunModals (create, manage, delete draft)
      ├─ AdjustmentModal
      ├─ WasteModal
      ├─ StoreAvailabilityModal
      └─ BatchTransactionModal
```

All components in `components/admin/inventory/` are imported by the active Inventory route or another active component. `InventoryField` is also shared by Products forms; `SupplierLocationPicker` is used in the separate approved Supplier page. `InventoryModal` is shared by multiple Inventory dialogs and by product variant/recipe dialogs.

### Legacy/unused component family

`src/components/inventory/` contains older `InventoryHeader`, `InventoryGrid`, `InventoryTable`, `AddItemModal`, `EditItemModal`, `DeleteItemModal`, `ViewItemModal`, `RestockItemModal` and `RecommendModal` components. A repository-wide TS/TSX symbol search found only their declarations and no consumers. They appear to be an unused legacy Inventory UI family, separate from the active `components/admin/inventory/` implementation. Confirm the import graph before deleting them; this audit does not remove them.

There are no active duplicate material list/detail implementations inside `components/admin/inventory/`. The structural duplication is between that active admin family and the apparently orphaned older `components/inventory/` family.

## 3. Existing Functionality Map

| Workflow | Current UI and state | Existing client/API support | Status / limit |
| --- | --- | --- | --- |
| Material create | “Add Raw Material” action opens `RawMaterialModals` create form. | `createRawMaterial` → `POST /raw-materials`. | Name, SKU, unit and reorder point. No notes/default supplier fields. |
| Material edit | Detail-panel Edit action opens edit form. | `updateRawMaterial` → `PATCH /raw-materials/:id`. | Updates name, SKU, unit and reorder point. No separate restore operation. |
| Archive material | Detail-panel Archive action opens confirmation. | `archiveRawMaterial` → `DELETE /raw-materials/:id` (soft archive/deactivate semantics). | This is archive, not permanent deletion. Current UI has no unarchive/restore action. |
| Search/filter | Summary table search, stock status and supplier filters. | `fetchInventorySummary` → `GET /inventory/summary` with search/status/supplierId; helper also supports `includeArchived`. | Table is scrollable; page does not expose a separate active/archive tab. Status includes Archived/INACTIVE. |
| Stock summary | Five overview cards and material row values/status. | Inventory summary and report clients. | List rows include material, SKU, unit, status, usable amount and inventory value. Detail adds on-hand, usable and reorder point. |
| Batches/expiry | Detail-panel batch table; near-expiry and high-level inventory health panels; batch click opens transaction drilldown. | `fetchRawMaterialBatches` → `GET /raw-materials/:id/batches`; inventory-health report returns near-expiry batches. | No standalone batch page or batch CRUD UI. Batch records are created as receiving/adjustment operations post. |
| Transactions | Detail-panel ledger table with type/date/search filters; batch drilldown dialog. | Raw-material and stock-batch transaction GET endpoints. | Reads source/type/reason/note/delta/cost/actor. No page navigation on individual ledger rows. |
| Stock Runs | Recent run table; create draft dialog; manage-draft dialog with add/remove item rows; post and delete-draft confirmation. | `createStockRun`, `addStockRunItem`, `deleteStockRunItem`, `deleteStockRun`, `postStockRun`; list/detail reads. | Supports draft creation, line addition/removal, posting and deletion before posting. Frontend has no `updateStockRun` helper even though backend exposes PATCH for draft name/notes. No edit-item endpoint is wired; editing a line is currently remove/re-add. |
| Adjustments | Adjustment dialog supports increase/decrease, selected material, reason/note; decrease selects a batch; increase accepts supplier, cost/unit, expiry and received-at values. | `createInventoryAdjustment` → `POST /inventory/adjustments`. | Existing contract supports the main increase/decrease operation. No separate reference field or projected-value summary input. |
| Waste | Waste dialog selects material, batch, quantity, reason and note. | `createInventoryWaste` → `POST /inventory/waste`. | Current form requires a batch in its API payload; reference depicts batch as optional. |
| Supplier workflow | Standalone `/admin/inventory/suppliers` page; supplier selector remains in Inventory receiving/adjustment forms. | Supplier clients and supplier route. | Supplier CRUD is outside the Inventory modal flow. |
| Store availability | Material detail action opens StoreAvailabilityModal; action journey navigates to Suppliers. | Store availability GET/POST API and result persistence. | Existing functionality is separate from core receiving/stock ledger. |
| Alerts and reports | Inventory health, stock-run spend, waste summary and active alert cards render on the page. | `fetchInventoryHealth`, `fetchStockRunSpend`, `fetchWasteSummary`, `fetchAlerts`. | Current insight cards are display panels; there are no “view all” links from those panels in the inspected component. |

## 4. Design Reference Map

Design files were read from `design.zip`. The main Inventory reference is a 1921×2956 PDF page. It includes the main workspace and embedded table/detail sections in one tall screen. Separate relevant files are listed below. There is no separately named Add Material PDF or Stock Run screen PDF in the archive.

| Reference | Design structure | Current equivalent | Gap and estimated effort |
| --- | --- | --- | --- |
| `INVENTORY.pdf` (main page) | Admin shell; low-stock/out-of-stock counters; inventory overview/action banner; five material metrics; high-value, waste, supplier-spend, near-expiry and low-stock insights; material summary list beside selected-material detail; recent Stock Runs. | The active route has the same broad content families: overview/actions, metrics, insights, alerts, summary/detail split and Recent Stock Runs. | Close in information architecture, though source composition/order, color treatment, wording and large fixed heights differ. Rebuilding page composition while retaining data flow is medium effort; pure spacing/color changes are low effort. |
| Material list/table (embedded in `INVENTORY.pdf`) | Search by material/SKU, status and supplier filters; table columns Material, Status, Usable, Value; selected row and refresh. | `InventorySummaryPanel` implements these filters and columns in a sticky-header, scrollable table. | Strong structural match. Main work is visual alignment and responsive sizing; low effort. |
| Material detail (embedded in `INVENTORY.pdf`) | Selected material header/actions; status and stock metrics; batch table with expiry/supplier/action; movement-history table and filters. | `MaterialDetailPanel` provides status, Store Availability/Edit/Adjustment/Waste/Archive actions, four metrics, batches and transaction history. | Strong functional match. Detail proportions and scroll areas should be revised only after a viewport target is set; low-to-medium effort. |
| `EDIT MODAL.pdf` (521×497) | Edit name, SKU, unit, supplier, reorder point, status and notes, with Save/Cancel. | `RawMaterialModals` edit form contains name, SKU, unit and reorder point. | Supplier, notes and status are not editable fields in current API/model. Visual form layout is low-to-medium effort; matching persisted data fields is backend work. |
| Add Material | No standalone Add Material PDF found. | Create form uses the same four supported fields as edit, opened from the overview button. | Use the current edit/create data contract as the source. A matching add modal can reuse the form; low effort. Any extra persistent fields need contract/schema work. |
| `ARCHIVE MODAL.pdf` (521×430) | Archive warning, summary and a “keep historical records visible” checkbox; unchecked behavior would hide history from reports. | Current archive confirmation warns and preserves existing batches/history; it calls the existing archive endpoint. | The checkbox has no corresponding request field or backend behavior. Matching the choice semantically would require backend/report-history policy changes; presenting it without behavior would be misleading. Keep archive as a confirmation modal unless the business policy changes. |
| Batch views (embedded in `INVENTORY.pdf`) | Batch rows with remaining quantity, expiry, supplier/cost/action; inspect movement history without leaving the main workspace. | Batch table is in `MaterialDetailPanel`; clicking a row opens `BatchTransactionModal` with batch balances and transactions. | Existing data is sufficient for a drawer/modal or inline detail. No separate reference for a batch detail page; low-to-medium effort. |
| Stock Runs (embedded in `INVENTORY.pdf`) | Recent run receipt/list with run name, status, items, cost, created time and action. Main copy says drafts reopen in a modal workspace. | `StockRunsPanel` has these fields and actions. Existing create/manage/delete dialogs perform receiving and posting. | The embedded reference supports keeping draft management modal-based. No separate stock-run page design was found. Styling is low effort; adding inline line editing requires API support. |
| `STOCK ADJUSTMENT MODAL.pdf` (521×639) | Adjustment type, quantity, unit cost, reason, reference, effective date, live adjustment summary, internal notes. | `AdjustmentModal` supports direction/material, quantity, reason/note, and increase-specific cost, supplier, expiry and received time. | Most workflow fields map. “Reference” is not in the DTO; an adjustment summary can be computed from loaded material/batch data. Persisting a reference requires an API/storage decision. Low-to-medium UI effort; backend change only for newly persisted fields/semantics. |
| `WASTE MODAL.pdf` (521×654) | Material, quantity/unit, reason, optional batch, computed cost impact, recorded-by identity, notes and warning. | `WasteModal` has material, batch, quantity, reason and note. Unit comes from selected material; actor comes from authenticated request; cost derives from batch data/ledger. | Most display fields can use existing data. Optional batch conflicts with the current required `batchId` contract; batchless waste would need backend allocation/validation changes. Otherwise low-to-medium UI effort. |
| `WASTE REASON MODAL.pdf` (508×665) | Waste breakdown by reason, cost, percentages/incidents and time filter. | `InventoryBusinessInsights` shows a top-five Waste Cost Watch using `WasteSummaryReport`; no dedicated interactive breakdown dialog or “view all” action exists there. | Existing report data covers summary display, but the reference’s full table/chart/period interaction needs inspection of the report payload limits. Likely frontend work if data already contains all rows; backend work only if aggregation/filter/detail is missing. Medium effort. |
| `NEAR EXPIRY MODAL.pdf` (831×411) | Searchable/filtered list with 7/14/30-day ranges, material, SKU, quantity, unit, expiry, supplier, status and View/Waste/Stock Run actions. | Current `InventoryBusinessInsights` shows the first five near-expiry batches as read-only cards. No dedicated watchlist dialog/page is mounted from Inventory. | Likely frontend drill-in using the health report and existing batch actions; verify whether report results can be filtered/paginated before committing. Medium effort. |

## 5. Old vs New Structure Comparison

| Concern | Current structure | Design direction | Audit reading |
| --- | --- | --- | --- |
| Overall route | Long dashboard plus material split workspace plus recent runs. | One tall operational page with overview, alerts, insights and a material workspace. | Keep one page. The reference is not a collection of unrelated pages. |
| Material selection | Search/filter table on the left, selected material details on the right. | Same list/detail relationship. | Yes, master-detail at the central material workspace level. Not a pure Products-style page because the overall Inventory route has dashboard sections and stock-run history around it. |
| Material detail | Inline pane with batches and history. | Inline detail with batch/history, no route transition. | Preserve the selection model and current reads. Refine presentation and scroll ownership. |
| Forms and transactions | Material CRUD/archive, adjustment, waste and stock-run operations are modals. | Reference explicitly supplies modal designs for material editing/archive, waste and adjustment. Main Inventory copy says draft runs reopen in a modal. | Keep short forms and confirmations as modal workflows. Use modal designs as visual guidance. |
| Complex receiving | Create modal followed by wide manage-draft modal with a line form and draft table. | No separate Stock Run screen PDF; main page supports modal drafts. | Do not turn this into a page solely because it is long. Consider a full-screen route only if staff workflow and list size require it. |
| Supplier management | Approved separate supplier page; Inventory keeps supplier selectors. | Sidebar Suppliers is a separate destination. | Keep the approved standalone supplier workflow. |

## 6. Recommended Redesign Order

1. **Inventory page composition:** establish the target page width/height and order of overview, alerts, insight panels, materials and stock runs. Keep existing page-level data loading/mutations working while refactoring presentation.
2. **Material workspace:** align the left table and right detail sizing, responsive stack, table scrolling, and selected-row behavior. Preserve list and detail APIs.
3. **Material forms and archive confirmation:** align create/edit/archive presentation to the available contract. Resolve whether supplier/notes are actually required data before treating the design-only fields as form inputs.
4. **Batch and history drilldown:** align row density and drilldown behavior; retain the existing ledger source and filters.
5. **Near-expiry and waste analytics drill-ins:** identify which actions should select a material and open existing operations and whether report data is sufficient for full lists.
6. **Stock Runs:** retain existing two-step draft flow unless a concrete full-screen reference is approved. If editing item rows inline is required, add explicit client/API support before UI implementation.
7. **Adjustment and waste dialogs:** apply the references after deciding the unsupported semantics (adjustment reference, optional batch for waste). Keep API-backed required fields visible and validate against current business rules.
8. **Legacy cleanup:** after the active redesign is verified, confirm no dynamic imports/tests/scripts depend on the old `src/components/inventory/` family, then remove it in a separate cleanup change.

## 7. Components to Keep

- `AdminDashboardLayout` and route authorization/shell.
- `InventorySummaryPanel` as the material list/filter/table responsibility.
- `MaterialDetailPanel` as selected-material detail, batch list and history responsibility.
- `InventoryBusinessInsights` and report data types/clients.
- `StockRunsPanel` and existing draft lifecycle calls.
- `RawMaterialModals`, `AdjustmentModal`, `WasteModal`, `StockRunModals`, `BatchTransactionModal` as workflow behavior boundaries; presentation may be changed while handlers and contracts are preserved.
- `InventoryField` and API clients in `lib/inventory.ts`.
- `store/inventoryStore.ts` as shared filter/selection state, unless a redesign deliberately makes a state local and verifies navigation behavior.
- Approved `SupplierWorkspace` and Supplier page; Inventory should link to it and continue using supplier IDs for receiving/adjustment.

## 8. Components to Replace or Investigate

| Component | Recommendation | Reason |
| --- | --- | --- |
| Inline page composition in `app/admin/inventory/page.tsx` | Recompose/refactor presentation, preserving data and mutation handlers. | It combines data orchestration, all dashboard sections and workflow wiring in one large component. |
| `InventorySummaryPanel` styling/layout | Restyle, keep responsibility. | Its search/filter/table already matches the reference information architecture. |
| `MaterialDetailPanel` styling/layout | Restyle, keep responsibility. | It already supplies metrics, batches and transaction history. |
| `InventoryModal` | Keep for genuine modal workflows; avoid using it for page layout. | Shared by remaining inventory dialogs and product recipe/variant dialogs. |
| `RawMaterialModals` | Replace presentation only if design calls for a different form shell; keep existing create/edit/archive handlers. | Existing API has a small, clear field set. |
| `StockRunModals` | Keep create/manage/delete behavior; decide modal vs route from an approved Stock Run design. | The existing reference itself describes drafts reopening in a modal; there is no standalone screen. |
| `src/components/inventory/*` legacy family | Investigate as likely unused; do not mix into redesign. | Repository-wide component-symbol search found declarations only and no consumers. |

## 9. API/Data Mapping

| UI data/action | Frontend helper | Existing backend route |
| --- | --- | --- |
| Filtered material list and summary | `fetchInventorySummary` | `GET /inventory/summary` |
| Unit choices | `fetchUnits` | `GET /units` |
| Supplier choices | `fetchSuppliers` | `GET /suppliers` |
| Material detail | `fetchRawMaterial` | `GET /raw-materials/:id` |
| Material batches | `fetchRawMaterialBatches` | `GET /raw-materials/:id/batches` |
| Material/batch history | `fetchRawMaterialTransactions`, `fetchStockBatchTransactions` | `GET /raw-materials/:id/transactions`, `GET /stock-batches/:id/transactions` |
| Create/update/archive material | `createRawMaterial`, `updateRawMaterial`, `archiveRawMaterial` | `POST /raw-materials`, `PATCH /raw-materials/:id`, `DELETE /raw-materials/:id` |
| Adjustment/waste | `createInventoryAdjustment`, `createInventoryWaste` | `POST /inventory/adjustments`, `POST /inventory/waste` |
| Stock-run list/details/create/items/delete/post | `fetchStockRuns`, `fetchStockRun`, `createStockRun`, `addStockRunItem`, `deleteStockRunItem`, `deleteStockRun`, `postStockRun` | `GET /stock-runs`, `GET /stock-runs/:id`, `POST /stock-runs`, `POST /stock-runs/:id/items`, `DELETE /stock-runs/:id/items/:itemId`, draft delete aliases, `POST /stock-runs/:id/post` |
| Inventory insight reports | report helpers in `lib/reports.ts` | report controller endpoints for inventory health, waste summary and stock-run spend |
| Store lookup/availability | store-availability helpers in Inventory client | `GET/POST /raw-materials/:id/store-availability` |

`StockRun` backend also exposes `PATCH /stock-runs/:id` for draft name/notes updates, but `lib/inventory.ts` has no `updateStockRun` client helper and the active manage dialog does not expose draft-header editing. No endpoint for updating an individual stock-run item was found.

## 10. Backend Changes Required (If Any)

**A visual rebuild of the existing design does not inherently require backend or database changes.** The main list, material detail, batches, history, archive, adjustment, waste and stock-run create/post flows already have APIs. Several design-only semantics do not map to current contracts:

| Design request/field | Current backend/data state | Backend work needed if required |
| --- | --- | --- |
| Material notes | `RawMaterial` schema and create/update DTOs have no notes field. | Add API field and persistent storage (likely schema migration) if notes must be saved. |
| Supplier on material record | `RawMaterial` has no default-supplier field/relation; supplier is associated with stock-run lines/batches and adjustments. | Add a field/relation and CRUD mapping if a persistent default supplier is required. |
| Material status in add/edit | Inventory stock status is derived from balances/reorder point; active/archive is a separate `isActive` state. DTOs do not accept arbitrary stock status. | No change for read-only derived status. Add policy/API only if an operator is meant to directly set a new status. |
| Restore archived material | Frontend/API expose archive but no restore helper/route; update DTO does not allow `isActive`. | Add restore behavior/route or explicitly decide archived records are permanent. |
| Hide historical records checkbox | Archive currently preserves linked history; no request flag or visibility-policy field exists. | Requires backend/report filtering and a defined audit/history-retention policy; the UI must not show a nonfunctional choice. |
| Waste batch optional | Current DTO/service require `batchId`; design marks it optional. | Add a supported allocation policy and API/service validation for batchless waste, if desired. |
| Adjustment reference | Current adjustment DTO includes direction/material/batch/quantity/reason/note/cost/supplier/expiry/received time, but not a separate reference. | Add contract and storage mapping if reference must be independently searchable/reportable; otherwise decide whether note is an acceptable existing mapping. |
| Stock-run line editing | Add/delete item APIs exist; no update-item route/service contract. | Add endpoint/service validation if the UI must edit a saved line rather than remove and re-add. No new table is necessarily needed because the fields are already stored. |
| Waste/expiry charts and watchlists | Existing inventory-health and waste-summary reports supply overview data. | No change if existing responses cover the complete requested list/filtering; inspect response limits before deciding. Add query/pagination support if they do not. |

These are conditional requirements from the reference, not recommendations to expand backend scope before the user confirms which fields/semantics are truly wanted. Do not create visual controls for unsupported behavior.

## 11. Important Questions — Answers

1. **Is Inventory currently master-detail like Products?** Partly. The central material section is master-detail, with summary/list left and selected-material detail right. The whole route also contains dashboard cards, alerts, insights and stock runs, so it is not only a master-detail editor.
2. **Which parts should be rebuilt instead of restyled?** Recompose the page-level section hierarchy and responsive container/scroll ownership. Keep API orchestration, summary filters, selection, batch/history data and current operation handlers. Restyle the material table/detail and modal shells where needed.
3. **Which modals should become pages?** No supplied reference requires a new Inventory subpage. The complex Stock Run manage dialog is the only candidate if future usage warrants more room, but the main design describes draft management as a modal. Keep the current page architecture unless a dedicated Stock Run page design is approved. Supplier management already has its separate approved page.
4. **Which workflows should remain modal?** Add/edit material (short forms), archive confirmation, adjustment, waste, stock-run creation, draft management under the current reference, delete-draft confirmation, batch transaction drilldown, and store-availability search are reasonable modal/drawer workflows.
5. **Which components should be replaced?** Replace/recompose the large inline Inventory page composition; restyle rather than replace the established list/detail/report responsibilities. Investigate the older unreferenced `src/components/inventory/*` family separately.
6. **Which APIs already support the desired design?** Summary/filter, raw material read/create/update/archive, units/suppliers, batch list and batch/material ledger reads, adjustment/waste creation, stock-run list/detail/create/add/delete/post and inventory health/waste/spend reports.
7. **Which elements require backend changes?** Persisted material notes/default suppliers, restore, optional-batch waste, archive history visibility control, separately stored adjustment reference, and individual stock-run line updates are not supported by the current contracts. Read-only derived stock status and displaying actor/unit/cost can use existing data.

## 12. Inspection Record

- Inspected `src/app/admin/inventory/**`, `src/components/admin/inventory/**`, `src/lib/inventory.ts` and `src/store/inventoryStore.ts`.
- Also inspected the matching Inventory and Stock Runs controllers/DTOs, raw-material schema fields, and the report references necessary to identify contract gaps. No backend files were changed.
- Read `INVENTORY.pdf`, `EDIT MODAL.pdf`, `ARCHIVE MODAL.pdf`, `STOCK ADJUSTMENT MODAL.pdf`, `WASTE MODAL.pdf`, `WASTE REASON MODAL.pdf`, `NEAR EXPIRY MODAL.pdf` and checked the archive for separate Add Material/Stock Run references.
- No browser screenshots, live API calls or database operations were performed.

**No implementation changes were made. Stop after this audit.**
