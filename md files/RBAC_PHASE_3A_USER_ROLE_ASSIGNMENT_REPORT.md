# RBAC Phase 3A — User Role Assignment Report

Date: 2026-09-29. Status: completed. References: RBAC_PHASE_1_BACKEND_REPORT.md and RBAC_PHASE_2_UI_REPORT.md.

## 1. APIs created

All routes are under the existing cookie/session authentication and an Administrator-only controller using the unchanged legacy RolesGuard.

| Endpoint | Contract |
| --- | --- |
| GET `/users/:id/roles` | Returns assigned role identifiers, stable keys, names/descriptions, protected and compatibility flags, assignment timestamps/actor IDs, and the union of known effective permission keys. Inactive accounts receive an empty effectivePermissions array. |
| POST `/users/:id/roles` | Accepts `{roleId}` or `{roleIds: [...]}`, exclusively. Adds memberships; rejects existing assignments. The batch form supports the checkbox modal's atomic save. |
| DELETE `/users/:id/roles/:roleId` | Removes a permitted membership, not the AccessRole record. |

Parameters require UUIDs; batch input allows 1–50 unique role IDs. Unknown users/roles/memberships produce not-found errors; duplicates and concurrent changes produce conflicts. Existing user API contracts and feature endpoint policies are unchanged.

## 2. Database usage and compatibility

No schema or migration changes. Reuses AccessRole, UserRole, RolePermission, Permission, AuthorizationAuditEvent, and AuthSession.

Assignments persist assignedByUserId from the authenticated actor, with assignedAt supplied by the existing database default. The UserRole composite primary key prevents duplicates, including races. Role-change audit events and session revocation are committed atomically with the membership write using serializable transactions. Audit payloads contain only role IDs/keys and assignment deltas, not passwords or sessions.

The Phase 1 database trigger continues synchronizing compatibility membership on user creation and legacy User.role changes. Assignment/removal APIs never overwrite User.role. A membership matching the current legacy role is intentionally not independently removable: use Edit User to change that role so the scalar and compatibility membership cannot diverge. Additional system/custom role memberships may be assigned; removing a system membership does not delete the protected role definition.

No live user assignments were changed during verification. The migration regression check used a temporary isolated database and removed it afterward.

## 3. User Management UI changes

A Roles section appears below the selected user's profile and above its existing tabs. It displays assigned-role badges and labels the compatibility membership as linked to the legacy role.

Assign Role opens a modal with roles fetched from the Phase 2 roles API. Already-assigned roles are checked and disabled; additional roles can be selected. Save Roles sends a single batch request so it cannot partially apply a selection or fail halfway through after self-session revocation. Closing with a pending selection asks for confirmation.

Each removable badge has a Remove action opening a confirmation naming both the user and role. Compatibility removal is disabled with an explanation. Loading, empty, retry, mutation-error, success, and busy states are included. Backend failures keep the dialog open.

The UI explains that feature access continues to follow the legacy role until the later enforcement migration. It warns that role changes revoke the target's active sessions. When editing another user, roles and session data are refreshed. When changing one's own additional roles, the browser returns to login with a full reload so the existing authentication bootstrap sees the revoked session.

The existing Permissions tab, user profile flows, filters, password setup, and legacy role editor remain intact. No can() helper or frontend permission-based hiding was introduced.

## 4. Security and safeguard behavior

- Only legacy Administrators are admitted by the new controller. Mutation services also re-read the actor and require an active legacy Administrator, protecting against stale actor state and direct service misuse.
- Non-Administrators cannot self-escalate. Existing active legacy Administrators may manage their own additional roles under this phase's explicit administration policy; their sessions are revoked afterward.
- Removing the last active protected Administrator membership is rejected. Other counted accounts must be both ACTIVE and isActive and hold the protected ADMINISTRATOR role.
- Matching compatibility memberships cannot be independently removed, including protected Administrator/Staff/Manager roles.
- Existing self-edit, self-suspension/deletion, and last legacy Administrator safeguards are retained. The existing account-suspension/deletion safeguard now additionally checks the last active Administrator membership, including users whose scalar role is Staff but who hold the Administrator AccessRole.
- Legacy Administrator demotion continues through the existing checked transaction and Phase 1 trigger. Existing session-revocation/account-status/password rules remain; membership changes add revocation with reason role_membership_changed.
- Duplicate membership checks and database uniqueness are both used. Role existence, membership writes, audit events, and session revocation occur within the transaction.
- Protected AccessRole records are not modified/deleted by assignment operations. Existing Phase 1 protection and Phase 2 role-deletion checks remain in place.

“Effective Administrator” in this compatibility phase means active membership in the protected stable ADMINISTRATOR role. Arbitrary custom grant combinations are not treated as equivalent administrators. Broader administrative permission semantics must be defined before the later feature-enforcement migration.

## 5. Tests and checks

Added `src/users/user-roles.service.spec.ts`: **16 passing tests** covering:

1. Assignment, actor attribution, audit, and session revocation.
2. Atomic batch creation and unchanged scalar role.
3. Custom membership removal.
4. Last active Administrator membership removal rejection.
5. Removal of an extra Administrator membership when another active holder remains.
6. Protected compatibility membership behavior.
7. Duplicate existing memberships and duplicate/ambiguous input.
8. Unknown roles rejected before writes.
9. Non-Administrator self-escalation rejected.
10. Existing Administrator self-assignment allowed.
11. Inactive actor rejected.
12. Union permission output.
13. Legacy role guard decisions.
14. Existing account safeguards protect effective and legacy Administrators.

Additional verification:

- Backend production TypeScript check: passed.
- Frontend TypeScript check: passed.
- Targeted backend/frontend lint: passed.
- Users page HTTP smoke check: 200.
- Unauthenticated user-role GET: 401.
- Existing isolated PostgreSQL migration regression: passed, including compatibility trigger synchronization, session preservation, role protection and history preservation.
- Diff whitespace check: passed.

Service tests mock database transactions; concurrency safety uses existing composite uniqueness and serializable isolation, but no real concurrent browser/API mutation test was performed. No authenticated browser click-through or live user mutation was performed.

## 6. Files changed in Phase 3A

Backend created:
- `ims-backend/src/users/user-roles.controller.ts`
- `ims-backend/src/users/user-roles.service.ts`
- `ims-backend/src/users/user-roles.service.spec.ts`
- `ims-backend/src/users/dto/assign-user-role.dto.ts`

Backend modified:
- `ims-backend/src/users/users.module.ts` — register assignment controller/service.
- `ims-backend/src/users/users.service.ts` — extend existing Administrator-removal account safeguards; retain legacy checks.

Frontend created:
- `ims-frontend/src/lib/users.ts` — user-role API contracts and calls. Existing general user-management APIs stay in user-management.ts.
- `ims-frontend/src/components/admin/users/UserRolesSection.tsx`
- `ims-frontend/src/components/admin/users/UserRolesSection.module.css`

Frontend modified:
- `ims-frontend/src/components/admin/users/UsersWorkspace.tsx` — mount Roles section and refresh session data after changes.

Documentation created: `RBAC_PHASE_3A_USER_ROLE_ASSIGNMENT_REPORT.md`.

Earlier uncommitted changes from prior phases remain in the workspace and were not reclassified as Phase 3A work.

## 7. Known limitations

- Added Administrator AccessRole membership does not grant current legacy admin route access to a Staff account. Change the legacy role through its existing editor if current Administrator access is required.
- Configured permissions are a union without deny overrides. Inactive-account status still blocks access.
- The legacy-linked membership must be edited through the scalar role editor, not removed through the new modal.
- Assignment events are stored in AuthorizationAuditEvent; the existing user activity timeline was not expanded to display these events in this phase.
- Existing permission enforcement, landing routes, and navigation filtering are unchanged. No new permission key or catalog migration was introduced.

## 8. Explicit confirmations

Permission enforcement migration: **NOT IMPLEMENTED**.

Navigation filtering: **NOT IMPLEMENTED**.

Frontend permission checks: **NOT IMPLEMENTED**.

User.role/Role enum removal: **NONE**.

Authentication replacement: **NONE**.

Schema/migration changes: **NONE**.

Phase 3A stops here.
