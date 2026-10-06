# RBAC Phase 3D-1 - Products Authorization Report

Date: 2026-09-29. Status: complete. Scope: Products backend authorization only.

Reviewed the Phase 1, 2, 3A, 3B, and 3C reports. Existing uncommitted changes from earlier phases were preserved.

## 1. Pre-change audit and endpoint mapping

Mapping completed before modifying controller authorization. All endpoints remain session authenticated.

| Endpoint | Previous authority | New permission |
| --- | --- | --- |
| GET `/admin/products` | Administrator role | `products.view` |
| GET `/admin/products/:id` | Administrator role | `products.view` |
| POST `/admin/products` | Administrator role | `products.create` |
| PATCH `/admin/products/:id` | Administrator role | `products.edit` |
| PATCH `/admin/products/:id/manual-availability` | Administrator role | `products.edit` |
| POST `/admin/products/:id/archive` | Administrator role | `products.archive` |
| POST `/admin/products/:id/restore` | Administrator role | `products.restore` |
| GET `/admin/products/:id/delete-eligibility` | Administrator role | `products.view` |
| DELETE `/admin/products/:id` | Administrator role | `products.delete` |
| POST `/admin/products/:id/variants` | Administrator role | `products.create` |
| PATCH `/admin/variants/:id` | Administrator role | `products.edit` |
| PATCH `/admin/variants/:id/manual-availability` | Administrator role | `products.edit` |
| DELETE `/admin/variants/:id` | Administrator role | `products.delete` |
| GET `/admin/variants/:id/recipe` | Administrator role | `products.view` |
| PUT `/admin/variants/:id/recipe` | Administrator role | `products.edit` |
| GET `/admin/products/:id/ingredient-usage` | Administrator role | `products.view` |
| GET `/admin/products/:id/orders/:orderId/ingredient-usage` | Administrator role | `products.view` |
| GET `/products` | Authenticated session | `products.view` |
| GET `/products/:id/variants` | Authenticated session | `products.view` |

Unchanged boundaries: GET `/categories`, GET `/pos/menu`, GET `/variants/:id/availability` retain session-only access. Forecasting product selectors belong to Forecasting and remain unchanged. Recipes have no separate controller: recipe reads/replacement are in AdminProductsController. PUT recipe replaces an entire recipe, including initially empty recipes, and maps to products.edit; no distinct recipe creation endpoint exists.

Service audit: ProductManagementService contains no legacy role authorization to remove. Existing delete eligibility, archive/restore, variant, recipe, availability and historical-reference checks remain untouched. CatalogService and recipe/availability services remain unchanged. Global guard order remains SessionAuthGuard -> PermissionsGuard -> RolesGuard; migrated handlers cannot inherit Roles metadata.

## 2. Controllers and permissions

Changed AdminProductsController (17 handlers) and the two product-read handlers in CatalogController, for **19 migrated endpoints**. Applied only the six existing catalog keys: products.view, products.create, products.edit, products.archive, products.restore, products.delete.

Removed AdminProductsController's class-level Administrator Roles decorator and its unused Role/Roles imports. Each handler explicitly declares its operation's permission, so the class restriction cannot conflict with PermissionsGuard. CatalogController had no role metadata; only its product reads received permission decorators. No class-wide permission was added to this mixed-purpose controller, leaving categories and POS menu access unchanged.

No guard implementation or registration changed. SessionAuthGuard still runs first, followed by PermissionsGuard and RolesGuard. PermissionsGuard resolves current database memberships for each migrated request. There is no role-or-permission fallback, no implicit grant from a legacy Administrator label, and no trust in frontend permission state.

Controller paths, DTOs, responses, service calls, actor attribution, and product business rules are unchanged. Delete eligibility is read-only and requires products.view; the actual delete independently requires products.delete. Creation does not imply edit, nor does edit imply creation or deletion. An initially empty recipe is still handled by the existing PUT replacement operation and requires products.edit.

## 3. Tests added

`ims-backend/src/catalog/products-authorization.spec.ts`: **117 cases** using an in-process Nest HTTP application with real controllers, SessionAuthGuard, PermissionsGuard, RolesGuard, and PermissionResolver. Only session validation, Prisma reads, and business services are mocked. No real database or account mutations occur.

Coverage includes:

- Every mapped handler has the expected permission and no conflicting Roles/Public metadata; every AdminProductsController handler is represented.
- Administrator with catalog grants can call all migrated endpoints.
- Custom role on a legacy Staff identity can call each endpoint with its exact grant, including read-only product access.
- Missing grants produce HTTP 403 before business services execute.
- Missing sessions produce HTTP 401 before permission lookup or business services execute.
- products.view alone cannot perform any mutation, including edits and permanent deletion.
- Legacy Administrator status cannot bypass a missing grant.
- Legacy Staff/POS grants do not imply products.view or product administration.
- Session-only categories, POS menu, and availability endpoints retain their behavior, including unauthenticated denial.
- Invalid/revoked sessions fail; revoked grants take effect on the next request; inactive database users and unknown permission keys cannot grant access.
- The migrated permission set exactly matches the six existing backend Products catalog keys.

Existing product-management service tests were also run to preserve deletion eligibility/history protections and creation/availability transaction behavior. Existing RBAC tests cover grant union, freshness, configuration conflicts, and legacy guard behavior.

## 4. Validation results

From `ims-backend`:

- `npx tsc --noEmit -p tsconfig.build.json`: passed.
- `npx jest --runInBand src/catalog/products-authorization.spec.ts src/catalog/product-management.service.spec.ts src/auth/rbac/rbac.spec.ts`: **3 suites, 146 tests passed** (117 new authorization, 13 existing product-service, 16 RBAC foundation cases).
- `npx eslint src/catalog/admin-products.controller.ts src/catalog/catalog.controller.ts src/catalog/products-authorization.spec.ts`: passed with no errors or warnings.
- Targeted Prettier and `git diff --check -- ims-backend/src/catalog`: passed.

These are HTTP authorization integration tests with mocked persistence/business services, plus existing business-rule unit tests. They do not claim live database integration or authenticated browser end-to-end coverage. No migrations, schema generation, seed operations, or live mutations were run.

## 5. Compatibility and frontend audit

Administrator's seeded catalog grants permit all Product operations. A custom role with products.view can now access product reads regardless of its legacy role. Staff's seeded grants do not include Products permissions, so Staff remains denied from product administration. The previously session-only GET /products and GET /products/:id/variants now also require products.view and return 403 for Staff/Manager without an additional product grant. This is an intentional consequence of the requested product-read mapping.

The active frontend POS menu uses `/pos/menu`, which remains session-only. Categories and the separate availability endpoint remain unchanged; this phase does not migrate POS or Availability. No claim is made that all product-shaped data elsewhere in the application is now protected by products.view: the shared operational menu is an explicit unmigrated boundary.

Frontend checks use the same six existing Product keys. Product list/create/edit/archive/restore/delete controls align with the endpoint mapping. Recipe editing uses products.edit, with an additional frontend inventory.view requirement for its material picker.

**Known action mismatch, retained under the explicit no-frontend-changes rule:** Phase 3C gates Add Variant and its creation dialog with products.edit, and also gates Delete Variant with products.edit. This phase explicitly requires products.create for POST variant and products.delete for DELETE variant. Consequently an edit-only user may see those buttons but receive 403, while a create-only or delete-only user may not see the matching variant action. Administrators with all grants are unaffected. A later frontend alignment must update both the buttons and the shared variant form dialog; backend policy must not be weakened to match the current UI. The existing catalog's broad products.edit description still mentions variants; this phase changes no catalog labels or grants.

Other module APIs continue enforcing their prior authorization. For example, product recipe pickers may still encounter an Inventory legacy-role denial for a custom role until that module is migrated separately.

## 6. Files changed in this phase

Modified:

- `ims-backend/src/catalog/admin-products.controller.ts`
- `ims-backend/src/catalog/catalog.controller.ts`

Created:

- `ims-backend/src/catalog/products-authorization.spec.ts`
- `RBAC_PHASE_3D1_PRODUCTS_AUTH_REPORT.md`

No services, DTOs, guard implementations, auth/public routes, frontend files, catalog keys/grants, Prisma files, or database records changed in this phase. Prior-phase dirty files in the workspace were preserved.

## 7. Explicit confirmations

Products backend authorization migration: **IMPLEMENTED** for the 19 mapped endpoints.

Inventory migration: **NOT IMPLEMENTED**.

Users migration: **NOT IMPLEMENTED**.

Reports migration: **NOT IMPLEMENTED**.

POS, Suppliers, and other module migrations: **NOT IMPLEMENTED**.

Frontend changes: **NONE**.

Database changes: **NONE**.

Prisma/schema/migration changes: **NONE**.

Stopped after Products authorization migration.
