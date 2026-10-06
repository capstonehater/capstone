# Security and Production Readiness Remediation Plan

Project: Cafe Salvacion IMS  
Review date: October 2, 2026  
Reviewed commit: `7f98d31`  
Status: Planning only; implementation and deployment remain pending.

# Executive Summary

**The Administrator takeover path is confirmed. The system should remain RED pending remediation and release verification.**

The review covered authentication, user management, RBAC guards, frontend callers, checkout, Prisma models, migration SQL, and existing test structure.

- A delegated `users.manage` holder can change an Administrator's email without changing their role, then reset the password and acquire that identity.
- Blocking managed password-reset initiation alone is insufficient: public forgot-password also uses the account's current email.
- The refund migration requires a controlled data-conversion rollout. Its actual production impact is unknown.
- Alerts, Forecasting, product variants, Users, and report drilldowns have confirmed authorization mismatches.
- Additional findings concern reset-token invalidation and concurrency, offline checkout attribution, client-selected discounts, and idempotency replay.
- Administrator-only role administration must remain unchanged.

No implementation changes, migrations, or commits were made during the planning review. This Markdown document was subsequently created at the user's request to export the plan. The existing audit report was left untouched.

# Repository Architecture Summary

| Area | Implementation and trust boundary |
| --- | --- |
| Backend | NestJS; installed `@nestjs/core` 11.1.17. Controllers handle HTTP contracts; services perform Prisma mutations. |
| Frontend | Next.js 16.2.1, React 19.2.4, Zustand authentication state. |
| Database | PostgreSQL through Prisma 6.19.2. Shared application database; ownership restrictions are principally application-enforced. |
| Authentication | Opaque session cookies; server stores HMAC-SHA256 token hashes and validates session expiration, revocation, account status, and password-change time. |
| Authorization | Global guard order: session authentication, permissions, legacy roles. `PermissionResolver` reads current database grants. |
| RBAC | `AccessRole`, `Permission`, `RolePermission`, `UserRole`, and `AuthorizationAuditEvent`. Catalog contains 34 supported keys. |
| Legacy authority | `User.role` remains authoritative for intentionally Administrator-only endpoints. Protected RBAC memberships also participate in last-administrator safeguards. |
| Frontend authorization | `can()`, `PermissionAction`, and `PermissionRoute` consume backend permission snapshots. These are UX controls, not security boundaries. |
| Authentication payload | `AuthPermissionsInterceptor` enriches login and `/auth/me` responses with roles, effective permissions, and revision. |
| Self-service settings | Controllers derive the account ID from the authenticated session, not a submitted target ID. |
| Offline checkout | Browser local storage queues requests; synchronization uses the current authenticated session and normal checkout endpoint. |

`PermissionsGuard` deliberately rejects routes containing both permission and role metadata. Alerts and Forecasting cannot safely receive permission decorators while retaining their controller-level `@Roles`.

# Confirmed Issues

| Finding | Classification | Severity / impact | Source evidence and recommendation |
| --- | --- | --- | --- |
| Administrator email takeover | Confirmed | High; privilege escalation | `UsersController.updateUser` restricts role edits only. `UsersService.updateUser` accepts target email changes. Apply protected-target authorization before mutation. |
| Administrator account lifecycle operations | Confirmed | Security boundary gap | Suspend, reactivate, delete, and managed reset lack a general Administrator-target restriction. Last-admin checks protect counts, not every Administrator identity. |
| Administrator session revocation | Confirmed | Availability/security-control gap | `users.sessions.revoke` endpoints do not receive actor context in their service calls. Add protected-target checks while preserving their distinct permission requirement. |
| Pending refund migration | Partially Confirmed | Deployment readiness | SQL exists and the previous audit observed it pending locally. Current production migration state and affected-row counts remain unverified. |
| Forecast timestamp representation | Confirmed in repository | Low runtime risk; migration drift | Migration defines a database default; Prisma model declares only `@updatedAt`. Previous live comparison corroborated this locally. |
| Alerts/Forecasting policy mismatch | Confirmed | Permission revocation and UX inconsistency | Frontend uses catalog grants; backend reads require Administrator. |
| Variant action gates | Confirmed | UX inconsistency | Add/Delete use `products.edit`; backend requires `products.create`/`products.delete`. |
| Users permissions panel | Confirmed | Predictable 403 for delegated viewers | `UserEffectivePermissions` calls Administrator-only `/users/:id/roles`. |
| Role-assignment UI | Confirmed | Unnecessary restriction | Administrator-only API controls are additionally wrapped in `users.manage`. |
| Report order drilldown | Confirmed | Predictable 403 | Report caller uses `/orders/:id`, requiring `pos.orders.view`, without the additional UI check. |

## Administrator takeover chain

Primary evidence:

- [UsersController](ims-backend/src/users/users.controller.ts)
- [UsersService](ims-backend/src/users/users.service.ts)
- [AuthService](ims-backend/src/auth/auth.service.ts)

| Step | Endpoint / method | Authority, validation, and mutation |
| --- | --- | --- |
| 1. Obtain delegated access | Protected user-management requests | Session validation and `users.manage` succeed. No Administrator authority is necessary. |
| 2. Identify Administrator | `GET /users`, `GET /users/:id` | These require `users.view`. Alternatively, the attacker already knows the ID; `users.manage` alone does not grant listing. |
| 3. Replace email | `PATCH /users/:id` -> `updateUser` | Email format and uniqueness are checked. Administrator check applies only when `dto.role` is present. Email is updated; existing target sessions are revoked. |
| 4. Initiate reset | `POST /users/:id/password-reset` -> `issuePasswordResetForUserId` | Requires `users.manage`; permits pending, active, and inactive targets. No protected-target check. |
| 4a. Alternative reset | `POST /auth/forgot-password` -> `forgotPassword` | Public, throttled; an active target is found using the newly assigned email. |
| 5. Generate token | `createAndSendPasswordReset` | Invalidates previous unused tokens and stores a new hashed, expiring token. |
| 6. Deliver token | `PasswordResetNotifierService.sendResetLink` | Sends to the current target email—the attacker-controlled address. Actual delivery is an attack precondition. |
| 7. Complete reset | `POST /auth/reset-password` -> `resetPassword` | Checks token and password rules; updates password, consumes tokens, and revokes sessions. No email-ownership protection compensates for step 3. |
| 8. Authenticate | `POST /auth/login` -> `login` | New email/password authenticates the unchanged Administrator identity. |

This is source-confirmed, not a live exploit demonstration.

# False Positives / Audit Items Requiring Clarification

1. **Pending migration does not establish broken reports.** `ReportsService` explicitly handles both `VOID` and `REFUND`. Migration changes classifications and resulting report categories; source does not support claiming universal report failure before conversion.
2. **Email changes already revoke sessions.** Both managed and self-service email updates revoke existing sessions. The missing protection is authority to change the identity and invalidation of outstanding recovery tokens.
3. **Frontend permission mismatches do not automatically bypass backend authorization.** Variant and report mismatches primarily hide valid actions or expose actions that receive 403.
4. **Role administration is intentionally Administrator-only.** It should not migrate to invented role permissions.
5. **Forecast default drift is not demonstrated data corruption.** Prisma-managed writes can function despite the mismatch. Future migration generation and non-Prisma inserts are the relevant concerns.
6. **Local migration state is not production state.** The previous audit's database observations must be repeated against the explicitly identified release target.
7. **Checkout idempotency needs a more precise classification.** Missing payload binding is a confirmed API semantics issue. Cross-user disclosure is conditional on obtaining another order's key and holding `pos.checkout`; it is not an unauthenticated disclosure.
8. **Passing tests are historical evidence.** The prior audit recorded 800 backend, 20 frontend, and 17 Python tests passing. They were not rerun during this source-only planning review.

# Newly Discovered Risks

## Reset-token lifecycle

**Confirmed security defect:** `SettingsService.changePassword` revokes sessions but does not invalidate outstanding reset tokens. `AuthService.resetPassword` does not compare token issuance against `passwordChangedAt`.

A previously issued, still-valid token can therefore replace a password after a successful self-service password change.

Managed and self-service email changes also leave reset tokens valid. Someone controlling the previous delivery channel could retain a usable token after the email changes.

**Probable concurrency bug:** reset completion reads `usedAt` before its transaction, then updates the token by ID without an unused-token condition. Two concurrent requests can both pass the initial check. Sequential reuse is rejected; atomic single-use is not established.

**Recommendation:** serialize security mutations per account, atomically claim the unused token, and invalidate recovery tokens on password or login-identifier changes.

## Self-service email ownership

**Defense-in-depth recommendation:** changing one's own email requires a session but no current-password confirmation or verified new-email flow.

This is not arbitrary cross-account access. However, possession of a stolen session can become persistent account control through email replacement and reset.

Require recent credential confirmation for self-service login-identifier changes. Treat new-email verification as a separately scoped workflow if adopted.

## Privileged custom-role targets

**Additional authorization risk:** protecting only scalar `User.role === ADMINISTRATOR` leaves accounts with protected Administrator membership—or powerful custom grants—open to the same identity-takeover mechanism.

Minimum protection must include protected Administrator membership. Before release, decide whether delegated managers may transfer control of custom-role accounts with greater authority than themselves.

Recommended rule: delegated managers may edit ordinary profiles, but may not transfer identity or recovery control of a target whose effective grants exceed theirs.

## Offline queue attribution

**Confirmed attribution bug:** `ims-pos-checkout-queue` is shared browser storage with no originating user ID. After switching accounts, a different authorized user can synchronize the queue, and the server records that current user as creator.

This does not bypass `pos.checkout`, but it can misattribute sales.

Partition queues by authenticated user and prohibit silent synchronization by another user. Preserve existing queued sales for explicit reconciliation rather than deleting them.

## Checkout discounts

**Confirmed validation gap; business-policy impact unresolved:** DTO validation allows `discountRate` from 0 through 1. `PricingService` directly applies it without validating a discount code or approval policy.

A checkout-authorized caller can submit a 100% discount. Product base prices remain server-controlled.

Define allowed discounts server-side and derive rates from accepted codes. If arbitrary discounts are intentional, document who may grant them and what approval is required.

## Audit coverage and reset availability

- **Confirmed traceability gap:** role mutations produce authorization events, but managed email changes, resets, account status changes, and session revocations lack equivalent actor/target audit events.
- **Conditional enumeration risk:** unknown-account forgot-password returns the generic response, while a real account can produce an SMTP failure response. Delivery failures can therefore distinguish accounts.
- **Defense-in-depth:** forgot/reset throttling uses process-local IP buckets. Managed reset initiation does not use that throttle. Multi-instance and restart behavior require deployment-aware limits.
- **Configuration risk:** non-production mail fallback can log reset links. Production environment and log-access settings must be verified.

# Security Remediation Plan

## Protected operations and target definition

Use a focused account-security policy with explicit operations.

| Attribute / operation | Current exposure | Planned rule |
| --- | --- | --- |
| Email/login | Writable through managed update | Delegated manager denied for protected targets; ordinary-user management preserved. |
| Username | Schema field exists; not exposed by inspected update DTO or login flow | No invented migration; include in future identity-operation policy if exposed. |
| Direct password assignment | Not exposed by managed update DTO | Keep unavailable. |
| Managed setup/reset | `users.manage`; no target protection | Require actor context and protected-target authorization before token issuance. |
| Phone | Editable; no recovery use found | Ordinary profile field today. Reclassify as security-sensitive before any recovery use. |
| Recovery email, MFA, recovery codes | No corresponding management capability found | Do not build speculative features; policy should support future security operations. |
| Account suspension/reactivation/deletion | Delegated routes exist | Deny delegated operations against protected targets; retain self and last-admin restrictions. |
| Session revocation | Separate `users.sessions.revoke` capability | Preserve that grant and additionally protect Administrator targets. |
| Email verification state | Schema exists; not exposed in inspected update DTO | Do not allow client assignment. Clear or reconcile verification on email change. |
| Own settings | Session-derived target | Preserve authenticated self-service; add credential confirmation for identity changes. |

A protected Administrator target should mean legacy Administrator identity **or** membership in the protected Administrator access role. Do not equate every system role with Administrator authority.

## Enforcement location

| Option | Benefits | Limitations |
| --- | --- | --- |
| Controller-only | Simple, visible HTTP policy | Internal service calls and future controllers can omit checks. |
| Service-level checks | Protect actual mutations and service reuse | Repeated rules can diverge. |
| Focused policy called by services | Central decision logic plus mutation-boundary enforcement | Requires consistent actor propagation and transaction-aware reads. |

**Recommendation:** a small `AccountSecurityPolicy` used inside account-mutating services.

- Keep global permission guards.
- Require explicit actor context for managed operations.
- Re-read current actor authority and target protection inside the mutation transaction.
- Check the operation before any user, session, token, or audit mutation.
- Keep last-active-Administrator checks in the same transaction.
- Preserve Administrator-only direct role changes at the service boundary, not solely the controller.
- Use consistent account-row locking/serialization across reset issuance, reset completion, identity changes, and role-sensitive mutations.
- Do not provide an optional “skip authorization” flag.

Public recovery remains a distinct token/email-based workflow. It must not acquire a fake Administrator actor or reuse an unrestricted managed entry point.

For protected targets, allow delegated edits only to an explicit harmless-profile allowlist. Email, roles, activation, recovery, deletion, and session control remain protected.

## Audit integrity

Existing role audit events include actor, target user/role, action, and before/after state. Historical IDs intentionally survive deletion without foreign-key dependencies.

No application API for editing/deleting these events was found. **Database-level append-only integrity is not proven:** the schema/migration does not establish that the application database role cannot update or delete rows.

Plan:

- Record successful security mutations transactionally with actor, target, operation, and sanitized state.
- Log reset issuance separately from delivery success; sending an email is not transactionally atomic with PostgreSQL.
- Never log tokens, passwords, or SMTP credentials.
- Record denied attempts through structured security logging.
- Verify database privileges and retention before describing the log as immutable.

# Database Remediation Plan

## Refund migration analysis

Source: [migration SQL](ims-backend/prisma/migrations/20260922000000_convert_voided_orders_to_refunds/migration.sql).

| Table | Predicate | Changes |
| --- | --- | --- |
| `inventory_transactions` | `source_type = ORDER_VOID` and source ID references a currently VOID reversal | Sets transaction/source type to refund; saves original reversal type/reason; maps `VOID_APPROVED` to `CUSTOMER_REFUND`. |
| `order_reversals` | `type = VOID` | Changes type and mapped reason; stores original classification/reason and conversion timestamp. |
| `orders` | `status = VOIDED` | Changes status to `REFUNDED`. No original-status metadata is added here. |

Properties:

- Does not update stock-batch quantities, ledger lines, order payments, reversal amounts, or order totals.
- Does alter inventory-ledger headers and financial/reversal classification.
- Preserves original type/reason in reversal and transaction metadata.
- Does **not** provide complete rollback history for orders.
- JSON metadata concatenation overwrites existing keys with the same names; inspect collisions.
- A successful second run normally affects no converted rows because predicates no longer match.
- That limited idempotency does not guarantee safe recovery from partial failure or concurrent legacy writes.
- The file has no explicit transaction wrapper. Do not assume execution is atomic without validating the actual deployment procedure.
- Reclassifying every VOID reversal is broader than the comment's “completed-order voids” description. Production data must confirm that assumption.

**Reversibility:** manual or restore-based. Not automatically reversible. Exact pre-migration row snapshots are necessary to distinguish converted orders from genuine refunds.

## Pre-migration preparation

1. Identify the target database, deployment environment, application version, and database owner.
2. Verify a restorable backup and recovery-point requirements.
3. Count all three exact predicate sets.
4. Compare order/reversal relationships: VOID reversals with non-VOIDED orders; VOIDED orders without matching VOID reversals; ORDER_VOID transactions without matching reversals; metadata-key collisions; duplicate or inconsistent reversal records.
5. Capture affected row IDs and full original values securely.
6. Inspect representative rows and financial/stock totals.
7. Compare migration files/checksums with `_prisma_migrations`, including failures and other pending migrations.
8. Confirm current report and POS expectations with the business owner.
9. Establish a maintenance window, write-quiescence plan, timeout limits, and rollback owner.

Do not equate “pending” with permission to deploy every pending migration.

## Staging dry run

Restore a production-representative backup into an isolated database.

- Apply the approved migration procedure.
- Verify exact expected update counts.
- Confirm payments, amounts, stock quantities, and ledger-line totals are unchanged.
- Confirm only the intended classifications/reasons changed.
- Verify original metadata preservation and order snapshots.
- Repeat the SQL in staging to demonstrate the expected no-op.
- Rehearse interruption recovery and rollback.
- Compare refund/void reports, POS history, and aggregate sales before and after.

No production row-impact count can be established from repository source alone.

## Schema drift strategy

Recommended reconciliation: retain the database's insertion default and represent it explicitly in Prisma alongside `@updatedAt`.

Reasoning:

- The migration intentionally seeds `forecast_settings` without supplying `updated_at`.
- The database default supports raw SQL inserts.
- Prisma's `@updatedAt` handles Prisma-managed updates; it is not a database update trigger.
- Removing the default provides little benefit and changes non-Prisma insert behavior.

Inspect all target environments first. Generate and review any required forward migration in a disposable environment; do not edit applied migration history or reset the database.

# Authorization Cleanup Plan

1. **Alerts:** Remove controller-level Administrator metadata. Require `alerts.view` for list and unread count, `alerts.acknowledge` for acknowledgment, and `alerts.dismiss` for dismissal. Preserve actor attribution and state rules. Administrators without the grant should receive 403 after migration.
2. **Forecasting:** Remove controller-level Administrator metadata. Require `forecasting.view` on the three GET endpoints. Retain method-level Administrator-only authorization on `PUT /forecasting/settings`. Existing frontend configuration controls already check Administrator. Do not add `settings.manage`.
3. **Users:** Preserve `users.view`, `users.manage`, and `users.sessions.revoke`. Add service-enforced protected-target policy. Keep role APIs Administrator-only. Do not broaden the role-read endpoint to accommodate the permissions tab.
4. **Products:** Correct frontend gates; retain backend create/edit/delete distinctions.
5. **Reports:** Keep report access under `reports.view`. Enable order drilldown only with `pos.orders.view`. No new report-specific detail endpoint is needed for this remediation.

# Frontend Alignment Plan

Page-level permissions remain prerequisites for reaching these actions.

| Module | Action | Frontend permission | Backend permission | Match? | Intended permission | Required change | Security impact | UX impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Alerts | Read/count | `alerts.view` | Administrator | No | `alerts.view` | Migrate backend | Enforces catalog grants | Custom roles work |
| Alerts | Acknowledge | `alerts.acknowledge` | Administrator | No | Same catalog key | Migrate backend | Correct mutation authority | Avoid 403 |
| Alerts | Dismiss | `alerts.dismiss` | Administrator | No | Same catalog key | Migrate backend | Correct mutation authority | Avoid 403 |
| Forecasting | Read | `forecasting.view` | Administrator | No | `forecasting.view` | Migrate GETs | Enforces read grants | Custom roles work |
| Forecasting | Configure | Administrator | Administrator | Yes | Administrator | Preserve | Preserves global boundary | No intended change |
| Variants | Add | `products.edit` | `products.create` | No | `products.create` | Correct button/dialog gate | Backend unchanged | Correct visibility |
| Variants | Delete | `products.edit` | `products.delete` | No | `products.delete` | Correct button/dialog gate | Backend unchanged | Correct visibility |
| Variants | Edit | `products.edit` | `products.edit` | Yes | Existing | Preserve | None | None |
| Users | Effective permissions | `users.view` page | Administrator | No | Administrator | Hide tab/component for others | No API weakening | Avoid failed fetch |
| Users | Assign roles | Administrator + `users.manage` | Administrator | No | Administrator | Remove unrelated wrapper | Preserve role boundary | Restore valid controls |
| Users | Create privileged user / scalar role edit | `users.manage` | `users.manage` + Administrator | No | Existing backend rule | Restrict role choices | Prevent misleading controls | Staff creation preserved |
| Users | Protected account operations | Generic action grant | Generic grant plus planned target policy | Incomplete | Grant + target policy | Mirror restrictions | Server remains authoritative | Explain disabled actions |
| Reports | Order detail | `reports.view` page | `pos.orders.view` | No | Additional order grant | Gate button and handler | Preserve detail boundary | Reports remain usable |
| Settings | Own account | Authenticated | Authenticated | Yes | Self-service | Preserve | Ownership retained | No unrelated restriction |

For role assignment, removing `users.manage` does not grant access to the entire Users page. An Administrator still needs the page's `users.view` prerequisite; changing that navigation policy is outside this fix.

# Required Code Changes

These are proposed changes, not implemented changes. Backend paths are relative to `ims-backend/src`; frontend paths to `ims-frontend/src`.

| File / function | Current behavior | Proposed change and reasoning | Compatibility / regression risk |
| --- | --- | --- | --- |
| New `users/account-security.policy.ts` | No shared actor-target policy | Centralize protected-target and managed-operation decisions using transaction-loaded identity/memberships | Incorrect target classification could overblock delegated managers |
| `users/users.module.ts` | No policy provider | Register/export narrowly as needed | Avoid expanding existing Auth/Users circular coupling |
| `users/users.controller.ts` | Several security operations omit actor context | Pass authenticated actor to managed reset, reactivation, and session-revocation services | Update mocks/call signatures |
| `users/users.service.ts` | Generic managed writes; scalar-role authorization partly controller-only | Enforce operation policy inside transaction; retain last-admin/history checks; invalidate reset tokens on email change; audit changes | Preserve normal staff edits and established error behavior |
| `auth/auth.service.ts` | Actor-free managed reset; non-atomic token claim | Separate managed/public recovery entry points; protect managed issuance; serialize account security operations; atomically consume valid token | Pending setup, inactive accounts, and concurrent reset flows |
| `settings/settings.service.ts` | Sessions invalidated, reset tokens retained | Invalidate reset tokens on password/email changes; require credential confirmation for email changes | Email update now requires an additional confirmation step |
| `settings/dto/update-account-settings.dto.ts` and corresponding settings form/caller | No email-change credential proof | Add scoped credential-confirmation input and update multipart field limit if necessary | Do not require password for harmless profile edits |
| Existing audit-event writers / focused account audit helper | RBAC mutation coverage only | Add sanitized account-security events using existing audit model | Avoid storing secrets or unbounded PII |
| `alerts/alerts.controller.ts` | Class-level Administrator role | Apply individual existing catalog permissions | Incorrect mixed metadata would cause server errors |
| `forecasting/forecasting.controller.ts` | Class-level Administrator role | Permission-gate GETs; method-level Administrator PUT | Verify every handler's final metadata |
| `components/admin/products/ProductVariantsRecipeTab.tsx` | Add/Delete use edit grant | Use create/delete grants; check associated dialog and submit paths | Action-only roles need deliberate UI tests |
| `components/admin/users/UsersWorkspace.tsx` | Permissions tab and role controls mismatch backend | Administrator-only role panels; target-aware controls; restricted role choices | Selected tab/dialog must close after authority changes |
| `components/admin/users/UserEffectivePermissions.tsx` | Calls role API whenever mounted | Ensure Administrator-only mounting | Avoid introducing a new role-read permission |
| `components/admin/reports/PosTransactionHistorySection.tsx` | Ungated order-detail fetch | Gate action and handler with `pos.orders.view` | Keep report rows/export available |
| `components/layout/shell-navigation.ts` | Stale future-role-permission TODO | Document intentional Administrator-only architecture | Documentation-only |
| `orders/orders.service.ts` | Global replay without owner/payload comparison | Bind replay to authenticated creator and canonical request; return conflict on mismatch; handle unique-key races | Retry semantics and legacy orders |
| `orders/dto/checkout.dto.ts`, `orders/pricing.service.ts` | Arbitrary bounded discount rate | Validate approved discount codes and derive rate server-side after business policy is settled | Existing queued discounts need compatibility handling |
| `lib/pos-offline.ts`, `components/staff-pos/StaffPOSPage.tsx` | Shared unowned queue | Partition by user; prevent account-switch auto-sync; reconcile legacy entries explicitly | Never silently discard unpaid/unsynced transactions |
| `ims-backend/prisma/schema.prisma` | Forecast timestamp lacks default | Represent existing insertion default; add idempotency fingerprint only if approved design requires it | Review any generated migration separately |

For idempotency, use persisted request identity rather than recalculating historical requests against current catalog prices. A stored canonical fingerprint may require an additive migration. Legacy rows need an explicit conservative replay policy.

# Required Tests

Extend the current Jest and Node test patterns. Existing HTTP authorization suites mock business services, so they cannot alone prove mutation safety.

## Account-security regression

Extend `users/users-authorization.spec.ts`, `users/users-safeguards.spec.ts`, `users/user-roles.service.spec.ts`, and `settings/settings-authorization.spec.ts`.

1. Non-Administrator with `users.manage` changing Administrator email receives **403**; no user/session/token mutation.
2. Same actor initiating managed Administrator reset receives **403**; no token creation or email.
3. Ordinary staff profile edits remain allowed.
4. Authorized Administrator protected operations remain allowed with required endpoint grants.
5. Direct scalar role changes and role assignment remain denied to delegated users.
6. Self-delete, self-suspend, and last-active-Administrator protections remain intact.
7. Protected membership is recognized even when the scalar role differs.
8. Administrator suspension, reactivation, deletion, and session revocation are denied to delegated actors.
9. No session returns 401; missing action permission returns 403.
10. Direct service invocation cannot bypass actor-target checks.
11. Concurrent target promotion/security mutation cannot bypass protection.
12. Last-admin email change remains possible through legitimate authority; harmless updates are not treated as deletion.
13. Powerful custom-role target behavior matches the approved delegation rule.

## Password reset

Add a focused AuthService test suite using existing Jest conventions.

- Reproduce the complete takeover sequence before fixing it, with mocked mail.
- Verify public forgot-password cannot compensate for a denied email change.
- Password and email changes invalidate outstanding tokens.
- Expired and sequentially reused tokens fail.
- Two concurrent confirmations yield only one committed password change.
- New reset issuance invalidates prior tokens.
- Reset completion revokes all sessions.
- Pending setup activates the account; inactive status cannot be silently bypassed.
- Password complexity remains enforced.
- SMTP failures preserve generic public responses and produce internal diagnostics.
- Tokens/secrets never appear in production responses or logs.

Use a disposable PostgreSQL integration fixture for concurrency; mocked transactions are insufficient.

## Authorization and frontend

- Extend all eight module authorization regressions.
- Add Alerts and Forecasting authorization suites using the existing HTTP test structure.
- Verify Administrator without catalog grant cannot bypass migrated reads/actions.
- Verify Forecast settings remains Administrator-only.
- Verify create-only, edit-only, and delete-only variant combinations.
- Verify non-Administrator Users viewers never call role APIs.
- Verify Administrator role controls are not hidden by `users.manage`.
- Verify reports-only users can read reports without invoking order detail.

## POS and migration

- Offline modified payload cannot bypass permissions, product status, modifier validation, stock allocation, or server pricing.
- Reject discounts outside approved server policy.
- Validate quantity semantics; current DTO permits fractional quantities above one, so confirm whether that is intended.
- Same owner/key/payload replays without duplicate stock/payment effects.
- Same key with different payload conflicts.
- Different owner cannot retrieve another order through replay.
- Concurrent identical requests produce one order and a controlled replay/conflict response.
- Account switching cannot silently sync another user's queue.
- Migration staging checks prove expected classification changes and unchanged stock/payment amounts.

## Exact validation commands

Run after implementation, from the indicated directories.

**`ims-backend`:**

```powershell
npx tsc --noEmit -p tsconfig.build.json
npm test -- --runInBand
npm test -- --runInBand --testPathPatterns='authorization|rbac|user-roles|users-safeguards|roles.service|auth-permissions'
npx eslint "{src,apps,libs,test}/**/*.ts"
npx prisma validate
npx prisma migrate status
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code
```

The backend `npm run lint` script includes `--fix`; use the direct command above when validation must remain non-mutating.

**`ims-frontend`:**

```powershell
npx tsc --noEmit
npm run lint
node --test --test-isolation=none tests/authStore.test.cjs tests/permissions.test.cjs
npm run build
```

**Repository root:**

```powershell
.\.venv\Scripts\python.exe -B -m unittest discover -s python -p 'test_*.py'
```

Prisma status/diff must target the intended environment explicitly. These commands inspect state; they do not establish backup quality or business correctness.

# Deployment Checklist

## Pre-deploy

- Approve protected-target, custom-role delegation, discount, and legacy-idempotency policies.
- Complete security regressions and code review.
- Verify release database identity, backup restoration, checksums, and affected-row snapshots.
- Verify SMTP, cookie, origin/proxy, reset-token exposure, and distributed throttling configuration.
- Inventory pending offline transactions.

## Migration

- Stop incompatible writers and drain active transactions.
- Execute only the reviewed migration set through the rehearsed procedure.
- Monitor locks, duration, update counts, and failures.
- Do not blindly run all pending migrations or mark failed migrations applied.

## Deploy

- Deploy compatible backend before dependent frontend behavior.
- Invalidate outstanding reset tokens and sessions as required by the approved incident/remediation plan.
- Preserve Administrator recovery access.
- Keep the approved forecasting CSV unchanged.

## Post-deploy

- Confirm migration status and reviewed schema diff.
- Verify refund classifications, original-history snapshots, stock totals, payments, POS history, reports, and forecasting startup.
- Exercise Administrator, delegated manager, read-only, and denied-role browser flows.
- Confirm offline synchronization, retry behavior, audit attribution, and real controlled email delivery.

## Rollback validation

- Rehearse application rollback compatibility with transformed data.
- Restore exact captured values or a verified backup under controlled write conditions.
- Do not convert all refunds back to voids.
- Reconcile transactions created after the backup before any restore.
- Recognize that emailed links and external actions cannot be undone by database rollback alone.

# Risks

- Production data may violate assumptions not represented in tests.
- A delegated manager's control over privileged custom-role accounts requires an explicit policy.
- Database concurrency behavior needs integration testing.
- Raw SQL updates do not inherit Prisma's `@updatedAt` behavior.
- Offline sales can outlive users, permissions, menu prices, and deployments.
- Append-only audit guarantees depend on actual database privileges.
- Public reset behavior depends on mail delivery and deployment configuration.
- CSRF middleware accepts unsafe requests without Origin/Referer; deployment testing is required before classifying exploitability.
- Restricting discounts and identity changes can disrupt legitimate workflows unless rollout communication and compatibility are handled.

# Recommended Implementation Order

1. **Reproduce account-control and reset-token defects in tests.**
2. **Implement protected-target enforcement and reset lifecycle fixes.** Preserve ordinary delegated management and Administrator-only role administration.
3. **Run full RBAC/security regression.** Include real-database concurrency tests.
4. **Resolve checkout policy and implement idempotency/offline safeguards.** Coordinate any additive schema requirements.
5. **Align frontend gates and migrate Alerts/Forecasting reads.**
6. **Prepare and rehearse database conversion and drift reconciliation.** Preparation may run alongside coding; production execution waits for compatible release artifacts.
7. **Perform authenticated browser, SMTP, offline, and reporting acceptance.**
8. **Execute the controlled release and post-deployment verification.**

Avoid broad service refactoring during these changes.

# Final Release Gate

Move from **RED** to **READY FOR RELEASE REVIEW** only when:

- Both managed-reset and public-reset takeover chains are blocked at the identity-mutation boundary.
- Protected account operations enforce actor and target authority in services.
- Reset tokens are invalidated appropriately and consumed atomically.
- Ordinary delegated management and Administrator recovery remain functional.
- Role administration remains Administrator-only.
- Confirmed permission mismatches are corrected.
- Checkout discounts, replay identity, and offline attribution have tested policies.
- The target database's migration impact is quantified, rehearsed, and reconciled.
- Backup restoration and rollback procedures are demonstrated.
- Required automated checks pass, with warnings reviewed.
- Authenticated browser and controlled email tests pass.
- Security and business owners review the evidence and remaining risks.

**Unit-test success alone is not a release approval.**
