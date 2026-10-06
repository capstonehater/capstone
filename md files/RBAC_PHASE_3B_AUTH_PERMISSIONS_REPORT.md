# RBAC Phase 3B — Auth Effective Permissions Report

Date: 2026-09-29. Status: completed. References: Phase 1, Phase 2, and Phase 3A reports.

## 1. Auth response changes

Successful login and GET /auth/me retain their existing response envelope and public identity fields, including the scalar legacy role. New fields are added inside `user`:

```json
{
  "user": {
    "id": "existing-user-id",
    "email": "existing-email",
    "name": "Existing Name",
    "role": "STAFF",
    "profilePictureUrl": null,
    "roles": [
      { "id": "access-role-id", "key": "stable-role-key", "name": "Role name", "description": "Role description" }
    ],
    "effectivePermissions": ["inventory.view", "inventory.waste"],
    "authorizationRevision": "sha256-content-revision"
  }
}
```

Login still includes its original message. There are no additional top-level copies of role or permissions. Existing AuthUser consumers therefore retain their current identity shape and legacy route behavior.

AuthController explicitly projects the /auth/me user fields. To comply with the instruction not to modify controllers, `AuthPermissionsInterceptor` enriches only AuthController's login and getMe responses. All other handlers pass through untouched. The interceptor is registered in AuthModule; controller source, security decorators, cookie creation, login service, and session guard remain unchanged.

## 2. Resolver usage and revision semantics

PermissionResolver gains `snapshot(userIdentity)`, returning public assigned-role summaries, effective permissions, and authorizationRevision from one fresh database query. Existing `resolve()` delegates to that snapshot and returns the same ReadonlySet contract consumed by PermissionsGuard. No duplicate union logic was introduced for authentication.

The resolver unions all assigned role grants, deduplicates/sorts keys, and ignores keys outside the code-managed catalog. Inactive, disabled, or missing users receive no effective permissions. Existing session validation still rejects invalid/inactive sessions before /auth/me runs; the resolver's empty-grant behavior is an additional safeguard, not a change to account rules.

AuthorizationRevision is an opaque deterministic SHA-256 content value, not a monotonic counter and not an authorization credential. It incorporates user identity, enabled/account status, sorted role metadata, role revisions, assignment timestamps, and effective permission keys. Reordering database results does not change it. Membership changes, role edits, or grant changes produce a different value. No database column, migration, cache, websocket, or session-schema change was needed.

## 3. Frontend auth changes

AuthUser adds assigned role summaries, effectivePermissions, and authorizationRevision. These fields are optional at the input type boundary so existing profile-update consumers that supply only legacy identity fields continue compiling unchanged. Login and /auth/me now supply them; the store normalizes missing values.

The Zustand store holds these fields both with the current user and as direct state fields. Same-user, same-legacy-role profile updates that omit RBAC data preserve the loaded authorization snapshot. A different user or changed legacy role does not inherit prior permissions. Explicit empty arrays from a refresh replace old grants. Logout/unauthentication clears all RBAC data atomically.

No user UI, role UI, sidebar, route guard, navigation visibility, or business feature uses the new helpers yet.

## 4. can() and canAll()

`useAuthStore.getState().can(permission)` checks authenticated status and membership in the stored effectivePermissions array. It does not infer grants from legacy role names.

`canAll(permissions)` requires authenticated status and every supplied key. An authenticated empty requirement list evaluates true; unauthenticated/loading states evaluate false. These helpers are UX utilities only. They do not enforce backend security.

## 5. Bootstrap and refresh

AuthBootstrap stores the enriched /auth/me snapshot on initial bootstrap and refreshes on visible-window focus or visibility restoration. A five-second throttle and in-flight guard avoid duplicate focus requests. There is no continuous polling or websocket invalidation.

Every successful refresh replaces roles, permissions, and authorizationRevision, including when the revision changes. Consumers can compare that opaque revision later without implementing live invalidation now.

An old response is ignored if the stored user identity object or auth status changed while the request was running, preventing an in-flight request from undoing logout, a new login, or a profile update. Effect cleanup also ignores responses from the prior mount. A focus-refresh 401 clears the session; a transient network/server error preserves the current snapshot and retries on a later focus. Initial bootstrap failure retains the prior unauthenticated behavior.

The auth client now exposes AuthSessionError with an HTTP status for refresh handling. Cookies and credentialed API transport are unchanged. Refresh is event-driven; permissions can remain visually stale until the next successful focus refresh, while backend checks remain authoritative.

## 6. Backend files changed

Created:
- `ims-backend/src/auth/auth-permissions.interceptor.ts`
- `ims-backend/src/auth/auth-permissions.interceptor.spec.ts`

Modified:
- `ims-backend/src/auth/auth.module.ts` — register the response interceptor.
- `ims-backend/src/auth/rbac/permission-resolver.service.ts` — single-query authorization snapshot and revision; preserve resolve() contract.
- `ims-backend/src/auth/rbac/rbac.spec.ts` — fixture metadata expanded for snapshot queries.

No controller, session guard/service, cookie code, password code, RolesGuard, PermissionsGuard implementation, business endpoint, Prisma schema, or migration was modified in Phase 3B.

## 7. Frontend files changed

- `ims-frontend/src/lib/auth.ts`
- `ims-frontend/src/store/authStore.ts`
- `ims-frontend/src/components/auth/AuthBootstrap.tsx`
- `ims-frontend/tests/authStore.test.cjs` (new)

No auth payload consumer outside these files was changed. Earlier uncommitted work from prior phases remains separate.

## 8. Tests and validation

Backend: **25 targeted tests passed** across the existing RBAC suite and the new auth-payload suite. New cases verify one-role grants, multiple-role union, inactive/missing users, ignored unknown permissions, stable/changing revisions, preservation of the legacy role and response envelope for login and /auth/me, and pass-through for unrelated controllers.

Frontend: **8 store tests passed**, exercising storage, can(), canAll(), logout clearing, legacy same-user profile updates, cross-user isolation, refreshed grant removal/revision replacement, and loading-state denial. The tests load the actual store using the installed TypeScript compiler; no new framework or dependency was installed. Command:

`node --test --test-isolation=none tests/authStore.test.cjs`

The no-isolation flag avoids child-process restrictions in this Windows execution environment.

Additional checks:
- Backend production TypeScript: passed.
- Frontend TypeScript: passed.
- Targeted lint for changed application and test files: passed.
- /login HTTP smoke check: 200.
- Unauthenticated /auth/me: 401 (existing security preserved).
- Diff whitespace check: passed.

No live user credential login was performed. Authenticated payload behavior was checked through the resolver/interceptor tests. Focus-refresh behavior was reviewed and type-checked, not automated in a full browser session.

## 9. Security notes and boundaries

The new browser payload and helpers are for UX only. They are not authorization tokens and cannot override backend guards. Existing endpoints still apply existing legacy role/session checks. Role grants configured through prior phases are exposed but are not newly enforced on business controllers.

This is not a completed RBAC enforcement migration. Later phases must still map each endpoint and frontend route/action to permissions and review composite-page data dependencies and administrator governance.

No database writes, user assignments, or role configuration changes were performed for Phase 3B.

## 10. Explicit confirmations

Endpoint authorization migration: **NOT IMPLEMENTED**.

Frontend feature hiding: **NOT IMPLEMENTED**.

Navigation filtering: **NOT IMPLEMENTED**.

Role UI: **UNCHANGED**.

Users UI: **UNCHANGED**.

SessionAuthGuard/AuthSession/cookies/login security/password rules: **UNCHANGED**.

User.role and Role enum: **PRESERVED**.

Phase 3B stops here.
