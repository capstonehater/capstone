# Role and Permission System Audit

Date: 2026-09-29. Status: Phase 1 completed; design proposal only.

## Scope and preservation

This audit inspected the current repository's Prisma schema, authentication/session services, controller decorators, user-management safeguards, frontend guards, navigation, and user permission display. No authentication, application code, existing roles, guards, schema, or migrations were changed for this task. Findings describe source behavior, not a penetration test or a live database user census. Existing unrelated workspace changes were left intact.

The application already has role-based authorization, but it does not have configurable permissions or multiple roles per user. Extend the current system incrementally; do not replace session authentication or interpret the existing permission display as the source of authority.

## 1. Current role implementation

- Prisma `enum Role` has `ADMINISTRATOR`, `MANAGER`, and `STAFF`. `User.role` is a required scalar field, with role and role/account-status indexes. There are no Role, Permission, RolePermission, or UserRole tables.
- Backend `ALL_ROLES` repeats these three values. `AuthenticatedUser` contains a single `role`, alongside user identity, active status, and session ID.
- Frontend `Role` and `AuthUser` also contain one role. User-management create/update DTOs use `AssignableUserRole`; Administrator and Staff are assignable, while Manager is reserved in the management UI.
- These labels are authorization identifiers, not editable records. Creating an Inventory Manager or Supervisor currently requires code/schema changes.

Sources: [schema](ims-backend/prisma/schema.prisma), [role constants](ims-backend/src/common/constants/roles.ts), [user constants](ims-backend/src/users/users.constants.ts), [request principal](ims-backend/src/common/types/authenticated-user.type.ts), [frontend auth types](ims-frontend/src/lib/auth.ts).

## 2. Current permission checks

`@Roles(...)` attaches allowed-role metadata. `RolesGuard` reads handler metadata before controller metadata and checks whether `user.role` is included. A route without role metadata passes this guard; global session authentication still applies unless explicitly public. There is no permission-key decorator, permission resolver, inheritance, allow/deny matrix, or database-backed action grant.

The Users Permissions tab uses a local `permissionsByRole` map. Administrator receives module descriptions; Staff shows Staff Dashboard and POS; Manager shows no application permissions. These descriptions do not enforce anything and are incomplete compared with backend access. For example, Staff can record waste and post stock runs through authorized APIs.

Sources: [Roles decorator](ims-backend/src/auth/decorators/roles.decorator.ts), [Roles guard](ims-backend/src/auth/guards/roles.guard.ts), [Users workspace](ims-frontend/src/components/admin/users/UsersWorkspace.tsx).

## 3. Current users and role relationships

Every user has exactly one legacy role, plus `accountStatus`, `isActive`, password/account metadata, sessions, and links to business actions. Those business relationships must remain associated with the same user IDs during migration. An account's enabled state is independent of its role.

Current protections in `UsersService` include rejecting self role changes, self suspension/deletion, protecting the last active Administrator on relevant mutations, and revoking sessions after role/login-identifier changes or suspension. Sensitive mutations use serializable transactions. Preserve these protections and adapt them to role membership and effective administrative authority, rather than removing them with the scalar role.

User management supports listing/filtering by one role, editing one assignable role, account setup/reset, session revocation, and activity display. It does not support role collections or role-grant history. No live users were enumerated during this audit; a future migration must run aggregate preflight checks for role counts, active administrators, and unsupported legacy accounts.

Sources: [Users service](ims-backend/src/users/users.service.ts), [user mapper](ims-backend/src/users/user.mapper.ts), [create DTO](ims-backend/src/users/dto/create-user.dto.ts), [update DTO](ims-backend/src/users/dto/update-user.dto.ts).

## 4. Current frontend access control

- `/admin` layout allows only Administrator; `/staff` allows only Staff through the client-side `AuthGuard`.
- Default routes are Administrator -> `/admin/dashboard`, Staff -> `/staff/dashboard`, Manager -> `/login?unsupportedRole=MANAGER`.
- `AuthBootstrap` calls `/auth/me`; Zustand holds an in-memory user and authentication status. No effective permission collection is provided.
- Sidebar navigation is defined by application area, not permission keys. Pages and actions generally rely on area access and backend checks.
- An Inventory Manager role with `inventory.view` would still fail the current Administrator-only layout. Merely filtering navigation or adding a role selector cannot solve this.
- Composite workspaces load multiple data sources: Inventory loads summaries, units, suppliers, stock runs, and reports. A future inventory-only user must not trigger unauthorized report/stock-run requests on mount. Gate data loading as well as rendering, including report modals and global alert counters.

Sources: [admin layout](ims-frontend/src/app/admin/layout.tsx), [staff layout](ims-frontend/src/app/staff/layout.tsx), [AuthGuard](ims-frontend/src/components/auth/AuthGuard.tsx), [bootstrap](ims-frontend/src/components/auth/AuthBootstrap.tsx), [auth store](ims-frontend/src/store/authStore.ts), [navigation](ims-frontend/src/components/layout/shell-navigation.ts), [Inventory workspace](ims-frontend/src/components/admin/inventory/InventoryWorkspace.tsx).

## 5. Current backend authorization and sessions

`AuthModule` registers global SessionAuthGuard followed by RolesGuard. SessionAuthGuard bypasses explicitly public routes, otherwise reads the session token and asks SessionService to validate it. Sessions are opaque tokens stored as hashes in `AuthSession`, not role-bearing JWTs. Each validation loads the current user and checks revocation, absolute/idle expiry, active account status, and password-change time. Authentication cookies are HTTP-only with secure/same-site settings supplied by configuration. Existing origin checks, login throttling, and password-reset behavior should remain independent of RBAC.

### Observed endpoint access

| Endpoint family | Current role gate | Migration implication |
| --- | --- | --- |
| `/users` and user/session administration | Administrator | Split view, manage, role assignment, and session revocation as needed; retain service safeguards. |
| `/admin/products`, variants, recipe/usage and lifecycle operations | Administrator | Distinguish read/create/edit/archive/restore/delete; recipe operations must map explicitly. |
| Material and supplier reads, units, batches, inventory summaries/history | Administrator, Staff | Preserve Staff read access, including supporting selectors. |
| Material create/edit/archive; supplier create/edit/delete; store availability lookup/search | Administrator | Separate inventory and supplier actions; lookup/search belongs to an explicit permission. |
| `/inventory/waste` | Administrator, Staff | Map to `inventory.waste`. |
| Stock-run list/detail/create/edit/items/delete/post (including delete aliases) | Administrator, Staff | Separate permissions and cover every alias. Staff is not currently read-only. |
| `/reports/*` | Administrator | Reporting read permission must cover dashboard consumers too. No distinct export authorization currently exists. |
| `/forecasting/*` | Administrator | Map current read endpoints; future settings/mutations need separate policy. |
| `/alerts/*` including acknowledge/dismiss | Administrator | Add alert permissions even though omitted from the requested example groups. |
| `/settings/account`, account update/change-password | Administrator, Staff, Manager | These are self-service, not global system administration. Preserve own-account access. |
| `/orders` list/detail/refund | Administrator, Staff | Split POS history/read and refund; retain transaction business rules. |
| `/pos/checkout` | Authenticated, no `@Roles` | Explicitly decide intended checkout access; do not silently broaden/restrict during compatibility migration. |
| Catalog/categories/products/variants, `/pos/menu`, variant availability | Authenticated, no `@Roles` | Not public merely because the role decorator is absent. Give an explicit authenticated or permission policy. |
| `/auth/me`, logout | Authenticated | Remain authentication operations, not configurable business permissions. |
| Login, forgot/reset password | Explicitly public | Preserve public authentication flow and existing checks. |
| Root application GET | No role metadata | Inventory this route explicitly in the future route policy audit. |

Manager's frontend is unsupported, but settings explicitly admits it and undecorated authenticated APIs do not reject it by role. Therefore “Manager has no permissions” is not an accurate statement about backend enforcement. Whether an individual Manager can authenticate also depends on account/session conditions; no live login was tested.

Sources: [AuthModule](ims-backend/src/auth/auth.module.ts), [session guard](ims-backend/src/auth/guards/session-auth.guard.ts), [SessionService](ims-backend/src/auth/session.service.ts), [auth controller](ims-backend/src/auth/auth.controller.ts), [inventory controller](ims-backend/src/inventory/inventory.controller.ts), [stock-run controller](ims-backend/src/stock-runs/stock-runs.controller.ts), [product administration](ims-backend/src/catalog/admin-products.controller.ts), [catalog](ims-backend/src/catalog/catalog.controller.ts), [orders](ims-backend/src/orders/orders.controller.ts), [reports](ims-backend/src/reports/reports.controller.ts), [forecasting](ims-backend/src/forecasting/forecasting.controller.ts), [alerts](ims-backend/src/alerts/alerts.controller.ts), [settings](ims-backend/src/settings/settings.controller.ts), [availability](ims-backend/src/availability/availability.controller.ts).

## 6. Missing capabilities and design risks

1. No configurable role CRUD, role descriptions, permission catalog, many-to-many assignments, or `/admin/roles` page.
2. No per-action enforcement or authoritative effective-permissions response.
3. Static permission descriptions differ from actual API grants.
4. No role-change audit trail dedicated to grants/revocations and no concurrency/version policy for role editors.
5. Multiple roles, role deletion, protected administrative access, and permission-change invalidation need defined semantics.
6. Missing role metadata means authenticated access today. A future default-deny guard cannot be activated globally until every endpoint is classified.
7. `inventory.adjust` is a proposed capability; the inspected inventory controller has no general manual-adjustment endpoint. Likewise a permission key does not itself implement export or a new workflow.
8. Frontend role-only routing would block custom roles, while eager data fetching would produce avoidable 403 errors after partial access is introduced.

## 7. Recommended RBAC architecture (proposal)

### Data model

Keep `User.role` temporarily as the legacy compatibility field. Prisma already has an enum named `Role`; use a distinct model name such as `AccessRole` initially (mapped to `roles`) to avoid a name collision. Renaming/removing the enum belongs to a later approved cleanup.

| Model | Proposed fields and constraints |
| --- | --- |
| AccessRole | UUID id; stable unique key; unique normalized name; description; isSystem/isProtected; createdAt/updatedAt; revision for optimistic concurrency. |
| Permission | UUID id; unique stable key; module; human-readable label/description. Catalog is code-managed, not arbitrary administrator-entered keys. |
| RolePermission | roleId + permissionId composite primary key and foreign keys; permissionId index. |
| UserRole | userId + roleId composite primary key; roleId index; assignedAt and nullable assignedByUserId. Explicit actor relation distinct from member relation. |
| AuthorizationAuditEvent | actor, target role/user, operation, before/after grants, timestamp, request correlation; retain history when roles are removed. |

Use foreign keys and transactions. Reject deletion of protected roles and deletion of assigned roles until users are reassigned. Display names must never be used as authorization keys. Audit records must not contain credentials or session tokens.

### Permission semantics

Recommend union-of-grants across assigned roles: permission is allowed if any role grants it. OFF means “this role does not grant,” not an explicit denial overriding other roles. Label this clearly in the UI. No role hierarchy, deny overrides, or per-user exceptions in the first implementation. These would add separate policy complexity beyond the requested matrix.

Require all declared action prerequisites by default; use explicit any-of policies only where intentional. Do not silently infer that edit grants view: either validate dependencies when saving or display and add required view grants with clear user feedback. Unknown keys are rejected. Service-level resource and business rules remain mandatory even when the permission is granted.

Use a protected Administrator system role with the approved catalog explicitly seeded. New permission keys require a reviewed seed/policy update; avoid undocumented wildcard grants. Keep at least one active protected administrator, including concurrent edits to role membership, permissions, and account status.

### Initial permission catalog to review

| Group | Proposed keys |
| --- | --- |
| Dashboard | `dashboard.view` (must address which metrics/report endpoints it permits) |
| Inventory | `inventory.view`, `inventory.create`, `inventory.edit`, `inventory.archive`, `inventory.waste`; reserve `inventory.adjust` until workflow exists |
| Products | `products.view`, `products.create`, `products.edit`, `products.archive`, `products.restore`, `products.delete` |
| Stock Runs | `stockRuns.view`, `stockRuns.create`, `stockRuns.edit`, `stockRuns.delete`, `stockRuns.post` |
| Suppliers | `suppliers.view`, `suppliers.create`, `suppliers.edit`, `suppliers.delete`, `suppliers.searchAvailability` |
| Reports | `reports.view`; `reports.export` when export is implemented and enforced |
| Forecasting | `forecasting.view`; separate manage permission for future configuration mutations |
| Recommendations | `recommendations.view` for applicable implemented workflows; do not suggest the placeholder is complete |
| Users | `users.view`, `users.manage`, `users.assignRoles`, `users.sessions.revoke` |
| Roles & Permissions | `roles.view`, `roles.manage` |
| Settings | `settings.manage` for global settings only; own-account/password access remains authenticated self-service |
| POS | `pos.view`, `pos.checkout`, `pos.orders.view`, `pos.refund` |
| Alerts | `alerts.view`, `alerts.acknowledge`, `alerts.dismiss` |

Product edit can initially cover variant/recipe edits, with this scope disclosed. Separate granular keys later if required. Units and catalog/availability reads need explicit prerequisite policies so forms work without granting unrelated administration. Dashboard/report overlap must be resolved at endpoint level, not by granting full financial reports merely to render a dashboard.

### Backend enforcement and escalation protection

Add a permission resolver and a metadata-based PermissionsGuard after authentication in a future phase. Resolve permissions from current database memberships on each request initially; current session validation already consults the database. If caching is later needed, key it by authorization revision and invalidate all affected members on role changes.

For permission-managed endpoints, avoid a legacy role check that vetoes otherwise valid custom roles, and avoid a legacy OR fallback that bypasses a removed permission. Define one authoritative policy mode per route during migration. Unmigrated routes retain their existing role policy. After coverage is complete, protected business routes without policy fail closed; explicitly authenticated and public routes remain declared exceptions.

Do not allow `users.manage` alone to grant roles. Role definition/assignment require separate authority, and actors must not grant authority beyond their approved grant ceiling. Initially restrict role administration and protected-role assignment to protected administrators. Prevent self escalation through indirect edits to a role the actor belongs to. Preserve last-admin checks transactionally; destructive role changes and session invalidation must be atomic or reliably reconciled.

### Session and frontend integration

Extend `/auth/me` and login responses with `roles`, `effectivePermissions`, and an authorization revision while retaining legacy `role` for old clients. Revalidate UI permissions after role edits and on session refresh/focus; backend remains authoritative on every action. Retain existing role-change session revocation during compatibility migration; group-role changes must invalidate affected users as well.

Add `can(permission)`/`canAll(...)` helpers and per-route metadata. Filter sidebar links, hide unavailable modules, disable actions with understandable reasons where useful, and gate queries. Replace Administrator-only area access with appropriate permission-aware route access when custom roles are enabled. Select a deterministic first permitted landing page, including a no-access screen, instead of routing by an arbitrary first role. Keep auth cookies, CSRF protection, password handling, and account status checks unchanged.

### Planned UI

`/admin/roles` uses AdminDashboardLayout and the shared AdminSectionHeader. Left: searchable role list and Create Role action. Right: selected name, description, grouped permission toggles, member count, save/cancel and protected-role notice. Use navy navigation, white panels, compact tables, green enabled states, and the requested orange destructive actions. On narrow screens stack panels.

Create Role opens an accessible modal; grouped selection must resolve to the same individual permission keys as the editor. Show unsaved changes and save errors; reject stale writes using role revision. The user editor supports multiple roles and an effective-access preview explaining which role grants each permission. Replace the existing static Permissions tab with server-derived effective permissions. Do not implement these UI changes in Phase 1.

## 8. Compatibility and migration plan — approval required before implementation

1. Approve the catalog, endpoint mapping, Manager policy, administrative delegation rules, and union semantics. Capture current role/endpoint expectations as a baseline.
2. Back up and preflight the database. Add the new tables without removing the enum or scalar field. Seed Administrator/Staff/Manager compatibility records and backfill exactly one membership from every existing User.role. Verify counts and last-admin continuity; migration must be repeatable or safely tracked.
3. Seed grants from actual controller behavior, not the Users tab. Treat Manager's authenticated-only endpoints as an explicit compatibility decision; do not accidentally grant broad access or silently remove current access. Keep new business-role templates opt-in.
4. Introduce the permission resolver in shadow comparison mode while legacy checks remain authoritative. Record mismatches without changing outcomes; do not expose editable grants that cannot yet be enforced.
5. Move endpoint groups and their frontend consumers together to permission enforcement behind a controlled rollout. Do not enable multi-role assignment while compatibility fields/guards can produce divergent decisions. Avoid long-lived dual-write ambiguity: document which representation is authoritative at each stage.
6. Enable Roles & Permissions and multi-role assignment only after the required endpoints and routes honor effective permissions. Add role/assignment audit events and concurrency protections.
7. Remove legacy role types/checks only in a separately approved cleanup after all callers, exports, settings displays, filters, and default routes have migrated.

Rollback before custom assignments can return to legacy behavior using retained fields and verified backups. After arbitrary multi-role grants exist, a scalar role cannot represent equivalent permissions: freeze grant edits and explicitly reconcile assignments before any legacy rollback. Do not claim rollback is lossless at that stage.

## 9. Verification required in a future implementation

- Parameterized API tests for each role/permission and every controller endpoint/alias, including direct requests bypassing the UI, missing sessions, missing grants, and unknown permission keys.
- Multi-role union, dependency validation, no-role accounts, protected roles, and self/indirect escalation tests.
- Concurrent last-admin removal and stale role-editor saves; rollback of failed assignment/audit writes.
- Revoked sessions, permission removal during an active session, inactive accounts, and updates to roles shared by many users.
- Migration checks against legacy role/endpoint behavior, backfill counts, repeated migrations, and rollback constraints.
- Frontend navigation/deep-link protection, permitted landing pages, gated API calls, empty permission states, accessible toggles/modals, and responsive layout.

No feature implementation or migration was performed. This file is the Phase 1 deliverable; stop here pending design approval.
