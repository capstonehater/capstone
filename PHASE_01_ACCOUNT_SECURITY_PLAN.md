# Phase 1 Account Security Plan

Planning review date: 2026-10-02. Scope: account security only. Evidence is source inspection unless explicitly stated otherwise. Proposed changes and tests below have not been implemented or executed during this review.

## Executive Summary

The protected Administrator takeover path remains confirmed in the current source. A non-Administrator with `users.manage` and a known target ID can change an Administrator's email, then obtain a reset through either managed reset or public forgot-password. Delivery to the controlled mailbox is an external precondition. No live exploit was attempted.

Phase 1 should enforce actor-target-operation authorization inside managed mutation services, recognize both scalar Administrator identity and protected Administrator membership, invalidate recovery tokens on identity/password changes, make reset consumption atomic, and add transactional security audit events. Preserve ordinary delegated management, current self-service ownership, password rules, and last-active-Administrator safeguards.

No schema migration is required for the core fix. Existing user, token, session, membership, and audit models are sufficient. A shared transaction-aware account policy/helper is justified because current guards authorize actors but do not solve target protection across Users, Auth, and Settings.

Policy decisions remain explicit: harmless edits on protected targets, powerful custom-role targets, self-service email credential confirmation, token behavior around suspension/role changes, and denied-attempt retention. Do not silently adopt a new custom-role hierarchy or require new permission keys.

Only this plan is created. No application source, previous report, migration, database, commit, or branch is changed. This plan does not assert concurrency safety or production readiness.

## Repository Baseline

| Item | Observed value |
| --- | --- |
| Workspace | `C:\Users\Deej\Desktop\salvacion` |
| Branch | `main` |
| Commit | `7f98d31dbf4f088df3114c84d6d2e6da6fdc6f04` |
| Initial status | `?? POST_MERGE_CODEBASE_AUDIT_REPORT.md` and `?? SECURITY_PRODUCTION_READINESS_REMEDIATION_PLAN.md` |
| Clean tree? | No: the two prior reports are untracked. No tracked source changes were reported. Both reports are preserved. |
| Installed backend packages | NestJS core 11.1.17, Prisma 6.19.2, TypeScript 5.9.3 |
| Installed frontend packages | Next.js 16.2.1, React 19.2.4 |
| Persistence | PostgreSQL through Prisma; actual database contents/triggers were not queried in this planning task |
| Test execution | None in this review; prior passing counts are historical and not current concurrency evidence |

Versions were read from installed package metadata. Relevant npm scripts and Jest configurations were inspected. The backend lint script mutates files via `--fix`, so it is unsuitable for a non-mutating review.

## Relevant Architecture

All paths below are relative to the repository root.

| Concern | Current files and responsibility |
| --- | --- |
| Managed users | `ims-backend/src/users/users.controller.ts`, `users.service.ts`; DTOs in `ims-backend/src/users/dto/` |
| Membership administration | `ims-backend/src/users/user-roles.controller.ts`, `user-roles.service.ts`; Administrator-only HTTP boundary plus fresh service actor check for assign/remove |
| Role definitions | `ims-backend/src/roles/roles.controller.ts`, `roles.service.ts`; role/permission mutation audits |
| Auth entry points | `ims-backend/src/auth/auth.controller.ts`, `auth.service.ts`; login, public forgot/reset, managed issuance |
| Tokens/passwords/mail | `ims-backend/src/auth/token.service.ts`, `password.service.ts`, `password-reset-notifier.service.ts`, `auth-throttle.service.ts`, `auth.constants.ts` |
| Guards | `ims-backend/src/auth/guards/session-auth.guard.ts`, `permissions.guard.ts`, `roles.guard.ts` |
| Grants/payload | `ims-backend/src/auth/rbac/permission-resolver.service.ts`, `permission-catalog.ts`, `ims-backend/src/auth/auth-permissions.interceptor.ts` |
| Sessions | `ims-backend/src/auth/session.service.ts`; hash lookup, expiry, account status, password-change time, revocation |
| Own account | `ims-backend/src/settings/settings.controller.ts`, `settings.service.ts`, `dto/update-account-settings.dto.ts`, `dto/change-password.dto.ts` |
| Self-service caller | `ims-frontend/src/lib/settings.ts`, `ims-frontend/src/components/admin/settings/EditAccountDialog.tsx`, `SettingsWorkspace.tsx`, `ChangePasswordDialog.tsx` |
| Modules | `ims-backend/src/auth/auth.module.ts`, `ims-backend/src/users/users.module.ts`, `ims-backend/src/settings/settings.module.ts`; Auth/Users already use `forwardRef` |
| Schema/security SQL | `ims-backend/prisma/schema.prisma`; `ims-backend/prisma/migrations/20260929000000_rbac_foundation/migration.sql` |

Global guards run SessionAuthGuard, PermissionsGuard, then RolesGuard. Public auth routes skip session validation. Permissions are resolved freshly from active users' memberships; no Administrator grant bypass exists for permission-decorated routes. Conflicting role/permission metadata is rejected. RolesGuard checks the current scalar role supplied through validated session lookup.

PrismaService is globally provided. Transactions are used inconsistently across account operations: managed update/suspend/delete and membership mutations use Serializable interactive transactions; reset uses a transaction array; reactivation and managed session revocation use separate reads/writes. No shared protected-account policy currently exists.

Database ownership is application-enforced. Own Settings routes derive their target from `CurrentUser.id`; generic managed services accept explicit target IDs. The existing schema has no row-level authorization mechanism demonstrated by this review.

## Confirmed Findings

| ID | Finding | Classification | Evidence and consequence |
| --- | --- | --- | --- |
| F1 | Managed email transfer of Administrator identity | Confirmed, high | `UsersController.updateUser` restricts `dto.role` only; `UsersService.updateUser` permits email changes without protected-target authority. |
| F2 | Managed reset lacks actor/target authority | Confirmed | `issuePasswordResetForUserId` receives target and statuses, no actor; both setup and resend call it. |
| F3 | Public reset completes F1 | Confirmed, external delivery required | `forgotPassword` finds the active account by its changed email and sends there. Blocking only managed reset cannot close F1. |
| F4 | Password/email changes leave recovery tokens valid | Confirmed | Settings password change and both email-change paths revoke sessions but never invalidate reset tokens; completion has no passwordChangedAt comparison. |
| F5 | Reset consumption is not atomic | Confirmed missing conditional claim; concurrent outcome needs integration evidence | Validity read precedes transaction; token update uses only ID. Two requests can pass the initial read and later overwrite the password. |
| F6 | Lifecycle/session actions lack general protected-target restriction | Confirmed | Existing self/last-admin/history checks are not actor-to-target authorization. Reactivation/revocation do not receive actor context. |
| F7 | Membership-only Administrator targets are possible | Confirmed | `UserRolesService.assign` can add protected Administrator role to non-Administrator scalar users without changing scalar role. |
| F8 | Security audit coverage incomplete | Confirmed | Account mutation services do not write AuthorizationAuditEvent; role definition/membership services do. |
| F9 | Controller-only privileged creation/scalar-role checks | Confirmed internal reuse risk | `createUser(dto)` lacks actor; update service itself lacks Administrator-only scalar-role enforcement. Current HTTP controller blocks direct role escalation. |
| F10 | Unused generic password mutation entry point | Confirmed internal reuse risk | `UsersService.updatePassword(userId,passwordHash)` has no caller found in src/test and no actor, token invalidation, or audit. Not a demonstrated remote endpoint. |
| F11 | Self email change needs no credential confirmation | Confirmed behavior; defense-in-depth policy decision | Valid session suffices; no current-password/recent-auth/new-email verification workflow. |
| F12 | Stale token/status snapshot during reset | Confirmed structure; race needs integration evidence | Completion derives next status before transaction. A reset racing suspension can write the previously read ACTIVE state back. |

F5 also applies to competing reset issuance: invalidating prior tokens and creating a token in a transaction does not by itself serialize two issuers for the same account. Shared account serialization should cover issuance, not only completion.

## Findings Not Confirmed

- No known core finding is Already Fixed in this source snapshot.
- Claims that email/password changes do not revoke sessions are False Positive for existing sessions: revocation is already implemented. Outstanding reset-token invalidation is the actual gap.
- Treating all `isProtected` roles as Administrator targets is False Positive. STAFF and MANAGER compatibility roles are also system/protected in the migration.
- Treating protected Administrator membership as authority to administer roles is False Positive. Role APIs require scalar Administrator; membership may confer feature grants but does not replace that rule.
- A live SMTP exploit, actual stolen token, or observed concurrent reset was not demonstrated. External exposure and exact interleavings need more evidence.
- Database audit immutability and live trigger installation need more evidence; model definitions alone do not establish deployed privileges.
- Old-session creation racing password reset requires an integration test. Login validates credentials before creating a later session; do not claim all concurrent login cases are protected by the existing timestamp check.
- No phone-based recovery, MFA-management, recovery-code, or username-edit endpoint was found in the inspected account flows. Do not invent fixes for absent operations.

## Administrator Takeover Trace

Abbreviations: UC = UsersController, US = UsersService, AC = AuthController, AS = AuthService. All live exploitation is unperformed.

| Step | Endpoint | Controller method | Required permission/role | Service method | Target lookup | Validation | Database mutation | Existing safeguard | Missing safeguard | Exploitability status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 Delegated access | `/users/*` mutation | Relevant UC handler | Session + `users.manage` | Relevant US method | Session user | Fresh feature grant | None yet | Guard authorization | Target classification | Source permits delegation |
| 2 Identify target | GET `/users`, `/users/:id` | listUsers/getUser | `users.view` | listUsers/getUserDetail | User ID/list | Query/ID DTO | None | Read permission | Not itself a defect | Attacker needs users.view or already-known ID |
| 3 Change email | PATCH `/users/:id` | updateUser | `users.manage`; Admin only if role supplied | updateUser | User by ID in transaction | Email format, unique email, nonempty update | Email changed | Serializable tx; session revocation | Administrator-target email rule | Confirmed |
| 4 Managed reset | POST `/users/:id/password-reset` | requestUserPasswordReset | `users.manage` | issuePasswordResetForUserId | findPasswordResetTargetById | PENDING/ACTIVE/INACTIVE | Token operations below | Status restriction | Actor/target policy | Confirmed |
| 5 Public alternative | POST `/auth/forgot-password` | forgotPassword | Public | forgotPassword | findByEmailForAuth(new email) | ACTIVE and isActive; IP throttle | Token operations below | Generic unknown response | Cannot repair unauthorized identity transfer | Confirmed alternative |
| 6 Generate | Internal | Prior handler | Inherited | createAndSendPasswordReset | Passed user ID/email | Opaque random token | Old unused tokens marked used; hash inserted | Hash/expiry | Atomic account serialization | Strong token does not fix email destination |
| 7 Deliver | Internal SMTP | Prior handler | Inherited | sendResetLink | Passed current email | SMTP config/TLS/accepted result | No DB write | No production token response on managed flow | Destination already compromised | Depends on delivery/access |
| 8 Confirm | POST `/auth/reset-password` | resetPassword | Public bearer token | resetPassword | Token hash, related user | Exists, unused, unexpired; password DTO | Transaction below | Token possession | Atomic claim; current state recheck | Source permits valid token |
| 9 Password | Same request | resetPassword | Valid token | resetPassword | Token userId | bcrypt hashing | Password, timestamp, login counters, status | 10-72 chars, upper/lower/number | Token stale after prior identity/password change | Confirmed |
| 10 Sessions | Same request | resetPassword | Valid token | resetPassword | userId | Unrevoked predicate | Revoke sessions; mark tokens used | Existing sessions invalidated | Does not restore original ownership | Attacker now knows password |
| 11 Login | POST `/auth/login` | login | Public credentials | login | Changed email | Active, unlocked, hash verification | Session create, successful-login state | Normal login safeguards | Identity already transferred | Administrator scalar authority retained |

Overall: complete source-level path subject to known target, unique attacker-controlled email, active account for public recovery/login, and delivery. Last-admin checks do not stop email transfer because role/status can remain unchanged.

## Protected-Target Model

1. Legacy Administrator authority is `User.role === Role.ADMINISTRATOR`; active status and valid session remain required.
2. `AccessRole.isProtected` protects role definition identity/deletion; `isSystem` marks compatibility roles. These are not interchangeable with Administrator status.
3. The foundation migration seeds a specific role with key `ADMINISTRATOR`, `isSystem=true`, `isProtected=true`.
4. Existing last-admin membership queries use `accessRoles.some.role` with key `ADMINISTRATOR` and `isProtected=true`.
5. `UsersService.assertNotLastActiveAdministrator` checks protected membership continuity and scalar Administrator counts. Call sites differ: role demotion applies to active scalar Admin, suspend calls the helper, delete calls it for ACTIVE targets.
6. Membership removal has a separate last-active-member check, disallows removing the compatibility role matching scalar role, and uses Serializable transactions. Logic is duplicated, not a reusable general account policy.
7. A scalar STAFF/MANAGER can receive protected Administrator membership via authorized assignment. The trigger syncs scalar -> compatibility membership, not membership -> scalar. Such an account must be protected as a target without gaining scalar-only role-administration authority.
8. Custom roles default to unprotected and may have powerful grants. Current code does not define privilege dominance between arbitrary grant sets. This remains an open policy question, not an automatic Phase 1 behavior change.

Recommended target predicate: scalar Administrator OR membership in the specific protected Administrator role, regardless of target active/pending/inactive status. Do not use display names or merely any protected/system role. Recommended actor authority for protected operations: current active scalar Administrator plus the endpoint's existing feature grant. No role-OR-permission fallback.

Keep self-service separate: a membership-only protected user can still use own Settings/password recovery under existing self-service rules. Managed endpoints must not become a self-target bypass for protected operations.

## Sensitive Operation Inventory

Current state only. `M` = users.manage; `R` = users.sessions.revoke. All managed HTTP routes also require session. No account-security audit event is currently written for rows marked None.

| Operation / endpoint | Permission and controller restriction | Service / target-self-last protection | Transaction | Sessions | Reset tokens | Audit / risk |
| --- | --- | --- | --- | --- | --- | --- |
| Create/setup POST `/users` | M; non-Admin may create STAFF only | createUser: PENDING, inactive, no password; service lacks actor | User create separate from issuance tx | None | Setup issuance invalidates prior unused then creates | None; internal role bypass and partial create/mail failure |
| Email PATCH `/users/:id` | M; no target role rule | updateUser: email validation/uniqueness; no target protection; self email allowed | Serializable | All target sessions revoked if changed | Unchanged | None; takeover |
| Scalar role same PATCH | M + Admin if any role supplied | Self role forbidden; last-active Admin demotion check; service lacks actor-role check | Serializable + compatibility trigger | Revoked if changed | Unchanged | No equivalent account audit; controller reuse risk |
| Reset/setup POST `/users/:id/password-reset` | M | issuePasswordResetForUserId: status allowed, no actor/self/last rule | Token array tx after separate lookup | No immediate revocation | Old unused invalidated, new token | None; protected-target exposure |
| Suspend POST `/users/:id/suspend` | M | suspendUser: self forbidden; pending/already inactive reject; last-admin helper | Serializable | All revoked | Unchanged | None; other Admins remain exposed |
| Reactivate POST `/users/:id/reactivate` | M | reactivateUser: pending/already active reject; no actor or last check | Separate read/write | No restoration of revoked rows | Unchanged | None; protected inactive identity can be restored by delegate |
| Delete DELETE `/users/:id` | M | deleteUser: self forbidden; ACTIVE last-admin check; historical dependency blockers | Serializable | Cascade deletion | Cascade deletion | None; dependency-free protected target exposed subject to count guards |
| One session DELETE `/users/:id/sessions/:sessionId` | R | revokeUserSession: belongs-to-target check; no actor/target-role/self rule | Separate read/updateMany | Selected row revoked | Unchanged | None; protected account disruption |
| All sessions POST `/users/:id/sessions/revoke-all` | R | revokeAllUserSessions: user exists; no actor/target-role/self rule | Separate read/updateMany | All active target rows revoked | Unchanged | None; protected account disruption |
| Membership POST `/users/:id/roles` | Scalar Admin only | assign: rechecks active scalar actor, validates role IDs/duplicates | Serializable | Target revoked | Unchanged | user.roles.assigned; preserve authority |
| Membership DELETE `/users/:id/roles/:roleId` | Scalar Admin only | remove: active actor; compatibility and last-member protection | Serializable | Target revoked | Unchanged | user.role.removed; preserve authority |
| Own email PATCH `/settings/account` | Authenticated self-service | Session target only; no credential confirmation | Interactive tx; initial lookup outside | All revoked and cookie cleared | Unchanged | None; stale recovery capability |
| Own password POST `/settings/change-password` | Authenticated self-service | Current password required; no target input | Array tx after credential check | All revoked and cookie cleared | Unchanged | None; old token still usable |
| Public reset POST `/auth/reset-password` | Valid recovery token | Token/status read before tx; pending becomes ACTIVE, inactive normally stays inactive | Array tx | All revoked | Chosen and sibling tokens marked used | None; atomicity/stale-state gaps |

There is no standalone pending activation endpoint: setup completion activates PENDING users. `UsersService.updatePassword` is an additional internal callable method, not a route; remove it after confirming no external consumers or replace it with an explicitly authorized security workflow. Do not retain an unrestricted public password setter.

## Current Authorization Boundaries

Global session/permission guards establish actor access. Controllers additionally restrict privileged creation/scalar role edits. Services enforce certain self/count/history rules; membership service already provides a useful precedent for fresh actor checks. Database uniqueness/cascades/role-definition triggers do not authorize email changes or recovery.

| Design | Benefit | Limitation |
| --- | --- | --- |
| Controller-only | Visible, simple route rule | Bypassed by service reuse; no transactional target snapshot |
| Repeated service checks | Close to mutation | Duplicated policy and inconsistent actor propagation |
| Focused policy/helper used in services | Shared actor-target-operation rule with transaction client | Requires disciplined call sites, locking and tests |

Recommendation: one focused helper module `ims-backend/src/users/account-security.policy.ts`, with explicit operation types, transaction-aware actor/target loading, and a pure target predicate. No new controller or broad framework. A stateless helper using a passed `Prisma.TransactionClient` avoids expanding Auth/Users dependency injection cycles; no module provider changes are needed for that design.

The helper must verify current actor account/session and required existing grants for managed service entry points, not trust client-supplied role fields or permit an absent actor. Reuse the catalog's supported keys; if extracting grant-set calculation from PermissionResolver, preserve the same union/no-fallback semantics and test parity. Keep controller guards as the outer HTTP boundary.

Explicit operations: create account, change login identity, change scalar role, issue managed setup/reset, suspend, reactivate, delete, revoke session(s), harmless profile update. Privileged creation and any scalar-role change require scalar Administrator in the service as well. The session-revoke operation requires R, not M.

Self-service/password-token authority must use distinct APIs; do not expose a generic caller-controlled `skipPolicy`/`trusted` boolean. Public issuance uses revalidated email ownership routing and status, not managed actor authority.

Concurrency recommendation: use a shared deterministic account-row locking order for actor/target and retain Serializable handling where counts matter. Membership assign/remove must participate in target locking to prevent protection-changing races; their authorization semantics remain unchanged. Re-read token, target status and identity after locks. Catch serialization/deadlock conflicts deliberately; no email inside retryable transactions. Per-account locks alone do not prove concurrent last-admin count safety across two distinct targets; preserve Serializable checks and test the cross-target case.

## Password Reset Lifecycle Analysis

### Current lifecycle

- TokenService generates 48 random bytes encoded base64url; stores HMAC-SHA256 hash with RESET_TOKEN_SECRET, not raw token.
- TTL is configured via PASSWORD_RESET_TTL_MINUTES, default 30. Public request/confirm throttles default to 5/10 per IP per 15-minute window, in memory. Managed issuance does not use this throttle.
- Issuance marks previous unused tokens used and inserts the new token in an array transaction. User/email/status lookup occurs before it.
- Managed initial setup permits PENDING. Managed resend permits PENDING/ACTIVE/INACTIVE. Public forgot permits ACTIVE + isActive only, returning generic response otherwise.
- Notification occurs after commit. Test mode skips real email. Non-production missing-SMTP fallback can log a link. Managed calls suppress debug responses; public debug exposure requires non-production plus explicit flag.
- Completion looks up hash and checks usedAt/expiry before hashing and writing. It does not compare requestedAt with passwordChangedAt.
- The transaction updates user first, marks selected token by ID only, marks sibling unused tokens, and revokes sessions. Sequential reuse fails, but no conditional token claim protects concurrent requests.
- Normal inactive reset retains INACTIVE; pending setup activates. Because status is read before transaction, a concurrent suspension can be overwritten by stale completion state.

| Event | Current token outcome | Phase 1 recommendation |
| --- | --- | --- |
| Successful reset | Selected/siblings used | Preserve; atomic claim + account serialization |
| New reset | Previous unused marked used | Preserve; serialize issuance against identity changes and other issuance |
| Password change | No invalidation | Required: invalidate all unused in same transaction |
| Managed/self email change | No invalidation | Required: invalidate all unused in same transaction |
| Suspension | No invalidation | Recommend invalidation on transition, subject to recorded status-policy approval; do not automatically ban later authorized inactive reset |
| Reactivation | No invalidation | Do not recreate tokens or restore consumed tokens; no automatic new token |
| Delete | Cascade removes tokens | Preserve |
| Role/membership change | No invalidation | Security-owner decision; elevated authority can amplify a previously issued token; do not silently expand policy |
| Session-only revoke/logout | No invalidation | Preserve unless explicitly implementing account-compromise recovery; revoking sessions need not consume mailbox recovery |
| Harmless profile update | No invalidation | Preserve |

### Planned atomic completion

1. Perform DTO validation and throttling. A preliminary hash lookup may identify the target, but is never the final validity decision.
2. Compute expensive bcrypt work outside long-held locks where possible; revalidate all relevant state after entering the transaction.
3. Lock the account using the common protocol. Read the token again and obtain a fresh current time after waiting; check expiration, unused state, current account status and user existence.
4. Conditionally claim using token ID/hash/user ID, `usedAt=null`, and unexpired predicate. Require affected count exactly one; otherwise reject with the existing generic invalid/expired response.
5. Within the same transaction change password/current status, invalidate other tokens, revoke sessions, and append a sanitized reset-completed event. Any error rolls back the claim and all writes.
6. Determine PENDING activation from current locked state; never restore a stale ACTIVE status. Preserve INACTIVE behavior unless explicitly changed by review.
7. Commit at most one successful reset. A timestamp comparison may supplement validity but cannot replace atomic claim/invalidation because timestamps alone are not a synchronization mechanism.

Issuance must read the current email/status inside the serialized operation. Public forgot must recheck that the submitted email still matches; do not use a stale pre-lock destination. Send only after commit. If email changes after issuance, the change invalidates that token even if delivery completes later. Mail failure must not roll back an unrelated account transaction or leak secret data.

No claim of concurrency correctness is made until actual PostgreSQL race tests pass.

## Session Security Analysis

Sessions are hashed, expire absolutely and by idle timeout, and are rejected for revoked/inactive/password-changed users. Session validation reads the current scalar role. Existing secure revocation is retained.

| Event | Current sessions | Planned behavior |
| --- | --- | --- |
| Managed email/role change | All unrevoked target sessions revoked | Preserve; perform policy, invalidation and audit atomically |
| Self email change | All revoked; response clears cookie | Preserve; invalidate tokens too |
| Self password change | All revoked; cookie cleared | Preserve; invalidate tokens too and revalidate credential snapshot |
| Reset | All revoked | Preserve; transactionally coupled to claim |
| Suspension | All revoked; inactive rejected | Preserve; protect target and current status |
| Reactivation | Existing revoked sessions stay revoked | Preserve; do not restore revoked rows |
| Deletion | Cascade removes sessions | Preserve |
| Managed revoke | One scoped session or all active scoped sessions | Add actor-target policy/audit; preserve ownership check and returned count |
| Harmless profile update | Sessions remain valid | Preserve |

Additional race to test: login verifies a password before session creation. A reset or email change may commit during bcrypt, and a subsequently created session can have a later createdAt. Recommended safeguard: serialize final session creation with security mutations and recheck that the authenticated password hash/email/status still match the verified snapshot; otherwise reject/retry authentication. This is account-security scope, not a general session rewrite. Session creation should support the caller's transaction client rather than create a nested independent transaction. Keep normal session validation/revocation behavior.

## Self-Service Identity Analysis

`SettingsController` supplies CurrentUser.id and accepts no arbitrary target. `UpdateAccountSettingsDto` contains names, email and phone only; Prisma also contains username/emailVerifiedAt, but those are not writable through this DTO. Password change requires current password; email change does not. No recent-auth proof or operational new-email verification flow was found. EmailVerificationToken exists in schema, but that does not establish a complete verification feature.

- Required Phase 1: invalidate recovery tokens when email changes, re-read identity inside transaction, preserve own-account targeting/session revocation, and prevent concurrent recovery using stale identity.
- Defense-in-depth requiring review: current-password confirmation only for changed email. If approved, include equivalent managed self-email behavior so that own PATCH /users/:id does not bypass the confirmation requirement. Another Administrator's managed recovery remains a distinct authorized operation.
- Future enhancement: full pending-email verification/notification flow. Do not build it in Phase 1 without separate approval.
- Old mailbox power: old-address forgot lookup no longer finds the renamed account, but an already-issued old token remains usable today. Required invalidation removes that residual capability.
- Preserve names/phone/photo edits without password prompts or revocation. Phone is not an implemented recovery factor.

## Security Audit Analysis

AuthorizationAuditEvent supports nullable actorUserId, targetUserId, targetRoleId, action string, beforeState/afterState JSON and createdAt. IDs deliberately have no foreign keys, allowing historical attribution after deletion. Existing RolesService and UserRolesService writes are transactionally coupled to mutations. No account-security writer or log-mutation API was found. No append-only database grant/trigger protection is established by source inspection.

Proposed Phase 1 success events: account creation/setup issuance, login-identifier change, scalar-role change, managed/public reset issuance, password change/reset completion, suspension, reactivation, deletion, and explicit session revocation. Existing membership/role-definition events stay unchanged. Action names are audit labels, not permission catalog keys.

Managed events store real actor and target IDs; self-service stores same actor/target; public recovery uses null actor and target ID with an explicit recovery channel. Token possession is not evidence of a separately authenticated actor. Before/after states should use changed-field names, account status, role key where relevant, revoked-count and channel. Do not store full email values unless retention policy approves; a change indicator usually suffices.

Never include passwords, hashes, tokens, SMTP credentials, session token hashes, raw request bodies, or reset URLs. Transactional event failure rolls back the security mutation. Deletion event survives account deletion. Repeated no-op revocation must be labeled/count-correct rather than pretend a new session was revoked.

Denied attempts: structured sanitized logging with actor/target/operation/outcome; whether to persist these outside rolled-back transactions is an open retention policy. Delivery attempts: separate post-commit operational logging; issuance success is not delivery success. Production secret redaction and existing test-mode mail suppression remain required.

## Existing Test Coverage

| Suite | What it proves / mocks | Persistence, concurrency, bypass limits |
| --- | --- | --- |
| `ims-backend/src/users/users-authorization.spec.ts` | Real controller/guards and permission resolver with mocked Prisma/session/business services; 401/403, route metadata, role-field controller checks | No real mutation or concurrency; cannot prove protected service behavior |
| `ims-backend/src/users/users-safeguards.spec.ts` | Real UsersService with mocked transaction client; self/last-admin/session ownership checks | Direct-service tests exist but not takeover policy; mocked transaction cannot prove isolation |
| `ims-backend/src/users/user-roles.service.spec.ts` | Real membership service, mocked Prisma; actor checks, last member, compatibility membership, audit calls/revocation | No database transaction or trigger concurrency |
| `ims-backend/src/settings/settings-authorization.spec.ts` | Real controller/service, mocked passwords/session/Prisma; ownership, DTO rules, current password, cookie/session effects | No reset token lifecycle or real persistence |
| `ims-backend/src/auth/rbac/rbac.spec.ts` | Grants/union/no Admin fallback/fresh resolution/metadata using fake database reads | No account mutation/race proof |
| `ims-backend/src/auth/auth-permissions.interceptor.spec.ts` | Payload enrichment/revision behavior with mock reads | Not authentication or token lifecycle |
| `ims-backend/src/auth/password-reset-notifier.service.spec.ts` | Mock nodemailer; destination, TLS, failure sanitization, test-mode suppression | No real mail or recovery consumption |
| `ims-backend/src/roles/roles.service.spec.ts` | Role mutation/audit/protected rules with mocked persistence | Preserve regression; not account policy |
| `ims-backend/test/app.e2e-spec.ts` | HTTP through AppModule with overridden PrismaService; login, setup, reset, settings, users, sessions; real bcrypt in parts | Despite name, database and transaction are mocked (Promise.all/callback). Sequential assumptions only |
| `ims-backend/test/rbac_migration_test.py` | Creates isolated PostgreSQL database; tests foundation SQL/backfill/protection triggers | Actual DB but minimal schema and no AuthService reset race; not run here |

Important test debt: `test/app.e2e-spec.ts` still expects STAFF/MANAGER GET /settings/account to return 403, inconsistent with current self-service policy. Default npm test scans src/*.spec.ts and excludes this e2e suite. Do not cite prior 800 tests as proof that this legacy suite passes. Update only account-related obsolete expectations/mocks during Phase 1; do not restore obsolete access restrictions to satisfy tests.

No dedicated current AuthService token lifecycle or SessionService race suite was found. Add focused tests using Jest/ts-jest already installed, not a second testing framework.

## Required Regression Tests

Fixture labels: D = active scalar STAFF with users.manage; DR = STAFF with users.sessions.revoke only; A = active scalar Administrator with relevant grants; P = scalar STAFF with protected Administrator membership; S = ordinary STAFF; L = sole active scalar/protected Administrator. Use distinct valid UUIDs and `.invalid` emails; notifier is always mocked.

| ID / scenario | Exact planned file | Level / persistence | Fixture and assertion |
| --- | --- | --- | --- |
| T1 protected email | `ims-backend/src/users/users-safeguards.spec.ts` | Service/mock | D -> A email: Forbidden, zero mutation/audit-success/token writes |
| T2 membership target | Same | Service/mock | D -> P sensitive operation denied; STAFF protected compatibility alone does not classify S as Admin |
| T3 managed reset | New `ims-backend/src/auth/auth.service.spec.ts` | Service/mock | D -> A/P: denied before token creation and notifier |
| T4 public alternative chain | `ims-backend/test/app.e2e-spec.ts` | HTTP, real services/mocked persistence | Denied email transfer leaves old address; forgot controlled new address returns generic response with no target token/mail |
| T5 ordinary management | `ims-backend/src/users/users-safeguards.spec.ts` | Service/mock | D -> S permitted profile/email/status operations as existing rules allow |
| T6 authorized Admin | Same and auth.service.spec.ts | Service/mock | A -> another protected target permitted with required grant, self/last/history checks retained |
| T7 direct role escalation | users-safeguards.spec.ts and users-authorization.spec.ts | Service + HTTP/mock | D create ADMIN or update scalar role rejected; role APIs still scalar-Admin-only |
| T8 suspend | users-safeguards.spec.ts | Service/mock | D -> protected active non-last target denied; test two admins so count guard cannot mask missing policy |
| T9 reactivate | Same | Service/mock | D -> inactive protected target denied; D -> inactive S allowed |
| T10 delete | Same | Service/mock | D -> dependency-free protected non-last target denied; no delete |
| T11 session revoke | Same | Service/mock | DR -> A/P single/all denied; DR -> S allowed and correctly scoped; M without R denied |
| T12 password invalidation | settings-authorization.spec.ts and new auth.service.spec.ts | HTTP/service mocks | Own valid password change invalidates outstanding tokens, revokes own sessions, clears cookie |
| T13 email invalidation | users-safeguards.spec.ts and settings-authorization.spec.ts | Service/HTTP mocks | Both changed-email routes invalidate tokens; unchanged email/names do not |
| T14 sequential reuse | new auth.service.spec.ts | Service/mock | Used/expired/unknown token rejected; no password mutation |
| T15 concurrent reuse | New `ims-backend/test/account-security-concurrency.e2e-spec.ts` | Real disposable PostgreSQL + real services | Two valid requests same token: at most one committed password/event; losing claim cannot alter state |
| T16 service bypass | users-safeguards.spec.ts and auth.service.spec.ts | Direct services/mock | Missing/stale/inactive actor, stale role, missing grant denied; no unrestricted password helper remains |
| T17 last Admin | users-safeguards.spec.ts and user-roles.service.spec.ts | Service/mock plus DB concurrency suite | L demote/suspend/delete/remove denied; two concurrent distinct-admin removals preserve one active authority |
| T18 lifecycle races | account-security-concurrency.e2e-spec.ts | Real PostgreSQL | Reset vs suspend uses current state; cannot resurrect suspended account; identity change vs issuance invalidates old-address capability |
| T19 issuance races | Same | Real PostgreSQL | Competing issuances leave only latest serialized token usable; losing/obsolete email link cannot reset |
| T20 password race | Same | Real PostgreSQL | Change-password vs reset respects serialization; pre-change token cannot reset after change commits; failed audit rolls back all writes |
| T21 target promotion | Same | Real PostgreSQL | Assignment/scalar promotion concurrent with delegated mutation follows one valid serialized order, no stale-target authorization |
| T22 login race | Same plus new `ims-backend/src/auth/session.service.spec.ts` | DB integration + unit mock | Credentials checked before reset cannot create usable session after committed credential replacement without revalidation |
| T23 audit evidence | users-safeguards.spec.ts and auth.service.spec.ts | Mock + DB rollback test | Correct actor/target/channel, no secrets, success event atomic; deleted target event survives |
| T24 statuses | auth.service.spec.ts and app.e2e-spec.ts | Service/HTTP mock | Pending setup -> ACTIVE; INACTIVE reset stays inactive; public inactive/unknown generic/no issuance |
| T25 existing session behavior | new session.service.spec.ts | Service/mock | Expired/revoked/inactive/password-changed sessions rejected; reactivation does not un-revoke |
| T26 credential confirmation, conditional | settings-authorization.spec.ts plus Settings browser acceptance | Mock HTTP/browser if approved | Changed email needs valid proof; harmless edit no proof; managed-self route cannot bypass chosen rule |

Real DB fixture requirement: actual PostgreSQL is necessary for conditional claims, locks, rollback and cross-account Serializable checks. Reuse the installed Prisma client and Jest e2e toolchain, but create a guarded explicit disposable database fixture, not ims_db. Existing e2e.setup.ts overwrites DATABASE_URL with ims_test_disabled; do not assume passing a URL will override it. Planned opt-in setup must use a separately named test URL, reject non-local/non-test targets, use unique generated database names, and clean up only that verified database. Disabled/absent fixture should be visibly skipped, and a skip is not a Phase 1 pass. Use a narrow dedicated Jest config only if needed to avoid changing existing mocked e2e setup; this is configuration isolation, not a new framework.

Run concurrency tests through independent connections and explicit barriers, not only Promise.all against mocked Prisma. Fixtures need real schema, RBAC data, compatibility triggers and account/token/session/audit rows. No such fixture is created during planning.

## Proposed Code Changes

Required tests refer to IDs above. Paths are exact proposed touch points; new files are explicitly labeled. Conditional work requires a policy decision before implementation.

| File / symbol | Current behavior | Proposed Phase 1 change / security reason | Compatibility risk | Tests |
| --- | --- | --- | --- | --- |
| New `ims-backend/src/users/account-security.policy.ts` | No shared actor-target helper | Transaction-aware actor/grant/target policy and operation types; centralize narrow protected predicate and shared locking protocol | Do not classify all system/protected roles as Admin; deterministic locks | T1-T11,T16,T21 |
| `ims-backend/src/users/users.controller.ts` managed handlers | Missing actor on reset/reactivate/revoke; create service actor-free | Propagate authenticated actor on every managed security operation; preserve decorators and response contracts | Update calls/mocks; no new role permissions | T3,T7,T11,T16 |
| `ims-backend/src/users/users.service.ts` createUser/updateUser/suspendUser/reactivateUser/deleteUser/revoke methods | Partial safeguards, no common target policy | Enforce policy in mutation transaction; add email token invalidation and audit; preserve history/self/count checks; transactional reactivation/revoke | Ordinary delegated edits remain usable; conflict responses deterministic | T1,T2,T5-T13,T17,T23 |
| Same, updatePassword | Unused unrestricted password setter | Confirm no callers, remove unused public entry point rather than create another reset API | Compilation catches any missed source caller; no remote API change | T16 plus caller search/typecheck |
| `ims-backend/src/auth/auth.service.ts` managed issuance/forgot/createAndSend/reset | Stale lookups, actor-free issuance, unconditional token update | Separate managed authority from public recovery; serialized current destination/status; atomic claim; invalidate siblings/revoke/audit together; mail after commit | Setup/inactive semantics and SMTP failure preserved explicitly | T3,T4,T14,T15,T18-T20,T23,T24 |
| Same, login | Verify snapshot then independently create session | Revalidate verified identity/password/status under shared account lock at final session creation | Extra DB transaction; keep expensive hash verify outside lock with snapshot comparison | T22 |
| `ims-backend/src/auth/session.service.ts` createSession | Independent Prisma write | Permit internal transaction-client session creation from validated login flow; no unauthenticated generic override | Preserve existing token/hash/expiry behavior | T22,T25 |
| `ims-backend/src/settings/settings.service.ts` updateAccount/changePassword | Sessions revoked; reset tokens not; pretransaction credential/identity reads | Recheck current identity/password snapshot in transaction, invalidate tokens, audit, preserve cookie contract | Photo file cleanup remains outside DB and must retain current cleanup paths | T12,T13,T20,T23 |
| `ims-backend/src/users/user-roles.service.ts` assign/remove | Serializable, separate target membership writes | Participate in common target locking to avoid concurrent protection changes; retain actor policy/audits/compatibility checks | No change to Administrator-only authority or grant semantics | T17,T21 |
| `ims-backend/src/auth/rbac/permission-resolver.service.ts` optional narrow shared calculation | Resolver reads own Prisma client | Only if needed: expose shared transaction-compatible grant calculation to policy; preserve guard semantics | Avoid stale cache or Admin fallback; avoid broad refactor | Existing rbac.spec.ts + T16 |
| New helper's audit utility or direct transactional writes in services | Role-only audit coverage | Use existing AuthorizationAuditEvent with sanitized security event payloads; no new audit subsystem | No secret/PII expansion; audit failure rolls back | T23 |
| `ims-backend/src/settings/dto/update-account-settings.dto.ts`, `settings.controller.ts` (conditional) | No confirmation; multipart fields limit 5 | If approved, accept scoped credential proof and adjust field limit only as needed | Backend-only requirement would break form submissions | T26 |
| `ims-frontend/src/lib/settings.ts`, `ims-frontend/src/components/admin/settings/EditAccountDialog.tsx` (conditional) | No current password on email change | Only if approved: transmit proof for changed email, clear secret on close; no role-tab cleanup | Harmless edits/photo upload unchanged | T26/browser |
| Existing/new test files listed above; `ims-backend/test/e2e.setup.ts` only if safely needed | Mocks and stale expectations | Extend regression; isolate explicit real DB fixture; reconcile account-related obsolete assertions | Never run fixture against current application DB | All |

Do not automatically create an injectable policy service/module when a stateless transaction helper suffices. Existing module registrations remain unchanged under this recommendation. No generic service should accept a caller-provided flag bypassing checks.

## Database Impact

**No application schema change or migration is required for core Phase 1.** Existing token usedAt/expiresAt/userId, User identity/status, sessions, memberships and JSON audit events support invalidation, atomic claims, transactional auditing and row locks. Reuse usedAt as the existing invalidation marker; use audit reason to distinguish consumption from security invalidation rather than adding columns now.

Do not modify or apply the refund migration, forecast drift reconciliation, or any live database. Later real-DB tests may provision existing schema in an explicitly disposable database. This is not authorization to migrate the application database during planning.

New-email verification or persistent recent-auth design could require additional product/schema work; those are not assumed core requirements.

## Implementation Order

1. Reconfirm baseline and preserve user work; settle the bounded policy decisions below before dependent implementation.
2. Add failing service/HTTP takeover, target-membership, token-invalidation and direct-service tests; update only obsolete account test assumptions.
3. Define shared operation/predicate/transaction-lock contract. Add protected and ordinary fixture coverage before broad call-site edits.
4. Propagate actor context and enforce managed policy, including creation/scalar role boundary and removing unused password setter.
5. Integrate the shared account serialization protocol in managed identity/status changes, membership mutation and self-service password/email changes. Preserve Serializable last-admin checks.
6. Harden issuance and consumption together: fresh destination/status, atomic claim, sibling invalidation, session revocation and audit in transaction; mail after commit.
7. Revalidate login's verified credential snapshot before transactional session creation. Add current-session/actor checks at managed boundaries.
8. Complete transactional security events and sanitized denied/delivery logging. Implement optional self-email confirmation only after its decision, including all equivalent routes.
9. Run targeted mock tests, then guarded PostgreSQL concurrency/rollback tests. Resolve failures without weakening authority.
10. Run backend full/type/lint/e2e checks and any necessary settings frontend checks; perform controlled account-flow acceptance. Produce implementation evidence and stop at Phase 1.

## Validation Strategy

These are future validation commands, not results from this review. Run from `ims-backend`:

```powershell
npx tsc --noEmit -p tsconfig.build.json
npm test -- --runInBand --testPathPatterns='users-authorization|users-safeguards|user-roles.service|settings-authorization|auth.service|session.service|rbac|auth-permissions|password-reset-notifier|roles.service'
npm test -- --runInBand
npm run test:e2e -- --runInBand
npx eslint "{src,apps,libs,test}/**/*.ts"
npx prisma validate
```

`npm run lint` includes --fix: do not use it for read-only validation. `npm run test:e2e` is real configured script, but existing e2e assertions require account-policy reconciliation; a failure must be reported, not hidden. A real-DB suite must be explicitly opted in with the reviewed fixture configuration. No invented existing script is claimed for it; implementation must document the exact invocation and verify that its tests actually ran.

If conditional self-service frontend work is approved, run from `ims-frontend`:

```powershell
npx tsc --noEmit
npm run lint
node --test --test-isolation=none tests/authStore.test.cjs tests/permissions.test.cjs
npm run build
```

Browser acceptance: ordinary manager edits ordinary staff, Administrator manages another protected account, protected denial is understandable, self-service profile/email/password works under approved policy, setup/reset links follow chosen status rules, and old sessions/tokens fail. Use test mailbox/notifier; never exploit a live Administrator account. Validate audit rows with secrets redacted.

No Python forecasting, POS, schema-drift or migration-deployment work belongs to this phase. Verify final git diff contains only authorized account-security implementation/test files when implementation is separately requested.

## Risks

- Mock transactions cannot establish rollback or isolation. Explicit PostgreSQL evidence is mandatory for concurrency claims.
- Lock ordering, retry semantics and sending mail inside a retried transaction can cause deadlocks or duplicate sends; keep mail post-commit and lock accounts deterministically.
- Existing last-admin protections concern counts/memberships, not all possible recovery loss; preserve legitimate last-Admin email/password recovery.
- A session validated before a mutation can become stale. Recheck at managed mutation boundaries; broad retroactive cancellation of every in-flight application request is not promised.
- Incorrect actor/target classification could either leave a bypass or overblock all STAFF because their compatibility role is also protected.
- Appending audit data adds a new failure mode; deliberately fail the security transaction if its required success audit cannot persist.
- Token invalidation after credential changes will invalidate links users already received. Explain safe retry paths; never revive old tokens.
- Mail delivery can fail after token creation or account setup. Preserve pending-user recovery and do not equate mail failure with rolled-back account creation.
- Legacy mocked e2e tests are not a trustworthy concurrency baseline and contain stale role expectations.

## Open Policy Decisions

| Decision | Recommendation for review | Default scope boundary |
| --- | --- | --- |
| Harmless profile edits on protected targets | Allow only explicit names/phone harmless fields; deny email/role/lifecycle/recovery/session control to delegates | Do not accidentally classify a future recovery phone as harmless |
| Powerful custom-role targets | Review separately whether identity transfer requires privilege dominance or Administrator authority | No arbitrary grant-comparison hierarchy introduced in Phase 1 |
| Self-service email confirmation | Recommend current-password proof for actual email change, including managed self-edit equivalent | Conditional, not silently required; no large verification feature |
| New-email verification | Separate future enhancement | EmailVerificationToken model alone is insufficient infrastructure |
| Suspension token invalidation | Recommend invalidating previously issued tokens at suspension | Preserve authorized later inactive reset unless owner changes policy |
| Role elevation token invalidation | Consider revoking old recovery tokens when authority changes | Explicit decision before implementation; do not infer from session revocation |
| Denied-attempt persistence | Structured sanitized logs initially; retention/storage policy reviewed | Success events transactional; denied event cannot live solely in rolled-back tx |
| Audit PII | Prefer IDs/change indicators over email snapshots | Do not log secrets; append-only guarantee requires deployed DB privilege review |
| Public SMTP failure response/throttle expansion | Generic public response plus internal diagnostics recommended; distributed limits depend on deployment | Do not build an unrelated queue/distributed platform in Phase 1 |

These decisions do not block preparation of the core protected-Administrator fix. The subsequent implementation prompt should record choices before implementing dependent behavior. No new roles.view, roles.manage or settings.manage is proposed.

## Out-of-Scope Findings

Previously documented POS/offline/idempotency/discount, Alerts/Forecasting permission, variant/report/UI permission, refund migration and forecast drift issues are explicitly excluded. No implementation plan for those modules is included here. Users role-tab cleanup is excluded. No package upgrades, unrelated lint fixes, production migration or broad architecture refactor is proposed.

Powerful custom-role identity control remains a security policy limitation until separately resolved; protecting known Administrator targets must not be described as solving every possible delegated-account privilege relationship.

## Phase 1 Exit Criteria

- Delegated users.manage cannot transfer protected Administrator identity via managed email, managed reset, public-reset alternative, or internal service reuse.
- Protected Administrator membership is recognized without treating every protected/system role as Administrator or granting membership-only actors scalar role-administration authority.
- Managed suspend/reactivate/delete/session-revoke obey target policy with their existing action grants.
- Ordinary delegated staff management and authorized Administrator operations pass positive tests; no blanket Administrator requirement replaces delegation.
- Direct privileged creation/scalar role/membership changes remain Administrator-only; last-active-Administrator count and compatibility protections pass, including concurrent cases.
- Both managed and self-service email changes, and password changes, invalidate outstanding recovery tokens in the same security transaction.
- One token yields at most one committed reset; current state is revalidated after serialization; reset cannot resurrect a concurrently suspended account.
- Reset issuance cannot leave a usable stale-destination token after email change. Concurrent issuance behavior is tested.
- Existing session revocation/cookie/status behavior is preserved; login concurrent with credential replacement cannot create a usable stale-credential session.
- Required security mutation audits are attributable, sanitized and transactional; no immutability claim exceeds evidence.
- Actual disposable PostgreSQL race/rollback tests run and pass; skipped integration tests do not satisfy the gate.
- Relevant backend/type/lint/e2e checks pass or explicitly identified unrelated pre-existing failures are reviewed; account tests must not preserve obsolete Administrator-only Settings behavior.
- Open dependent policy choices are documented; optional confirmation has complete client/server coverage if selected.
- No schema/catalog/later-phase changes are introduced. Prior reports and unrelated user work remain preserved.

## Final Planning Recommendation

Proceed to a separately authorized Phase 1 implementation using a narrow transaction-aware account-security helper, service-enforced protected-target rules, serialized recovery/identity mutations, atomic token claim and existing audit schema. Preserve the intended Administrator-only role architecture and ordinary self-service/delegation.

Review the listed policy choices before implementing conditional behavior. Do not infer production readiness from this plan or historical unit-test counts. This task ends with investigation and this single complete Markdown export; no fixes have been made.
