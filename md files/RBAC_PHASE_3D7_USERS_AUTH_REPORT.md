# RBAC Phase 3D-7 - Users Authorization Report

## Pre-change endpoint mapping

Reviewed Phase 3D6 and Phase 3A reports, UsersController/UsersService, role controllers, DTOs, session endpoints, account safeguards and frontend callers before changing code.

| Endpoint | Purpose | Previous authority | New permission |
| --- | --- | --- | --- |
| GET /users | Directory | Administrator + session | users.view |
| GET /users/:id | User detail | Administrator + session | users.view |
| GET /users/:id/activity | Activity | Administrator + session | users.view |
| GET /users/:id/sessions | Session metadata | Administrator + session | users.view |
| POST /users | Create and initiate setup | Administrator + session | users.manage; non-Administrators may create Staff only |
| PATCH /users/:id | Edit profile/legacy role | Administrator + session | users.manage; legacy role changes remain Administrator-only |
| POST /users/:id/suspend | Suspend | Administrator + session | users.manage |
| POST /users/:id/reactivate | Reactivate | Administrator + session | users.manage |
| POST /users/:id/password-reset | Setup/reset email | Administrator + session | users.manage |
| DELETE /users/:id | Delete | Administrator + session | users.manage |
| DELETE /users/:id/sessions/:sessionId | Revoke one session | Administrator + session | users.sessions.revoke |
| POST /users/:id/sessions/revoke-all | Revoke all sessions | Administrator + session | users.sessions.revoke |

Excluded: GET/POST /users/:id/roles, DELETE /users/:id/roles/:roleId and all /roles APIs retain legacy Administrator-only authorization. Auth login/logout/reset and authenticated self-service Settings remain unchanged.

## Security audit

CreateUserDto requires a scalar legacy role and UpdateUserDto optionally accepts it. The database compatibility trigger maps that field to role membership. Migrating these handlers without an additional role-change restriction would expose Administrator assignment through users.manage. Role administration must therefore remain restricted within these mixed-purpose handlers, without a role OR permission fallback. Creation policy: absent a response to the clarification, the stated narrow default was applied: non-Administrators with users.manage may create baseline Staff accounts only. All role-field edits require a legacy Administrator in addition to users.manage.

Existing service guards reject self role edits, self suspension/deletion, last active legacy Administrator removal and last protected Administrator membership removal. Deletion also checks historical-record blockers. Role/email changes and suspension retain transactional session invalidation. Role-membership services retain their separate Administrator checks and protected-role safeguards.

## Implementation and role boundary

Migrated all 12 UsersController handlers to their mapped RequirePermission checks. Removed its class-level Roles restriction. Added authorization checks within mixed-purpose create/update handlers: non-Administrators may only create Staff accounts, and cannot submit any legacy role field on update. Administrators still need users.manage. These are additional restrictions, not a role OR permission fallback. UserRolesController and RolesController are unchanged and remain Administrator-only; protected role services and the compatibility trigger are unchanged. No new role permission keys were introduced.

Session authentication and fresh permission resolution remain in the global guard chain. users.manage does not authorize dedicated session-control endpoints, while account suspension and role/email edits retain their existing incidental session invalidation. users.sessions.revoke alone does not grant directory/session reads; those require users.view.

## Preserved protections and tests

Added users-authorization.spec.ts with real Nest HTTP routes, session/permission/role guards and the real permission resolver, using mocked business services, persistence and session validation. Coverage includes all handler policies, exact custom-role grants, granted Administrators, missing grants (403), missing sessions (401), legacy Administrator denial, permission separation, revocation, catalog parity, role assignment boundaries, privileged creation rejection, role-field mutation rejection and permitted Administrator role editing.

Added users-safeguards.spec.ts exercising the real unchanged UsersService with mocked persistence. Covers self suspension/deletion/role-edit rejection, last Administrator checks through suspend/delete/demote operations, cross-user session rejection, single-session scope/reason and revoke-all scope/count. Existing user-roles.service tests cover protected compatibility membership, last protected and legacy Administrator checks, assignment audit and session invalidation, inactive actors and non-Administrator self escalation.

No service business logic changed: creation, password setup/reset, account status rules, session invalidation, audit behavior, history blockers and role compatibility remain intact. users.manage is a sensitive administrative grant: it permits the mapped profile, account-status and password-reset operations, not just directory edits.

## Frontend compatibility

Read-only inspection confirms users.view navigation/route gating, users.manage create/edit/status/reset/delete controls and users.sessions.revoke session controls. Role assignment UI additionally checks the legacy Administrator role. No frontend files changed.

Compatibility limitation: the existing role editor may still offer Administrator creation or include a role field during profile updates. Non-Administrators now receive 403 for those requests, even with users.manage; profile-only API updates must omit role. A future authorized frontend phase can hide or omit those restricted fields. The backend boundary was not weakened to accommodate the editor.

## Validation

- Backend TypeScript: npx tsc --noEmit -p tsconfig.build.json passed.
- Targeted Jest: users-authorization, users-safeguards, user-roles.service; 3 suites, 111 tests passed.
- Targeted ESLint on the controller and both new tests passed.
- Targeted Prettier formatting and controller whitespace check passed.

HTTP tests isolate authorization and do not enable DTO validation. Service tests use mocked transactions and do not establish real database concurrency/rollback guarantees. No live user, role, session or database records were changed; no migrations or seeds were run. No browser testing is claimed.

## Files changed in this phase

- ims-backend/src/users/users.controller.ts
- ims-backend/src/users/users-authorization.spec.ts (new)
- ims-backend/src/users/users-safeguards.spec.ts (new)
- RBAC_PHASE_3D7_USERS_AUTH_REPORT.md (new)

Pre-existing changes from earlier phases were preserved.

## Confirmations

| Area | Status |
| --- | --- |
| Products | IMPLEMENTED |
| Inventory | IMPLEMENTED |
| Stock Runs | IMPLEMENTED |
| Suppliers | IMPLEMENTED |
| Reports | IMPLEMENTED |
| POS | IMPLEMENTED |
| Users | IMPLEMENTED |
| Roles administration | NOT MIGRATED |
| Settings | NOT IMPLEMENTED |

Frontend changes: NONE in this phase.

Database changes: NONE in this phase.

Prisma, migrations, permission catalog, services and guards: unchanged in this phase.

Stopped after User authorization migration.
