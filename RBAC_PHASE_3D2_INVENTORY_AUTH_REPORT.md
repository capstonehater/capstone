# RBAC Phase 3D-2 - Inventory Materials Authorization Report

Date: 2026-09-29. Status: complete. Scope: Inventory materials only.

Reviewed the Phase 1, Phase 3C, and Phase 3D1 reports. Prior uncommitted work was preserved.

## 1. Pre-change endpoint mapping

Mapping completed before changing controller code. All endpoints remain session-authenticated.

| Endpoint | Existing authorization | New authority |
| --- | --- | --- |
| GET `/raw-materials/:id/store-availability` | Administrator | UNCHANGED (separate Supplier/location-discovery scope) |
| POST `/raw-materials/:id/store-availability` | Administrator | UNCHANGED (separate Supplier/location-discovery scope) |
| GET `/units` | Administrator / Staff | inventory.view |
| GET `/raw-materials` | Administrator / Staff | inventory.view |
| POST `/raw-materials` | Administrator | inventory.create |
| GET `/raw-materials/:id` | Administrator / Staff | inventory.view |
| PATCH `/raw-materials/:id` | Administrator | inventory.edit |
| DELETE `/raw-materials/:id` | Administrator | inventory.archive |
| GET `/raw-materials/:id/batches` | Administrator / Staff | inventory.view |
| GET `/raw-materials/:id/transactions` | Administrator / Staff | inventory.view |
| GET `/stock-batches/:id/transactions` | Administrator / Staff | inventory.view |
| GET `/suppliers` | Administrator / Staff | UNCHANGED (separate Supplier/location-discovery scope) |
| POST `/suppliers` | Administrator | UNCHANGED (separate Supplier/location-discovery scope) |
| PATCH `/suppliers/:id` | Administrator | UNCHANGED (separate Supplier/location-discovery scope) |
| DELETE `/suppliers/:id` | Administrator | UNCHANGED (separate Supplier/location-discovery scope) |
| GET `/inventory/summary` | Administrator / Staff | inventory.view |
| GET `/inventory/transactions` | Administrator / Staff | inventory.view |
| POST `/inventory/waste` | Administrator / Staff | inventory.waste |

Additional audit boundaries: GET `/reports/inventory-health` and other Reports endpoints retain their existing Administrator-only class policy. Stock Runs retains its existing role checks. No separate raw-material, batch, waste, or adjustment controller exists; material/waste/history endpoints are in InventoryController.

No adjustment HTTP endpoint or DTO exists in the current source. The only adjustment wording in InventoryActionsService is a shared batch-validation error. No new adjustment endpoint is introduced. If an adjustment endpoint is added during a later authorized phase, its temporary permission is inventory.edit. **inventory.adjust may be introduced in a future catalog migration.**

Store availability loads registered suppliers and ranks/searches their locations; GET returns the discovery job/results and POST starts it. It is supplier/location discovery rather than a material stock mutation, so both handlers keep Administrator-only access.

## 2. Controller changes and applied permissions

Only `InventoryController` was modified. Replaced method-level Roles decorators on **12 endpoints** with RequirePermission. There is no class-level Roles requirement to remove. Roles imports and INVENTORY_READ_ROLES remain because the six unmigrated supplier/discovery handlers still require them.

- Eight reads (units, material list/detail, batches, material/batch/general transaction history, summary): inventory.view.
- Material creation: inventory.create.
- Material metadata editing: inventory.edit.
- DELETE material, which performs the existing soft archive: inventory.archive.
- Waste recording: inventory.waste.

SessionAuthGuard remains first in the global guard chain. PermissionsGuard continues resolving fresh database grants, followed by the unchanged RolesGuard. Migrated endpoints have one authorization authority and no legacy-role fallback. No guard, registration, catalog, DTO, API response, or service code was changed.

## 3. Adjustment compatibility and scope decisions

The requested temporary policy is **inventory.edit for adjustments**, with no new permission key. There is no existing adjustment endpoint to decorate or authorize, so this phase does not add one. A regression test confirms that POST /inventory/adjustments remains 404 even with inventory.edit. This is not a claim of implementing adjustment functionality or its authorization.

**inventory.adjust may be introduced in a future catalog migration.**

Inventory health is implemented only under `/reports/inventory-health`. The instruction not to migrate Reports takes precedence over the illustrative inventory-health read example, so its Administrator-only policy is preserved. Stock Runs operations, including receiving/posting, are likewise outside this phase.

Store availability is supplier/location discovery despite its raw-material URL prefix. Its GET and POST handlers retain their original Administrator restriction. No suppliers.searchAvailability enforcement was introduced here.

## 4. Business rules and compatibility

InventoryService and InventoryActionsService are unchanged. Material archive still sets isActive=false; unit/existence validation, batch/material association and expiry validation, remaining-quantity checks, waste ledger entries, authenticated actor attribution, read-model refreshes, outbox events, transaction filters, supplier relationships, and calculations retain their existing implementation.

Administrator accounts with inventory grants retain access; a legacy Administrator label alone is insufficient on migrated handlers. Custom roles on other legacy identities can now read or mutate materials with the exact required grant. inventory.view alone cannot create, edit, archive, or record waste. inventory.edit permits metadata edits, but does not imply inventory.create, inventory.archive, or inventory.waste.

Seeded Staff inventory.view and inventory.waste preserve its material reads and waste recording; Staff still cannot create/edit/archive without additional grants. Custom roles may still encounter 403 on unmigrated Stock Runs, Suppliers, discovery, or Reports endpoints. That boundary is intentional and is not bypassed by material grants.

## 5. Frontend compatibility check

Read-only source inspection confirmed the existing frontend uses inventory.view for the Inventory navigation/route and material data access, inventory.create for Add Raw Material, inventory.edit for Edit, inventory.archive for Archive, and inventory.waste for Record Waste, including the associated dialogs. These match the migrated keys. No frontend files changed.

The frontend store-discovery control already checks suppliers.searchAvailability; its backend continues to require Administrator in this phase. Report summaries remain a separate frontend reports.view dependency with legacy backend Reports authorization. No UI mismatch was resolved by weakening a backend gate.

## 6. Tests and validation

Created `ims-backend/src/inventory/inventory-authorization.spec.ts`: **118 tests**. It runs actual InventoryController routes through an in-process Nest HTTP application with the real SessionAuthGuard, PermissionsGuard, RolesGuard, PermissionResolver, and the existing DTO ValidationPipe configuration. Session validation, Prisma reads, and business services are mocked; there are no live database writes, supplier searches, or stock mutations.

Coverage:

- Every migrated handler has its exact mapped requirement and no conflicting Roles/Public metadata.
- Every handler in the mixed controller is accounted for as migrated or explicitly retained.
- Administrator with grants and a custom role on a legacy Manager identity are allowed on each endpoint with the appropriate grant.
- No grant returns 403 and no session returns 401 before business services run; missing session also prevents permission lookup.
- Legacy Administrator without grants is denied on every migrated endpoint.
- View-only users cannot mutate materials or record waste.
- Staff read/waste compatibility is checked on all 12 migrated endpoints.
- All six Supplier/discovery handlers retain exact role metadata, reject a custom legacy Manager despite inventory/catalog grants, and continue admitting a legacy Administrator without inventory grants.
- Stock Runs and Reports retain legacy authorization metadata on every handler, with no added permission decorators.
- Edit does not authorize archive/waste; no adjustment endpoint/key was invented.
- Waste retains actor attribution and rejects zero/negative quantities through the unchanged DTO rules.
- Editing cannot smuggle isActive=false to bypass archive permission; the existing whitelist rejects that field.
- Permission revocation is effective on the next request; invalid sessions and inactive database identities are denied.
- The permission set matches exactly the five existing Inventory catalog keys.

Validation from `ims-backend`:

- `npx tsc --noEmit -p tsconfig.build.json`: passed.
- `npx jest --runInBand src/inventory/inventory-authorization.spec.ts src/inventory/inventory-supplier-delete.spec.ts`: **2 suites, 122 tests passed** (118 new, 4 existing supplier-deletion regressions).
- `npx eslint src/inventory/inventory.controller.ts src/inventory/inventory-authorization.spec.ts`: passed with no errors or warnings.
- Targeted Prettier and inventory diff whitespace check: passed.

The HTTP tests verify authorization and DTO behavior with mocked business services. They are not live persistence or browser end-to-end tests, nor a replacement for future adjustment tests if that API is added. Existing service source was left untouched. No migrations, Prisma generation, seed operations, or database changes were run.

## 7. Files changed in this phase

Modified:

- `ims-backend/src/inventory/inventory.controller.ts`

Created:

- `ims-backend/src/inventory/inventory-authorization.spec.ts`
- `RBAC_PHASE_3D2_INVENTORY_AUTH_REPORT.md`

Other dirty files belong to earlier work and were preserved.

## 8. Confirmations

Inventory MATERIAL authorization migration: **IMPLEMENTED** for the 12 mapped endpoints.

Products migration: **ALREADY IMPLEMENTED**, unchanged in this phase.

Stock Runs migration: **NOT IMPLEMENTED**.

Suppliers migration: **NOT IMPLEMENTED**.

Reports migration: **NOT IMPLEMENTED**.

POS, Users, and Settings migrations: **NOT IMPLEMENTED**.

Frontend changes: **NONE**.

Database changes: **NONE**.

Prisma/schema/migration changes: **NONE**.

Permission catalog changes: **NONE**.

Stopped after Inventory material authorization migration.
