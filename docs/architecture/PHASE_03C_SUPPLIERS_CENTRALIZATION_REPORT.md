# Phase 3C — Suppliers Centralization

## Changed files

- `ims-frontend/src/features/suppliers/SuppliersFeature.tsx` (new).
- `ims-frontend/src/app/admin/inventory/suppliers/page.tsx`.
- `ims-frontend/src/app/admin/suppliers/page.tsx`.
- `ims-frontend/tests/suppliers.test.cjs` (new).
- This report.

## Previous supplier structure

The inventory supplier route owned fetching, CRUD callbacks, inventory supplier-filter cleanup, loading/error presentation, and the shell. The legacy supplier route imported that route page directly.

## Centralized structure

Both existing pages are thin adapters to one role-neutral `features/suppliers/SuppliersFeature`. The feature retains the original shell ownership and composes the existing SupplierWorkspace. No page imports another page. Existing supplier components remain in their directories.

## Behavior preserved

Source comparison against HEAD verified the extracted feature is identical to the original implementation except its exported function name. Fetching, mutation/refresh ordering, submitting state, deletion filter cleanup, shell/header, classes, and error/loading behavior are unchanged.

Both URLs retain `suppliers.view` admission. Existing create/edit/delete controls and handler checks remain unchanged; no availability-search permission usage or API behavior was modified. All five existing supplier permissions retain their semantics. No `/suppliers` route, registry change, backend edit, or visual redesign was introduced.

## Tests/results

- `node --test --test-isolation=none tests/suppliers.test.cjs`: **2 passed**, verifying both adapters reference the same feature, contain no page-to-page import, and render one shell with the existing header/loading presentation. Child components and data dependencies are mocked.
- Same runner for `tests/permissions.test.cjs`: **27 passed**, including centralized route permission matrices and alias metadata.
- Frontend `tsc --noEmit --incremental false`: **passed**.
- Non-mutating ESLint scoped to the feature, two adapters, and test: **passed**.
- `git diff --check`: **passed**.

No full frontend/backend suite or build ran.

## Diff review

Reviewed the two adapter replacements and exact feature relocation comparison. SupplierWorkspace, inventory/API modules, permission policies, styles, and database/backend files were untouched. Existing changes from earlier phases were preserved.

## Risks

No browser visual or live CRUD test was performed. The exact relocation comparison supports preservation of feature logic; adapter tests validate composition rather than network mutations. Existing admin-named child component imports intentionally remain to avoid unrelated renaming.

## Readiness for Phase 3D

Ready for separately scoped Phase 3D work. Suppliers now has one internal feature entry with both legacy URLs preserved.
