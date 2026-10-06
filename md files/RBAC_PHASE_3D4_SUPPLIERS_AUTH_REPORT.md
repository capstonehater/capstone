# RBAC Phase 3D-4 - Suppliers Authorization Report

## 1. Pre-change endpoint mapping

Mapping completed before code changes. Reviewed Phase 3D2/3D3 reports, InventoryController, InventoryService, StoreAvailabilityService, StockRunsService, supplier DTOs, existing tests and frontend callers.

| Endpoint | Purpose | Previous authority | New permission |
| --- | --- | --- | --- |
| GET /suppliers | Full supplier directory; also reused by receiving selector | Administrator / Staff | suppliers.view |
| POST /suppliers | Create supplier record | Administrator | suppliers.create |
| PATCH /suppliers/:id | Edit supplier record/location | Administrator | suppliers.edit |
| DELETE /suppliers/:id | Delete supplier record | Administrator | suppliers.delete |
| GET /raw-materials/:id/store-availability | Retrieve supplier discovery job/results | Administrator | suppliers.searchAvailability |
| POST /raw-materials/:id/store-availability | Start supplier discovery/ranking | Administrator | suppliers.searchAvailability |

All remain session authenticated. There is no separate supplier-detail or limited selector endpoint. GET /suppliers returns the full directory including contact/address/location fields, not a specialized receiving-only lookup. Its read permission does not grant management mutations. Seeded Staff already has suppliers.view, preserving the current receiving selector. Custom receiving roles need this read grant to use the existing full-directory selector; stockRuns grants alone do not implicitly expose it. No new endpoint, frontend adaptation, or OR fallback is introduced.

Stock Run create/item/post handlers retain their Stock Runs requirements. Passing an existing supplier reference still uses the unchanged supplier-existence validation, not supplier-management authorization. Discovery reads suppliers internally under its own capability and does not require suppliers.view or any CRUD grant. Frontend map geocoding is not a separate supplier backend endpoint.

## 2. Implementation and preserved behavior

InventoryController is the only production file changed in this phase. Its six supplier handlers now use the permissions above and have no conflicting Roles metadata. SessionAuthGuard and the existing permission resolver/guard remain unchanged; there is no role OR permission fallback. A legacy Administrator without grants is denied.

Supplier CRUD, DTO validation, deletion behavior, supplier relationships, Stock Run references, discovery ranking, geolocation and location calculations are unchanged. Existing supplier deletion preserves the service's database error handling; no new delete restrictions were introduced. No services were modified.

## 3. Frontend compatibility

Inspected SupplierWorkspace, InventoryWorkspace, MaterialDetailPanel, StoreAvailabilityModal and shell navigation. Existing frontend gates use suppliers.view, suppliers.create, suppliers.edit, suppliers.delete and suppliers.searchAvailability. The receiving directory fetch already requires suppliers.view. No frontend changes were needed or made in this phase.

## 4. Tests and validation

Added suppliers-authorization.spec.ts with actual Nest HTTP requests through the session, permission and role guards and the real permission resolver, using mocked persistence and business services. Coverage includes all six endpoints, exact-grant custom roles, granted Administrators, missing grants (403), missing/invalid sessions (401), legacy Administrators without grants, inactive accounts, grant revocation, view-only restrictions and discovery-only restrictions. Tests also cover DTO validation, catalog key parity and the unchanged Reports boundary.

Receiving tests prove a user can read the directory with suppliers.view without supplier mutation permissions, and can create a Stock Run, add an item referencing a supplier and post using only the relevant Stock Run grants. They also assert that Stock Run grants do not expose the full supplier directory.

Updated the earlier inventory authorization suite to remove obsolete expectations that supplier endpoints remain role-only, and changed the supplier deletion metadata assertion to suppliers.delete. Existing deletion business tests remain intact.

Validation passed:

- Backend TypeScript: npx tsc --noEmit -p tsconfig.build.json.
- Four targeted Jest suites: suppliers-authorization, inventory-authorization, inventory-supplier-delete and store-availability.service; 166 tests passed.
- Targeted ESLint on all four changed TypeScript files.
- After fixing lint typing in the deletion metadata test, its four tests passed again.

These checks do not exercise a live database or external discovery provider. Existing StoreAvailabilityService tests exercise its logic with mocked dependencies; supplier authorization tests do not send external requests.

## 5. Files changed in this phase

- ims-backend/src/inventory/inventory.controller.ts
- ims-backend/src/inventory/suppliers-authorization.spec.ts (new)
- ims-backend/src/inventory/inventory-authorization.spec.ts
- ims-backend/src/inventory/inventory-supplier-delete.spec.ts
- RBAC_PHASE_3D4_SUPPLIERS_AUTH_REPORT.md (new)

Pre-existing uncommitted work from earlier phases was preserved. The repository-wide diff includes earlier changes and is not the scope of this phase.

## 6. Phase status confirmations

| Area | Backend authorization migration status |
| --- | --- |
| Products | IMPLEMENTED |
| Inventory Materials | IMPLEMENTED |
| Stock Runs | IMPLEMENTED |
| Suppliers | IMPLEMENTED |
| Reports | NOT IMPLEMENTED |
| POS | NOT IMPLEMENTED |
| Users | NOT IMPLEMENTED |

Frontend changes: NONE in this phase.

Database changes: NONE in this phase. Prisma, migrations and the permission catalog were not modified.

Stopped after supplier authorization migration.
