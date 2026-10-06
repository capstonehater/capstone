# Supplier Page Redesign Report

**Date:** 17 September 2026

## 1. Old modal architecture removed

- Removed `SupplierManagementModal` and its `InventoryModal` wrapper.
- Removed the supplier-specific `pageMode` branch from `InventoryModal`; the shared inventory modal remains for other inventory workflows.
- Removed the `supplier-management` modal state from the inventory store and inventory modal prop unions.
- Removed the dead supplier-route branch from the Inventory page.

## 2. New supplier page structure

`/admin/inventory/suppliers` now renders a regular two-column page inside `AdminDashboardLayout`. It has a page header, searchable supplier list, selected-row highlight, and supplier detail form. The details panel supports viewing, editing, creating and deleting; location search, map pin selection, geocoding and the existing directions controls continue through `SupplierLocationPicker`.

Supplier deletion uses a dedicated confirmation dialog with supplier summary and a notice that existing server deletion rules still apply.

## 3. Components created

- `src/components/admin/suppliers/SupplierWorkspace.tsx` — page-native supplier list, form, location section and delete confirmation dialog.

## 4. Components removed/replaced

- Deleted `src/components/admin/inventory/SupplierManagementModal.tsx` after removing all imports and use sites.
- The standalone page now renders `SupplierWorkspace`; it no longer uses modal props, overlays, hidden close controls or modal sizing.
- `InventoryModal.tsx` remains for unrelated inventory dialogs and no longer supports page mode.

## 5. Routes changed

- Canonical route: `/admin/inventory/suppliers`.
- `/admin/suppliers` continues to reuse the canonical page component as a compatibility alias; there is one supplier implementation.

## 6. Inventory supplier navigation change

- The Inventory “Manage Suppliers” button navigates to `/admin/inventory/suppliers`.
- The store-availability journey action also navigates to the supplier page.
- Inventory no longer mounts or opens the supplier editor. It continues loading suppliers for stock-run and adjustment supplier selection.
- Removing a supplier clears the selected inventory supplier filter when it points at that supplier.

## 7. API functions preserved

The page uses the existing `fetchSuppliers`, `createSupplier`, `updateSupplier` and `deleteSupplier` functions from `src/lib/inventory.ts`. The existing `SupplierLocationPicker` and `/api/geolocation` integration remain in use. No API client, endpoint, payload or contract was changed.

## 8. Backend changes

**None.** No backend files were modified.

## 9. Database changes

**None.** No schema, migration, seed or database changes were made.

## 10. Sanity check result

- Supplier page renders inside the administrator shell; no supplier editor overlay or centered modal remains.
- Searches found no remaining `SupplierManagementModal`, supplier `pageMode`, or `supplier-management` state references.
- Inventory supplier entry points navigate to the canonical page.
- Existing create/update/delete client calls and map/geocoding component are connected.
- Targeted ESLint completed with no errors. It reports four existing hook-dependency warnings in Inventory page effects.
- Frontend TypeScript check remains blocked by three pre-existing type errors in `src/components/admin/products/ProductsWorkspace.tsx`, where `manualAvailability` is inferred as `string` rather than `"ENABLED" | "DISABLED"`. No supplier-related type error was reported.
- `git diff --check` passed. Browser, map-provider and live API workflows were not run.

## 11. Remaining differences

- Supplier creation/editing is inline in the details panel rather than a separate route or drawer.
- The `/admin/suppliers` compatibility route reuses the canonical page component rather than redirecting.
- Map rendering and external geocoding behavior were preserved from existing code but not verified in a live browser session.
