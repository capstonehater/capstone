# RBAC Phase 1 Backend Report

Status: Phase 1 completed and applied to the local database. Scope: backend foundation only.

## Migration safety plan (recorded before applying the migration)

Current affected schema: `users.id` and `users.role` (existing Role enum: ADMINISTRATOR, STAFF, MANAGER). The migration retains every existing column, enum, user, account status, password, and AuthSession. New tables: access_roles, permissions, role_permissions, user_roles, authorization_audit_events. Only new foreign keys point at users; role-member deletion follows user deletion, assignment actor deletion nulls attribution without deleting another user's membership. Audit events retain historical IDs independently of entity deletion.

Compatibility: existing session and role guards remain; no existing route gains a permission decorator. The new guard is opt-in and performs no RBAC lookup on legacy routes. Backfill creates one compatibility membership per existing user. A database trigger keeps that membership synchronized for existing account creation and scalar-role edits; custom memberships are untouched. Existing self/last-administrator protections and session revocation remain in UsersService.

Seed policy: code-managed supported permissions are inserted in this migration, not by running the application's unrelated business-data seed. Administrator receives all supported catalog keys; Staff retains operational API grants; Manager receives only the currently authenticated-only catalog/POS grants. Own-account settings remain authenticated, not settings.manage. Manager's application routing remains unsupported and unresolved.

Rollback: because no endpoint is migrated, previous backend code can run with additive tables left in place. Prefer code rollback without deleting data. Removing tables requires a backup, dropping the new users trigger/functions, then dependent RBAC tables in dependency order. Audit events must be archived before any destructive rollback. Do not reset the database or modify historical migrations. Once custom grants are used in later phases, scalar-role rollback is not permission-equivalent.

Verification plan: unit tests for resolver/guards and an isolated PostgreSQL migration test; schema validation and backend type checks. Inspect pending migration history before any active-database deployment so unrelated migrations are not applied implicitly.


## 1. Database changes and new models

- `AccessRole`: UUID-generated string id, unique stable key and unique display name, description, system/protected flags, timestamps, revision (default 1).
- `Permission`: UUID-generated id, unique code-managed key, module index, label, description.
- `RolePermission`: composite primary key (roleId, permissionId), reverse lookup index, restrictive foreign keys.
- `UserRole`: composite primary key (userId, roleId), assignedAt, nullable assignedByUserId, separate member/assigner relations and indexes.
- `AuthorizationAuditEvent`: actor/target IDs, action, before/after JSON, timestamp and lookup indexes. IDs deliberately survive user/role deletion without foreign keys. This is an audit storage foundation, not an arbitrary JSON write API. Future writers must whitelist authorization fields and never include passwords, tokens, or sessions.

`User` gains relation fields only. `User.role`, the existing Role enum, authentication fields, and session tables are preserved. Model identity uses `AccessRole` to avoid colliding with the existing Prisma Role enum.

## 2. Migration details and deployment

New migration: `20260929000000_rbac_foundation`. Existing migrations were not edited. The new SQL explicitly wraps table creation, catalog seeding, role grants, membership backfill, and compatibility/protection triggers in one transaction.

Applied on 2026-09-29 to the configured local `ims_db`, after a verified custom-format pg_dump backup. Verified counts: **3 roles, 34 permissions, 6 memberships**. Every existing user has the compatibility membership matching the scalar role; a before/after count and fingerprint of user IDs/roles matched.

Backup: `backups/ims_db_before_rbac_20260929_065524.dump`. Its archive listing was successfully checked with pg_restore.

The database has an unrelated pending migration, `20260922000000_convert_voided_orders_to_refunds`. It was deliberately NOT applied. The new RBAC SQL was applied alone through psql with error-stop enabled, then recorded using `prisma migrate resolve --applied 20260929000000_rbac_foundation`. A general migrate deploy would also run the unrelated migration and was therefore not used. Future deployments must review that outstanding history; do not reset the database.

Prisma schema validation passed. Normal client generation encountered Windows' running-backend DLL lock; the generated model definitions were present, and generation also succeeded to a temporary workspace output. A fresh Prisma client read of the new database models was verified. No authentication process was replaced and no application dependency manifests were retained from temporary generation.

## 3. Permission catalog

The typed catalog lives in `src/auth/rbac/permission-catalog.ts`. The migration contains its seed snapshot; regression tests check seed key/count parity. Future catalog changes require a new migration. No runtime API accepts arbitrary keys.

| Module | Seeded keys |
| --- | --- |
| Dashboard | `dashboard.view` |
| Products | `products.view`, `products.create`, `products.edit`, `products.archive`, `products.restore`, `products.delete` |
| Inventory | `inventory.view`, `inventory.create`, `inventory.edit`, `inventory.archive`, `inventory.waste` |
| Stock Runs | `stockRuns.view`, `stockRuns.create`, `stockRuns.edit`, `stockRuns.delete`, `stockRuns.post` |
| Suppliers | `suppliers.view`, `suppliers.create`, `suppliers.edit`, `suppliers.delete`, `suppliers.searchAvailability` |
| Reports | `reports.view` |
| Forecasting | `forecasting.view` |
| Users | `users.view`, `users.manage`, `users.sessions.revoke` |
| POS | `pos.view`, `pos.checkout`, `pos.orders.view`, `pos.refund` |
| Alerts | `alerts.view`, `alerts.acknowledge`, `alerts.dismiss` |

### Requested keys deliberately deferred

The request also requires no keys for unsupported features. Consequently:

- `roles.view`, `roles.manage`: deferred until role-management APIs exist; foundation models alone do not make those workflows available.
- `users.assignRoles`: deferred for the future multi-role assignment operation. Current scalar-role edits remain part of legacy users.manage behavior and compatibility synchronization, not a new assignment API.
- `settings.manage`: deferred because current settings endpoints manage the signed-in user's account/password, not global settings. They remain available through existing session/role checks.
- `recommendations.view`: deferred for the standalone recommendations capability; its current page is a placeholder. Existing forecasting reads are represented by forecasting.view.

No inventory.adjust or reports.export key was invented. Dashboard permissions do not yet override or imply reports permissions; composite endpoint mapping remains future work.

## 4. Default role mapping

All three compatibility roles have stable enum-matching keys, readable names, and system/protected flags. Administrator receives every supported catalog key explicitly (no wildcard).

Staff receives: inventory.view, inventory.waste, suppliers.view, all five stockRuns keys, and all four POS keys. This preserves its actual read/operational API capabilities rather than assuming Staff is read-only. Current authenticated catalog/availability reads fit the POS-view compatibility scope; granular resource classification remains necessary when those routes migrate.

Manager receives only pos.view and pos.checkout, reflecting currently authenticated-only catalog/menu/availability and checkout endpoints. No Administrator-only or Staff-only API grant was invented. Existing settings self-service is unchanged. Manager's unsupported frontend route remains unchanged; whether Manager should receive a supported workspace is unresolved for a later phase.

New users created by existing flows receive the matching compatibility membership through `users_sync_legacy_access_role`. Existing scalar-role edits replace only the old compatibility membership and preserve unrelated memberships. Existing session revocation remains in UsersService. Backfilled/synchronized assignedByUserId is null because the database trigger has no trustworthy request actor; it does not fabricate attribution.

`access_roles_protect` rejects deletion of protected roles and changes to their id, stable key, system flag, or protected flag. Restrictive FKs independently prevent accidental deletion of referenced roles. There is no role deletion endpoint. Existing last-active-administrator checks still operate on legacy User.role. Future assignment/permission-edit APIs must additionally protect effective administrative authority transactionally; this phase does not claim those future checks are implemented.

## 5. Permission resolver

`PermissionResolver.resolve(authenticatedUser)` reads current database memberships and nested role grants, returns a deduplicated ReadonlySet of known permission keys, and unions all assigned-role grants. No deny overrides, role hierarchy, scalar-role fallback, or permission cache. Unknown database keys are ignored. Missing/inactive users produce no grants. Session validity is enforced by the existing SessionAuthGuard before permission evaluation.

Fresh reads mean grant changes are reflected on the next permission check without relying on frontend claims or session snapshots. No effective-permission fields were added to the existing API response contracts.

## 6. Permission decorator

`@RequirePermission('inventory.waste')` is available to future route migrations. Multiple arguments require ALL listed permissions. Unknown keys and empty lists are rejected during decorator construction. Handler metadata takes precedence over class metadata for permission requirements.

No existing controller uses this decorator in Phase 1.

## 7. Permission guard and compatibility policy

Global order: **SessionAuthGuard -> PermissionsGuard -> RolesGuard**.

- No permission metadata: immediate pass from PermissionsGuard, no RBAC database read, existing RolesGuard behavior unchanged.
- Permission metadata: validate known nonempty requirements, require authenticated principal, resolve database grants, reject missing grants.
- Permission metadata combined with any handler/controller Roles metadata or an effective Public marker is rejected as conflicting configuration. There is no role OR permission bypass and no silently restrictive dual-authority policy.
- A future migrated endpoint must have a single policy: remove inherited role restrictions or move it to a separately permission-managed controller. Public auth endpoints remain untouched.

This is an opt-in enforcement foundation, not a shadow rewrite of every endpoint. Existing routes without Roles metadata retain their existing authenticated-only behavior. No endpoint paths, request bodies, or response schemas changed.

## 8. Tests added and results

`src/auth/rbac/rbac.spec.ts`: 16 passing cases covering role-granted allow/deny, union/deduplication, all-of requirements, no legacy fallback, missing/inactive accounts, fresh revocation, existing role enforcement, no RBAC queries for legacy routes, unknown/empty keys, unrecognized database grants, conflicting policy, missing authentication, and seed/catalog parity.

`test/rbac_migration_test.py`: a real PostgreSQL test creates a uniquely named isolated database, installs a minimal legacy users/session fixture, runs the actual migration, and verifies:

- Membership backfill and preservation of legacy roles/sessions.
- Staff stock-run posting grant and no invented Manager administration grant.
- Protected Administrator deletion is rejected even after removing dependent memberships/grants inside a rolled-back subtransaction.
- Protected-role protection cannot be disabled.
- Existing user creation and scalar-role changes synchronize compatibility membership without duplicates.
- Audit historical IDs survive user deletion.

The temporary database is dropped in finally; the test refuses nonlocal database hosts. It requires PostgreSQL tools and a local database role with CREATE DATABASE permission. It never imports production business rows. This fixture is a migration regression test, not a full API end-to-end suite.

Validation completed:

- Prisma schema validation: passed.
- Backend production TypeScript check (`tsc --noEmit -p tsconfig.build.json`): passed.
- Full backend Jest suite: **17 suites, 103 tests passed**.
- Targeted ESLint for all changed/new auth TypeScript: passed.
- Isolated SQL migration regression: passed.
- Active-database backfill and legacy user-role preservation: passed.

## 9. Known limitations and next-phase boundaries

- No role CRUD, role assignment API/UI, role list endpoint, or frontend changes.
- Permission tables support multiple roles, but current business endpoints still authorize using the scalar role.
- Role revision is stored for future optimistic concurrency; no editor/API consumes it yet.
- Audit storage is prepared; no new role-mutation workflow exists to write detailed role-change events. Compatibility backfill is not represented as a human action.
- Protected-role deletion/identity is enforced in SQL; direct privileged database writes can still modify grants. Application users have no such endpoint. Future role management needs grant ceilings, self-escalation checks, last-effective-administrator safeguards, and audited transactional writes.
- Permission dependency validation, delegated administration, default-deny endpoint coverage, and session permission payloads belong to later phases.
- Existing unrelated frontend edits already in the workspace were preserved and not included in this phase.

## 10. Files created or modified

Modified:
- `ims-backend/prisma/schema.prisma`
- `ims-backend/src/auth/auth.module.ts`

Created:
- `ims-backend/prisma/migrations/20260929000000_rbac_foundation/migration.sql`
- `ims-backend/src/auth/rbac/permission-catalog.ts`
- `ims-backend/src/auth/rbac/permission-resolver.service.ts`
- `ims-backend/src/auth/rbac/rbac.spec.ts`
- `ims-backend/src/auth/decorators/require-permission.decorator.ts`
- `ims-backend/src/auth/guards/permissions.guard.ts`
- `ims-backend/test/rbac_migration_test.py`
- `RBAC_PHASE_1_BACKEND_REPORT.md`

The verified backup and temporary generation/deployment helpers are local artifacts, not application feature files. The earlier ROLE_PERMISSION_SYSTEM_AUDIT.md remains the planning reference.

## 11. Explicit confirmations

Frontend changes: **NONE in this phase**.

Authentication replacement: **NONE**.

Existing User.role removal: **NONE**.

API contract changes: **NONE**.

Roles UI: **NOT implemented**.

User multi-role assignment workflow: **NOT implemented**.

Frontend permission checks/navigation filtering: **NOT implemented**.

Phase 1 stops here.
