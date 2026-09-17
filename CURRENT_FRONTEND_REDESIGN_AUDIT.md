# Current Frontend Redesign Audit

**Audit date:** 17 September 2026  
**Repository:** `C:\Users\Deej\Desktop\salvacion`  
**Compared against:** `design.zip` supplied design references and the current source tree at `HEAD` (`5c2a1f7`, `FrontendNew`).  
**Scope:** Current frontend redesign status, active routes/components, design alignment, preservation of existing behavior, suspicious duplicate/dead UI and safe next steps.

> **No implementation changes were made during this audit.** This file is the only intended audit artifact. No source, API, schema, database, seed, dependency, or configuration changes were made.

## 1. Executive Summary

The current application remains a functioning modular frontend with admin and staff shells, product management, inventory workflows, supplier management, reports, forecasting, store availability and POS. The recent redesign work is **partially implemented**. The Dashboard and Products pages have been reshaped, and Supplier Management has a route, but some reference details are missing and the supplier page still obtains its layout from modal components. Existing UI features and API-facing code remain connected in the inspected routes.

The immediate latest commit (`5c2a1f7`) is frontend-only. It contains nine frontend file changes and no backend changes. Earlier commits in the current branch contain backend feature work, including forecasting and store availability, and Prisma migrations. Therefore, the current backend cannot be described as untouched over the full redesign history; rather, no backend change was found in the latest shell/supplier/POS presentation commit.

### Current status at a glance

| Area | Status | Main observation |
| --- | --- | --- |
| Global shell/navigation | Implemented | Shared admin shell, route-aware sidebar and header exist; global styling sources overlap. |
| Dashboard | Partially aligned | Inventory-health and lower report panels are present; the supplied Dashboard reference also shows a different KPI/header composition. |
| Products workspace | Partially aligned | Master/detail page and selection/filtering remain active; reference History tab and some table/summary arrangements are absent. |
| Add/Edit Product | Partially aligned | Existing form state, validation and submit paths remain; reference-only description/tags/metadata fields are not present. |
| Destructive product actions | Functionally guarded; visual match partial | Archive/disable/delete/restore confirmation dialogs exist; deletion still uses existing eligibility checks. |
| Supplier Management | Route exists, page conversion incomplete | It is placed inside the admin shell, but still uses `SupplierManagementModal` and `InventoryModal` page-mode styling. |
| Inventory | Existing functionality retained | Inventory still opens supplier management as an in-context modal; this is distinct from the standalone Suppliers route. |
| Staff POS configurator modal | Scroll/height behavior implemented in shared modal | Shared `Modal.tsx` is used by multiple POS dialogs, so the layout change affects more than product configuration. |
| Reports, alerts, settings, users, forecasting | Existing pages/features | No evidence in this audit of a full visual redesign of all of these pages against supplied references. |

## 2. Audit Method and Evidence Limits

- Inspected the current source tree, route wrappers, navigation definitions, product component tree, supplier page wrappers, relevant shared styles and the Git change history.
- Read the design PDFs contained in `design.zip`, including Dashboard, Products, Add Product, Edit Product and Archive Product. The reference files were read in memory; the archive was not modified.
- Compared current source structure and field behavior against the design content. This is a static code/design audit, not a browser screenshot comparison.
- Did not run browser automation, accessibility tooling, API integration tests or database tests. Visual appearance at a particular viewport, map-provider responses and end-to-end interactions therefore remain unverified.
- “Preserved” means existing call paths and state/handlers remain in source; it is not a claim that an external service or production workflow was exercised successfully.

## 3. Current Architecture and Active Route Tree

The frontend uses Next.js App Router with client-side React workspaces. `src/app/admin/layout.tsx` provides the administrator role guard. Individual pages explicitly render `AdminDashboardLayout`, which composes the application shell, navigation and header. Staff routes use `StaffDashboardLayout`.

```text
src/app/admin/layout.tsx                 administrator auth/role boundary
  /admin/dashboard                       AdminDashboardLayout + dashboard workspace
  /admin/products                        AdminDashboardLayout + ProductsWorkspace
  /admin/inventory                       AdminDashboardLayout + inventory workspace
  /admin/inventory/suppliers             AdminDashboardLayout + supplier page-mode UI
  /admin/suppliers                       legacy alias to nested supplier page
  /admin/reports                          reports workspace
  /admin/forecasting                      forecast workspace
  /admin/alerts, /users, /settings        operational/admin workspaces
src/app/staff/...                         StaffDashboardLayout and POS workspace
```

Navigation is centrally described in `components/layout/shell-navigation.ts`. Products and Suppliers are top-level sidebar entries. The `matchesShellRoute` helper explicitly prevents the Inventory item from matching `/admin/inventory/suppliers`, avoiding simultaneous active states for those two links. Products and suppliers use different routes; the supplier navigation points to `/admin/inventory/suppliers`.

### Shell and style composition

The shell module stylesheet defines the navy sidebar (`#232d46`), light gray shell, selected-link accent and responsive sidebar behavior. Global CSS imports Bootstrap and Tailwind styling and applies a separate page background (`#f3ede3` in the inspected source), while the shell and some redesigned pages use `#f5f5f5`. Dashboard/product styles also use component-specific classes and utility classes. This mixed styling is active, not a single consistently applied token system, and can make colors/spacing differ between routes.

## 4. Dashboard Assessment

The active implementation is in `app/admin/dashboard/page.tsx` and `dashboard.module.css`. The page requests alert, inventory health, sales overview, stock-run spend, waste summary and supplier data through existing frontend clients. It displays the inventory overview, top-selling variants, stock-run spend, near-expiry watchlist, waste breakdown and recent orders. Its drill-in panels are rendered from dashboard state.

The supplied Dashboard PDF includes a top KPI row for Total Sales, Gross Margin, Low Stock Items and Inventory Value, followed by a prominent blue inventory overview and lower report panels. The current source focuses its prominent summary on inventory counts/value and still renders the heading/copy “Keep purchasing, waste, and adjustments focused.” The KPI row from the PDF is not present in the inspected dashboard JSX. Thus the current Dashboard has the lower operational sections and inventory metrics, but it is not a one-to-one implementation of that reference composition.

**Status:** Operational dashboard implementation present; visual match to the supplied dashboard reference is partial. No runtime screenshot comparison was performed.

## 5. Products Workspace Assessment

### Active component tree

```text
app/admin/products/page.tsx
  AdminDashboardLayout
    ProductsWorkspace
      ProductsMasterPanel
        ProductListToolbar
        ProductFilters
        ProductList
          ProductListItem
        ProductPagination
      ProductDetailPanel
        ProductDetailHeader
        ProductDetailTabs
        ProductOverviewTab
        ProductVariantsRecipeTab
          RecipeEditor
        ProductIngredientUsageTab
      dialogs: ProductFormDialog, VariantFormDialog,
               ArchiveProductDialog, DisableProductDialog,
               RestoreProductDialog, DeleteProductDialog
```

The workspace remains a master/detail design: filters and selectable product rows are on the left; selected-product information and tabs are on the right. The list implementation uses an HTML table, and the master/detail panels apply their own sizing and scrolling. This is not a replacement page architecture.

### Reference comparison

The Products reference shows a compact product search/add row, category/status/availability filters, Active/Archived switching, a five-row product table with pagination, and a detail side with product status/actions, four tabs (`Overview`, `Variant & Recipe`, `Ingredient Usage`, `History`), compact summary cards, a variants table, recipe details and deducted ingredients.

Current source implements the search/filter/list/pagination and the first three tabs. `ProductDetailTabs.tsx` defines only `overview`, `variants`, and `usage`; there is no History tab/panel. The current overview and variant/recipe structures are not identical to the reference's compact summary/table arrangement. Therefore, the primary workspace is functionally retained and directionally similar, but not a 1:1 reproduction.

Product counts are fetched for active and archived lists separately; the selected view controls which list is displayed. The UI label “All Products” is used in the current list selector, but it is not evidence that the active and archived counts are one combined count. Preserve the independent count semantics when making later presentation changes.

### Product modal comparison and behavior preservation

`ProductFormDialog` is shared for add and edit and retains its hooks, validation and submit handler. The existing form maps product name and category; create mode also has the existing POS enabled flag and initial variant inputs. The reference includes short description, tags, created-by/created-on and lifecycle presentation. Those values are not all supported by the current Product form API/model or current form state, and should not be invented as editable fields. The reference PDF’s footer text “Record Waste” conflicts with the explicit Add/Edit button labels in the redesign request and should be treated as a reference artifact; the current form uses Create Product / Save Changes.

The current destructive dialogs include Archive, Disable, Restore and Delete. Delete is gated by the existing eligibility check and displays the returned blocked reason; there is no evidence here of bypassing deletion rules. Disable uses the existing manual-availability handler and the action label changes to Enable when the product is already disabled. Archive retains the existing archive call and its reason input. The dialogs share a warning/confirmation visual language, but their summaries/options do not fully match the reference cards.

### Existing product integrations retained in the component tree

`ProductsWorkspace` continues to call product category/list/detail/usage/recipe clients and existing create/update, product availability, variant CRUD, recipe replacement, archive/restore and deletion eligibility/delete operations from `src/lib/products`. No backend or API contract change was found in the latest frontend-only commit.

## 6. Supplier Management Assessment

The intended destination `/admin/inventory/suppliers` is a normal Next route wrapped in `AdminDashboardLayout`, so the application sidebar/header are available. It loads suppliers and passes existing create/update/delete callbacks to the current supplier UI. `/admin/suppliers` is an alias to this page.

However, the page currently imports and renders a component named `SupplierManagementModal` with `open` and `pageMode` props. That component in turn uses `InventoryModal`, whose `pageMode` conditional disables overlay styling, hides its modal header/close control and applies page-specific wrapper sizing. The result can appear page-like, but it is still modal-derived presentation rather than a standalone supplier page component. The redundant `onClose={() => {}}` and hidden close control also mean the component's Close action cannot navigate or close anything in page mode.

The inventory page separately retains the in-context Manage Suppliers modal for existing inventory flows. That is compatible with having a standalone supplier page, but navigation to the supplier route should not trigger that inventory modal. The supplier page currently has its own data-loading and mutation callbacks, and the alias route does not duplicate those callbacks because it reuses the nested page component.

**Status:** Route and API-facing functions exist; page conversion is incomplete. Next safe presentation step is to extract a page-native supplier workspace/list/detail view while keeping the existing supplier client functions and retaining the inventory-context modal only where that workflow needs it.

## 7. POS Modal Assessment

The shared `staff-pos/modals/Modal.tsx` now constrains its height and allows internal content scrolling. The product configurator uses this modal, addressing the screenshot’s clipped long list. Because the component is shared, checkout/payment/reversal modal layouts inherit the same height/scroll policy. Validate each variant at laptop-sized and narrow viewports before considering the POS layout complete. This audit did not operate the dialogs in a browser.

## 8. Existing Behavior, API and Access Boundaries

- Administrator route guarding remains at the admin layout boundary. The shell navigation is presentation and is not the authorization mechanism.
- The frontend API client retains cookie credentials; authentication state is bootstrapped from the backend session rather than a redesign-only local token.
- The product workspace still uses its existing API helper layer and business callbacks; the latest frontend shell/supplier/POS commit did not alter backend endpoints.
- The supplier page reuses `fetchSuppliers`, `createSupplier`, `updateSupplier` and `deleteSupplier` from the existing inventory client. The inventory route still retains supplier modal workflows.
- POS modal work is limited to shared dialog sizing/scroll presentation in the latest commit; the inspected change does not itself replace checkout or product selection business logic.
- The existing branch contains backend and Prisma changes from earlier feature commits (Section 10); do not treat the full branch history as presentation-only.

These are source-level findings only. No live API, auth session, database or role-permission request was performed for this audit.

## 9. Duplicate, Legacy and Cleanup Candidates

| Candidate | Evidence | Recommendation |
| --- | --- | --- |
| `/admin/suppliers` alias | Thin page imports and re-exports `/admin/inventory/suppliers` page | Keep while old links may exist; later consolidate route policy and add a redirect if appropriate. |
| `SupplierManagementModal` as standalone page body | Used both by InventoryModal and standalone supplier route with a `pageMode` switch | Separate shared supplier data/form behavior from page and modal presentation. Do not remove inventory modal until its entry points are reviewed. |
| `InventoryPage` supplier pathname branch | `/admin/inventory/page.tsx` contains checks for supplier routes even though Next resolves those paths to separate page files | Investigate/remove only after routing tests confirm it is unreachable and no embedded use relies on it. |
| `src/components/inventory/*` legacy family | Search finds declarations of `InventoryHeader`, `InventoryGrid`, `InventoryTable`, `RecommendModal`, `RestockItemModal`, `AddItemModal`, `EditItemModal`, `DeleteItemModal`, and `ViewItemModal` within this family; no active references were found by the audited symbol search outside declarations | Treat as likely legacy/dead UI, not proven safe to delete. Confirm with whole-project import/reference search before cleanup. |
| `src/lib/staff-pos/data.ts` | Legacy/static POS data family coexists with API-backed POS | Confirm imports and route reachability before removal. |
| Product variants / detail presentation | Workspace has dedicated components and behavior | Keep; visual differences do not make these dead code. |
| Generated/historical reports | Prior redesign and audit reports predate the current state | Mark historical; this audit is the current source-of-truth summary. |

## 10. Changed-File Inventory and Change Attribution

### Latest commit: `5c2a1f7` (`FrontendNew`)

This commit changes only the following nine frontend files; `git diff HEAD^ HEAD -- ims-backend` is empty.

| File | Change area | Audit classification |
| --- | --- | --- |
| `ims-frontend/src/app/admin/inventory/page.tsx` | Inventory/supplier route behavior | Inspect the retained supplier modal entry and redundant pathname branch. |
| `ims-frontend/src/app/admin/inventory/suppliers/page.tsx` | Standalone supplier route | Active; still modal-derived via `pageMode`. |
| `ims-frontend/src/app/admin/suppliers/page.tsx` | Legacy supplier alias | Active compatibility wrapper. |
| `ims-frontend/src/app/globals.css` | Global presentation | Active; overlaps with Tailwind/Bootstrap/component styles. |
| `ims-frontend/src/components/admin/AdminSidebar.tsx` | Sidebar presentation | Active, uses shared navigation. |
| `ims-frontend/src/components/admin/inventory/InventoryModal.tsx` | Modal and page-mode wrapper | Active; mixed modal/page responsibility. |
| `ims-frontend/src/components/admin/inventory/SupplierManagementModal.tsx` | Supplier list/details UI | Active in both inventory modal and supplier page. |
| `ims-frontend/src/components/layout/shell-navigation.ts` | Navigation and route matching | Active. |
| `ims-frontend/src/components/staff-pos/modals/Modal.tsx` | Shared POS dialog dimensions/scroll | Active; impacts all users of shared modal. |

### Frontend files changed since branch baseline `f76a6df`

The following is the Git name-status inventory. It includes earlier feature and redesign commits; “changed” does not mean every item is part of the latest visual redesign.

| Status | File |
| --- | --- |
| A | `ims-frontend/src/app/admin/dashboard/dashboard.module.css` |
| M | `ims-frontend/src/app/admin/dashboard/page.tsx` |
| A | `ims-frontend/src/app/admin/forecasting/MaterialDropdown.tsx` |
| A | `ims-frontend/src/app/admin/forecasting/forecasting.module.css` |
| A | `ims-frontend/src/app/admin/forecasting/page.tsx` |
| M | `ims-frontend/src/app/admin/inventory/page.tsx` |
| A | `ims-frontend/src/app/admin/inventory/suppliers/page.tsx` |
| M | `ims-frontend/src/app/admin/products/page.tsx` |
| A | `ims-frontend/src/app/admin/suppliers/page.tsx` |
| M | `ims-frontend/src/app/globals.css` |
| M | `ims-frontend/src/app/staff/pos/page.tsx` |
| M | `ims-frontend/src/components/admin/AdminDashboardLayout.tsx` |
| M | `ims-frontend/src/components/admin/AdminHeader.tsx` |
| M | `ims-frontend/src/components/admin/AdminSidebar.tsx` |
| M | `ims-frontend/src/components/admin/inventory/InventoryModal.tsx` |
| M | `ims-frontend/src/components/admin/inventory/MaterialDetailPanel.tsx` |
| A | `ims-frontend/src/components/admin/inventory/StoreAvailabilityModal.tsx` |
| M | `ims-frontend/src/components/admin/inventory/SupplierLocationPicker.tsx` |
| M | `ims-frontend/src/components/admin/inventory/SupplierManagementModal.tsx` |
| M | `ims-frontend/src/components/admin/products/ArchiveProductDialog.tsx` |
| M | `ims-frontend/src/components/admin/products/DeleteProductDialog.tsx` |
| A | `ims-frontend/src/components/admin/products/DisableProductDialog.tsx` |
| M | `ims-frontend/src/components/admin/products/ProductDetailHeader.tsx` |
| M | `ims-frontend/src/components/admin/products/ProductDetailPanel.tsx` |
| M | `ims-frontend/src/components/admin/products/ProductDetailTabs.tsx` |
| M | `ims-frontend/src/components/admin/products/ProductFilters.tsx` |
| M | `ims-frontend/src/components/admin/products/ProductFormDialog.tsx` |
| M | `ims-frontend/src/components/admin/products/ProductList.tsx` |
| M | `ims-frontend/src/components/admin/products/ProductListItem.tsx` |
| M | `ims-frontend/src/components/admin/products/ProductListToolbar.tsx` |
| M | `ims-frontend/src/components/admin/products/ProductsMasterPanel.tsx` |
| M | `ims-frontend/src/components/admin/products/ProductsWorkspace.tsx` |
| M | `ims-frontend/src/components/admin/products/RestoreProductDialog.tsx` |
| M | `ims-frontend/src/components/admin/reports/InventoryAvailabilityRiskSection.tsx` |
| M | `ims-frontend/src/components/admin/settings/SettingsWorkspace.tsx` |
| A | `ims-frontend/src/components/auth/ProfileAvatar.tsx` |
| A | `ims-frontend/src/components/layout/ApplicationShell.module.css` |
| A | `ims-frontend/src/components/layout/shell-navigation.ts` |
| M | `ims-frontend/src/components/staff-pos/StaffDashboardLayout.tsx` |
| M | `ims-frontend/src/components/staff-pos/StaffHeader.tsx` |
| M | `ims-frontend/src/components/staff-pos/modals/Modal.tsx` |
| M | `ims-frontend/src/lib/auth.ts` |
| A | `ims-frontend/src/lib/forecasting.ts` |
| M | `ims-frontend/src/lib/inventory.ts` |

### Backend changes elsewhere in branch history

Earlier commits since `f76a6df` include backend feature work; these files are not part of the latest `FrontendNew` commit. Categories include forecasting API/services/types/tests, store-availability API and workers, supplier deletion behavior, user service/mapping changes, auth response types, application module wiring, package scripts and Prisma schema/migrations. In particular, migrations add forecasting and store-availability tables. These changes are part of the current branch and should be reviewed as feature work, not attributed to CSS/page layout alone. No backend diff was found in the current working tree when this audit began.

## 11. Design and Implementation Gaps

1. **Dashboard reference mismatch:** the PDF’s Total Sales/Gross Margin/Low Stock/Inventory Value KPI row is not in current Dashboard JSX; the “Keep purchasing…” copy remains.
2. **Products detail completeness:** the `History` tab shown in the design is absent. Current detail summary and variants/recipe composition differ from the compact reference layout.
3. **Add/Edit field differences:** tags, description and metadata shown in reference are not represented as current editable fields. Do not create UI fields with no API/model behavior.
4. **Supplier route remains modal-derived:** page shell is correct, but modal component/page-mode design and no-op close remain. Inventory’s separate modal workflow is still active.
5. **Visual system is mixed:** Bootstrap, Tailwind utilities, global CSS and module styles coexist; background values differ between global CSS and shell/pages.
6. **Shared POS modal scope:** the new scroll behavior applies to all dialogs using the shared modal; validate all of them, not only the product configurator.
7. **Dead-code certainty:** old inventory components look unreferenced by symbol search, but no deletion should occur until import-graph validation confirms that conclusion.
8. **No visual/browser proof:** current comparison is source-to-reference static inspection. Responsive proportions, focus behavior, keyboard navigation, map use and browser-specific scrolling remain unverified.

## 12. Recommended Next Steps

1. Convert Supplier Management into a page-native workspace component and keep the inventory-context supplier dialog as a separate presentation wrapper over shared supplier operations.
2. Resolve supplier route ownership: keep one canonical route, define legacy alias behavior, and remove the unreachable route checks only after verifying router behavior.
3. Finish the Products reference differences that are supported by existing data (notably History only if a suitable history source already exists); explicitly document unsupported design fields rather than fabricating form state.
4. Decide whether Dashboard should retain the current operational focus or add the reference KPI row; then implement and compare at the same viewport dimensions as the design.
5. Establish shared color/spacing tokens and reduce conflicts between global Bootstrap, Tailwind and module CSS incrementally.
6. Test the shared POS modal at full height, long option lists, checkout/payment flows, and narrow screens.
7. Run a whole-repository import/reachability check before deleting legacy inventory components or static POS data.
8. Review earlier backend/Prisma changes separately from UI work; keep this audit’s frontend conclusions from being mistaken for backend safety certification.

## 13. Verification Record

| Check | Result |
| --- | --- |
| Current branch/HEAD inspection | `main`, `5c2a1f7 FrontendNew` |
| Worktree before audit artifact | Clean |
| Latest commit backend diff | None |
| Changed frontend paths since `f76a6df` | Enumerated in Section 10 |
| Active Products detail tabs | `Overview`, `Variants & Recipe`, `Ingredient Usage`; no History tab |
| Supplier route shell and component | Admin shell present; modal-derived `pageMode` component remains |
| Design references | Dashboard, Products, Add Product, Edit Product, Archive Product PDFs read from `design.zip` |
| Browser/API/database test | Not run; audit-only scope |

**Conclusion:** The current code preserves substantial working functionality and has made visible progress toward the references, but the redesign is not complete or 1:1. The clearest structural follow-up is the supplier page’s remaining modal-derived implementation; the clearest design gaps are Dashboard KPI composition and the Products History/detail presentation. **No implementation changes were made during this audit.**
