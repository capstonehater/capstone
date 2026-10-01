# RBAC Phase 3D-8 - Settings Authorization Review

## Pre-change mapping

Reviewed Phase 3D7 report, settings controller/service/DTOs, session guard and validation, frontend settings callers/navigation, and other settings-named routes before changes.

| Endpoint | Purpose | Current authorization | Intended authorization |
| --- | --- | --- | --- |
| GET /settings/account | Own profile | Session + all three legacy roles | Authenticated self-service |
| PATCH /settings/account | Own profile/photo/email | Session + all three legacy roles | Authenticated self-service |
| POST /settings/change-password | Own password | Session + all three legacy roles | Authenticated self-service |
| PUT /forecasting/settings | Shared forecast horizon | Session + Administrator | Administrator-only retained; permission migration deferred |

The forecast endpoint writes forecastSettings with singleton id default. It is a true global capability, so the statement "No current global settings capability exists" would be inaccurate. settings.manage is absent from the catalog and catalog changes are forbidden. Clarification was requested. The safe default under the explicit no-catalog-change constraint is to preserve Administrator-only protection and defer global migration; no new key or unsupported decorator was introduced.

Self-service methods always use CurrentUser.id, not a submitted account identifier. DTOs allow only profile fields/current and new passwords; global ValidationPipe rejects unknown fields. Password updates verify the current password, hash the new password, revoke all active sessions and clear the auth cookie. Email changes revoke sessions and clear the cookie; ordinary profile edits do not. Session validation rejects inactive/non-ACTIVE users. Services and these rules will remain unchanged.

## Implementation and permissions

Removed the all-legacy-roles decorator and its imports from SettingsController. All three personal routes remain behind the existing global SessionAuthGuard. There are no Public decorators and no new permission requirements or OR fallbacks. No services, DTOs, password rules, session-validation logic or account-status rules changed.

settings.manage was NOT used: it does not exist in the current catalog. The global forecast endpoint and its controller/service are unchanged. A future catalog expansion and authorized migration is required for permission-based global settings control. This phase cannot honestly report either full global migration or absence of all global settings.

## Frontend compatibility

Read-only inspection of shell navigation and lib/settings.ts confirms authenticated-only Settings navigation and calls to /settings/account and /settings/change-password without target user IDs. No mismatch requires frontend changes. Profile picture upload behavior and limits remain intact.

## Tests and validation

Added settings-authorization.spec.ts. It uses real SettingsController, SettingsService, HTTP guards and ValidationPipe with mocked session validation, password hashing/verification, persistence and permission resolver. Checks all three legacy roles without permission grants, absent/invalid sessions (401), rejection of identity/role/status/grant fields (400), missing other-user URL (404), ignored query targeting, own-account write scope, weak-password validation, incorrect-current-password rejection, hash invocation, scoped session invalidation and cookie clearing on password/email change. Also verifies no role/permission/public metadata on personal routes and retained 403 for non-Administrators versus success for Administrators on global forecasting settings.

A wrong permission is not a reason to deny authenticated self-service: no permission grants are required or consulted. The global endpoint still uses its legacy role restriction, not a nonexistent settings.manage key. Invalid-session tests mock the session validation result; actual inactive-account rejection was source-audited in SessionService and is unchanged. No live database or browser tests were performed.

Validation from ims-backend:

- npx tsc --noEmit -p tsconfig.build.json: passed.
- Jest settings-authorization and existing profile-picture suite: 2 suites, 30 tests passed.
- Targeted ESLint on controller and new test: passed.
- Targeted formatting and controller diff whitespace check: passed.

## Files changed

- ims-backend/src/settings/settings.controller.ts
- ims-backend/src/settings/settings-authorization.spec.ts (new)
- RBAC_PHASE_3D8_SETTINGS_AUTH_REPORT.md (new)

Prior uncommitted work was preserved.

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
| Settings self-service | IMPLEMENTED / reviewed and preserved |
| Global forecast settings | EXISTS; migration DEFERRED because required catalog key is absent |
| Roles administration | NOT MIGRATED |

Frontend changes: NONE.

Database changes: NONE.

Prisma, migrations, permission catalog: unchanged.

Stopped after Settings authorization review. The global capability prevents an unqualified declaration that no global settings exist or that all Settings permission migration is complete.
