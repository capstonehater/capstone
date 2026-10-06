# RBAC Phase 2 UI Report

Date: 2026-09-29. Status: Phase 2 complete.

## Scope and interpretation

The request initially prohibits backend changes but explicitly permits the required endpoints when APIs are missing. Phase 1 supplied models and authorization infrastructure without role-management APIs, so this phase adds only a roles controller/service/module and its registration. Existing authentication, guards, controller authorization, Prisma schema, migrations, and user-assignment flows were not changed in this phase.

## 1. Route created

`/admin/roles`, under the existing Administrator-only admin layout, using AdminDashboardLayout and AdminSectionHeader. A static Roles & Permissions link was added to the existing Management sidebar group. This is discoverability only: no navigation filtering or access-rule changes were introduced.

## 2. Frontend components and experience

- `RolesWorkspace`: searchable role directory with descriptions, counts and selection highlight; selected role details; edit/save/cancel; unsaved changes bar; loading, empty, success and error states; retry/reload control.
- `RolePermissionMatrix`: groups the server's permission catalog by module and renders labeled ON/OFF switches; no local permission catalog or arbitrary-key input.
- `RoleDialog`: native modal dialog for role creation and deletion confirmation, with focus containment, Escape handling, busy-state close prevention, and a scrollable body.
- Shared field rendering supports name and description validation in both create and edit modes.

White panels, navy primary actions, green enabled switches/selection, orange destructive controls, compact role rows, and a stacked mobile layout follow the current system style. Search covers role name and description. The page contains a clear notice that saving configuration does not change current feature access until the enforcement rollout.

Unsaved edits are confirmed before switching roles, cancelling, reloading, starting another role, closing creation, or following links; browser unload also warns. Browser-native back/forward inside the SPA is not intercepted, so this is not a complete router navigation blocker.

## 3. APIs used and added

All new endpoints use the existing global session authentication and controller-level `@Roles(Role.ADMINISTRATOR)`. No permission-decorator migration was performed.

| Method/path | Purpose |
| --- | --- |
| GET `/roles` | List persisted roles, stable keys, descriptions, system/protected flags, revisions, member counts, and granted permission keys. |
| GET `/roles/permissions` | Return database permission catalog entries recognized by the code-managed catalog. |
| POST `/roles` | Create a custom role and selected permission grants. |
| PATCH `/roles/:id` | Atomically update display name, description and permission grants using the submitted revision. |
| DELETE `/roles/:id` | Delete an unassigned, unprotected custom role using its revision. |

Permission updates are included in PATCH rather than a separate endpoint to avoid partially saving role details and grants. These are the only added application APIs. `src/lib/roles.ts` uses the existing credentialed API client.

Creation accepts `{name, description, permissionKeys}`; update adds `revision`; delete accepts `{revision}`. The backend generates stable custom keys independently of display names. DTO validation rejects extra properties, including attempts to change system/protected flags, role keys, or memberships.

## 4. Permission matrix

The catalog is fetched from `/roles/permissions`; labels, descriptions, modules, and keys all originate from backend records. The matrix renders only returned entries and toggles those keys. Existing role grants are returned with each role. No frontend-only permissions or made-up example roles are seeded.

Server validation checks every submitted key against both the code-managed catalog and database rows. Unknown, duplicate, or stale catalog submissions are rejected. Names have length/trim validation and case-insensitive duplicate checks. Requests are capped to bounded arrays and text lengths.

## 5. Protected roles and data integrity

- Delete is disabled for protected/system roles and for roles with members; backend enforces the same rules independently.
- All three Phase 1 system roles are protected, not just Administrator.
- Protected status and stable keys cannot be edited through the form or API.
- Administrator is identified by its stable `ADMINISTRATOR` key, not its display name. Removing all its grants is rejected by both UI and backend.
- Existing legacy Administrator authorization remains authoritative, so changing these grants does not currently remove the operator's admin access.
- Writes run in serializable transactions. Revision comparison rejects stale saves/deletions; uniqueness/serialization/reference conflicts return actionable conflict responses.
- Role details and grants change atomically with an AuthorizationAuditEvent containing whitelisted before/after role configuration and actor ID. Passwords, tokens and session data are not included.
- Delete rejects assigned roles; it does not silently unassign users.

Future permission-based administration will still require a reviewed administrative grant ceiling and last-effective-administrator policy before endpoint migration. This phase does not claim to implement those future delegation rules.

## 6. Files changed in this phase

Frontend created:
- `ims-frontend/src/app/admin/roles/page.tsx`
- `ims-frontend/src/components/admin/roles/RolesWorkspace.tsx`
- `ims-frontend/src/components/admin/roles/RolesWorkspace.module.css`
- `ims-frontend/src/components/admin/roles/RolePermissionMatrix.tsx`
- `ims-frontend/src/components/admin/roles/RoleDialog.tsx`
- `ims-frontend/src/lib/roles.ts`

Frontend modified:
- `ims-frontend/src/components/layout/shell-navigation.ts` (static link only)

Backend created under the missing-API exception:
- `ims-backend/src/roles/roles.controller.ts`
- `ims-backend/src/roles/roles.service.ts`
- `ims-backend/src/roles/roles.dto.ts`
- `ims-backend/src/roles/roles.module.ts`
- `ims-backend/src/roles/roles.service.spec.ts`

Backend modified:
- `ims-backend/src/app.module.ts` (register RolesModule)

Documentation created: `RBAC_PHASE_2_UI_REPORT.md`.

Pre-existing uncommitted Phase 1 and header-design changes were preserved; they are not Phase 2 changes.

## 7. Database changes

Schema changes: **NONE**. Migrations: **NONE**. Catalog seed changes: **NONE**. No live create/edit/delete operation was run during verification. Existing Phase 1 rows were read for the matrix render check. On user request through the new UI, the new APIs persist role configuration and authorization audit events in the existing tables.

## 8. Checks performed

- Frontend TypeScript: passed, including create/edit/delete flow types.
- Backend production TypeScript: passed.
- Targeted frontend/backend lint: passed.
- Focused roles-management tests: **12 passed** (controller Administrator restriction, database list/catalog shape, creation/audit, unknown permission rejection, stale writes, permission updates, protected/system deletion, Administrator minimum grants, assigned-role deletion, custom deletion/audit).
- `/admin/roles`: development-server HTTP **200** after fixing a source encoding issue caught by the route smoke check.
- Permission matrix server-render smoke check: **34 actual database catalog permissions** rendered into module groups with one switch per permission.
- Unauthenticated GET `/roles` and `/roles/permissions`: **401** from the running backend.
- Diff whitespace check: passed.

No full authorization migration suite was run. No authenticated browser session was automated, so visual layout and interactive flows were checked through source, compilation, focused service tests, route response, and static matrix rendering rather than a complete browser click-through. Mutation tests use mocked database transactions and do not substitute for future integration/concurrency tests.

## 9. Known limitations

- Only existing legacy Administrators can use the page/APIs.
- Roles can be configured, but no new assignments can be made here. Example Inventory Manager/Cashier/Supervisor roles appear only after someone creates them; they are not fabricated.
- Existing feature access is unchanged; existing controllers still use legacy authorization.
- Catalog includes only the Phase 1 supported permissions; this phase does not introduce new permission keys.
- Protected roles remain editable except for identity/protection and the Administrator minimum-grant rule. Broader Phase 3 governance must be implemented before these grants control administrative access.
- Roles with members cannot be deleted; reassignment belongs to a future phase.

## 10. Explicit confirmations

User assignment: **NOT IMPLEMENTED**.

Frontend permission checks: **NOT IMPLEMENTED**.

Navigation filtering: **NOT IMPLEMENTED**.

Authentication/guard changes: **NONE**.

Existing controller authorization changes: **NONE**.

Prisma schema/migration changes: **NONE**.

Phase 2 stops here.
