# RBAC Phase 3D-3 - Stock Runs Authorization Report

Date: 2026-09-29. Status: complete. Scope: Stock Runs authorization only.

## 1. Pre-change mapping

Completed before modifying controller code. Reviewed Phase 3D1 and 3D2 reports, controller, service, DTOs, existing tests and seed grants.

| Endpoint | Previous authorization | New permission |
| --- | --- | --- |
| POST `/stock-runs` | Administrator / Staff + session | stockRuns.create |
| PATCH `/stock-runs/:id` | Administrator / Staff + session | stockRuns.edit |
| POST `/stock-runs/:id/items` | Administrator / Staff + session | stockRuns.edit |
| DELETE `/stock-runs/:id/items/:itemId` | Administrator / Staff + session | stockRuns.edit |
| POST `/stock-runs/drafts/:id/delete` | Administrator / Staff + session | stockRuns.delete |
| DELETE `/stock-runs/:id/draft` | Administrator / Staff + session | stockRuns.delete |
| DELETE `/stock-runs/:id` | Administrator / Staff + session | stockRuns.delete |
| POST `/stock-runs/:id/post` | Administrator / Staff + session | stockRuns.post |
| GET `/stock-runs` | Administrator / Staff + session | stockRuns.view |
| GET `/stock-runs/:id` | Administrator / Staff + session | stockRuns.view |

All three deletion aliases call deleteDraftStockRun and require stockRuns.delete. Item removal is draft editing, not draft deletion. Items/details are included in the existing GET responses; no separate item-read endpoint exists.

Service audit: posting checks existence, DRAFT status and nonempty items inside a Prisma transaction; creates batches, computes costs, appends the ledger transaction, marks POSTED, refreshes availability and enqueues an outbox event. Draft edit/delete checks and supplier/material checks remain unchanged. Seeded Staff has all five stockRuns permissions, not just read access.

## 2. Controller changes and permissions

All 10 StockRunsController handlers now use RequirePermission. Removed their Administrator/Staff Roles decorators and the unused Role/Roles imports. No class-level role restriction remains. The existing global SessionAuthGuard -> PermissionsGuard -> RolesGuard chain is unchanged; authenticated users require current database grants with no legacy-role fallback.

Reads require stockRuns.view; draft creation requires stockRuns.create; metadata edits and item addition/removal require stockRuns.edit; all three draft deletion aliases require stockRuns.delete; posting independently requires stockRuns.post. No permission implies another. No service, DTO, API path, response shape, permission catalog or guard implementation changed.

## 3. Staff compatibility

The pre-migration controller admitted Administrator and Staff on every operation, including posting and deletion. The Phase 1 migration seeds all five Stock Runs permissions for Staff, as verified in its role_permissions INSERT statement. This preserves Staff's full workflow when those grants remain assigned. It does not make Staff read-only or create an implicit role bypass. Legacy Administrator or Staff identities without grants are denied; custom role holders can act according to explicit grants.

## 4. Posting and lifecycle protections

StockRunsService is unchanged. Posting still runs in the existing Prisma transaction and rejects missing runs, non-DRAFT runs, and empty drafts before batch creation. It preserves item quantities/costs, supplier and material references, batch creation, actor-attributed ledger entries, total-cost calculation, POSTED status, read-model refreshes, and outbox events.

All deletion aliases call the same existing deleteDraftStockRun service, which uses ensureDraftStockRun. Posted runs cannot be deleted; metadata and item edits retain the same draft restriction. The original error message for a non-draft deletion remains unchanged.

Lifecycle tests verify sequential repeat posting is rejected without creating a second batch/ledger entry. They do not establish concurrent-posting safety or real database rollback: persistence is mocked. No locking, isolation, idempotency, duplicate-prevention, or lifecycle implementation was altered or strengthened in this authorization-only phase.

## 5. Frontend compatibility

Read-only inspection confirmed StockRunModals and InventoryWorkspace use stockRuns.view/create/edit/delete/post consistently with the controller mapping. Item removal checks stockRuns.edit, while draft deletion checks stockRuns.delete. The workspace gates stock-run list/detail requests with stockRuns.view. No frontend changes were made.

The combined Inventory workspace also requires inventory.view to enter and load its material choices. Supplier support endpoints remain governed by their existing legacy authorization until their separate migration. Backend Stock Run grants were not broadened or weakened to accommodate those separate UI dependencies.

## 6. Tests and validation

Created `src/stock-runs/stock-runs-authorization.spec.ts`: **77 tests** using actual Nest HTTP routes, real session/permission/role guards, and the real permission resolver with mocked session validation, database reads, and business services. Covers every handler's metadata, Administrator grants, exact custom-role grants, missing grants (403), absent/invalid sessions (401), view-only mutation denial, create-without-post denial, edit-without-delete denial, Staff compatibility, actor attribution, revocation, inactive identities, unknown keys, and exact catalog-key parity. This harness isolates authorization; it does not exercise DTO validation or live business mutations.

Created `src/stock-runs/stock-runs-lifecycle.spec.ts`: **8 tests** exercising the actual unchanged StockRunsService with mocked persistence/collaborators. Covers draft-only deletion/editing, unknown runs, empty posting, batch/supplier/cost/ledger/actor/refresh/outbox behavior, sequential repeat posting, and stopping before POSTED/outbox when the ledger fails. The transaction mock does not simulate database rollback or concurrency.

Updated the Phase 3D2 Inventory authorization test to remove its now-obsolete expectation that Stock Runs remains legacy-only. Its Reports boundary assertion remains intact; no Inventory runtime code changed.

Validation from `ims-backend`:

- `npx tsc --noEmit -p tsconfig.build.json`: passed.
- `npx jest --runInBand src/stock-runs/stock-runs-authorization.spec.ts src/stock-runs/stock-runs-lifecycle.spec.ts src/inventory/inventory-authorization.spec.ts`: **3 suites, 203 tests passed** (77 authorization, 8 lifecycle, 118 Inventory regressions).
- Targeted ESLint on the controller and all three affected test files: passed with no errors or warnings after correcting test assertion typing.
- Lifecycle suite rerun after the typing correction: **8 passed**.
- Targeted formatting and diff whitespace checks passed.

No live database, stock, user, role, supplier, or session records were mutated for verification. No migrations or seed operations were run. No browser end-to-end or concurrent database tests are claimed.

## 7. Files changed in this phase

Modified:

- `ims-backend/src/stock-runs/stock-runs.controller.ts`
- `ims-backend/src/inventory/inventory-authorization.spec.ts` (obsolete boundary assertion only)

Created:

- `ims-backend/src/stock-runs/stock-runs-authorization.spec.ts`
- `ims-backend/src/stock-runs/stock-runs-lifecycle.spec.ts`
- `RBAC_PHASE_3D3_STOCKRUNS_AUTH_REPORT.md`

Prior-phase uncommitted work was preserved. StockRunsService, DTOs, permission catalog, guards, frontend, Prisma, and database contents were not changed.

## 8. Confirmations

Products: **IMPLEMENTED** previously; unchanged here.

Inventory Materials: **IMPLEMENTED** previously; runtime unchanged here.

Stock Runs: **IMPLEMENTED** for all 10 mapped handlers.

Suppliers: **NOT IMPLEMENTED**.

Reports: **NOT IMPLEMENTED**.

POS: **NOT IMPLEMENTED**.

Users and Settings migrations: **NOT IMPLEMENTED**.

Frontend changes: **NONE**.

Database changes: **NONE**.

Prisma/migration/catalog changes: **NONE**.

Stopped after Stock Run authorization migration.
