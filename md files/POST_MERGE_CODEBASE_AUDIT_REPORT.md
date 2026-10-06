# Executive Summary

Audit date: 2026-10-01. Audited HEAD: 7f98d31dbf4f088df3114c84d6d2e6da6fdc6f04 on main, tracking capstone/main.

**Final verdict: RED ? blocking security/readiness issues found.** The merge itself is intact and the application compiles, builds and passes its existing tests. It is not a clean production/security sign-off: delegated users.manage still permits an indirect Administrator takeover path; the configured local database has a pending data migration and a schema-default discrepancy. Several frontend/backend permission mismatches also remain.

No implementation fixes, refactoring, migrations, seed operations, commits or pushes were performed. This report is the only new project artifact. Requested checks generated ordinary ignored build/test artifacts. Database operations were validation, migration-status inspection and read-only schema comparison only. No account takeover or live business mutation was attempted.

Scope: source review of every controller policy, core auth/RBAC/services/DTOs, schema/migration structure, frontend routes/helpers/actions and changed forecasting code; automated tests/builds; CSV structural inspection. This is not an exhaustive proof of every execution path, browser hydration, live payment/email delivery, concurrent transaction safety or forecasting accuracy. WORKING below means supported by source and automated checks, not a complete live user acceptance test.

# Merge Verification

- git status initially clean: main...capstone/main.
- git log --oneline --graph -20 confirms merge 7f98d31, parents 7002064 and 1503a13. Integration commit 1503a13 itself preserves parents 5eb05f5 (RBAC) and 7002064 (team).
- git diff 1503a13 HEAD --stat is empty: the final PR merge has exactly the reconciled integration tree.
- git diff HEAD^ HEAD --stat reports 115 files, 8,246 insertions, 471 deletions relative to the team first parent. Most additions are the RBAC implementation/tests/documentation, not missing team work.
- No deleted paths in that first-parent comparison; no unmerged index entries; no source conflict markers found in backend/frontend/Python.
- Team POS focus/palette/modals/history, forecasting V3 and notes, inventory reports/modals and product styling remain in the reconciled tree.
- The approved CSV replacement remains present. No merge redo, branch reset or branch substitution was performed.

# RBAC Audit

## Architecture and models

The schema contains AccessRole, Permission, RolePermission, UserRole and AuthorizationAuditEvent at prisma/schema.prisma:873 onward. The 20260929000000_rbac_foundation migration is present and is not reported pending by the configured database. The models use unique role/permission keys, composite membership/grant primary keys and reverse-lookup indexes. Authorization audit identifiers deliberately retain historical attribution independently of entity lifetime.

AuthModule registers SessionAuthGuard -> PermissionsGuard -> RolesGuard and AuthPermissionsInterceptor. RequirePermission validates catalog keys and applies all-of requirements. PermissionsGuard rejects invalid keys and conflicting role/public metadata; no Administrator OR permission bypass exists. PermissionResolver reads fresh membership/active-account data and unions known grants. Inactive users have no effective grants. The auth interceptor enriches login and /auth/me with roles, effectivePermissions and authorizationRevision.

There are 34 catalog keys. Static frontend permission-literal comparison found no unknown keys and references to all 34. This does not establish correct action-to-key mapping. Controller decorators use 29 keys; dashboard.view is a page gate, while the three alerts keys and forecasting.view remain unenforced by their legacy controllers.

## Module authorization matrix

| Module | Permission keys | Authorization method | Status |
| --- | --- | --- | --- |
| Products | products.view/create/edit/archive/restore/delete | RequirePermission on 19 product/variant/recipe/read handlers | PASS backend; frontend action mismatch |
| Inventory | inventory.view/create/edit/archive/waste | RequirePermission on 12 material/unit/summary/history/waste handlers | PASS; no separate adjustment API |
| Stock Runs | stockRuns.view/create/edit/delete/post | RequirePermission on 10 handlers, including deletion aliases | PASS backend; composed UI needs material/supplier read grants |
| Suppliers | suppliers.view/create/edit/delete/searchAvailability | RequirePermission on four management and two discovery handlers | PASS; discovery does not inherit management authority |
| Reports | reports.view | Controller-level RequirePermission on 17 reporting reads | PASS; order drilldown needs separate operational grant |
| POS | pos.view/checkout/orders.view/refund | RequirePermission on menu and four Orders handlers | PASS; refund retains Administrator credential approval |
| Users | users.view/manage/sessions.revoke | RequirePermission on 12 handlers plus role-field restrictions | RISK: protected-target control gap |
| Settings | No feature key for personal account | SessionAuthGuard; no role allowlist | PASS self-service; global forecasting configuration remains legacy |

Shared categories and variant availability are session-only reads. Auth login/forgot/reset are explicitly public auth flows; logout/me require sessions. Settings never becomes public merely because it lacks RequirePermission.

## Remaining role checks

| Location | Classification | Assessment |
| --- | --- | --- |
| roles/roles.controller.ts:22, all five APIs | Intentional | Final Administrator-only role administration architecture; do not introduce roles.view/manage |
| users/user-roles.controller.ts:13, three membership APIs | Intentional | Administrator-only assignment/removal/list policy retained |
| users/user-roles.service.ts:22 onward | Intentional defense | Re-reads active Administrator actor; protects compatibility memberships/last Administrator |
| users/users.controller.ts:55,83 | Intentional mixed-operation boundary | Staff-only creation for delegated manager; submitted role edits require Administrator, but indirect takeover remains possible |
| users/users.service.ts:454,503,1091 onward | Intentional safeguards | Self role changes/suspension/deletion and last active Administrator protection |
| orders/orders.service.ts:613 and auth/auth.service.ts privileged approval | Intentional business policy | Refund requester permission plus Administrator approval credentials |
| alerts/alerts.controller.ts:11 | Needs migration | Four APIs still require legacy Administrator despite alert catalog keys/UI grants |
| forecasting/forecasting.controller.ts:25, three GETs | Needs migration | forecasting.view does not authorize backend reads |
| forecasting/forecasting.controller.ts:29 PUT settings | Legacy global setting; preserve until explicit policy change | No settings.manage key; do not use a read grant for writes |

No roles.view or roles.manage exists in production authorization/catalog usage. Role administration should remain Administrator-only. The shell-navigation TODO suggesting future role keys is stale.

## Frontend enforcement

AuthStore can/canAll consult server-supplied effectivePermissions and do not grant access by role name. Logout clears authorization state; focus/visibility refresh replaces grants. PermissionGuard/PermissionAction gate rendering. PermissionRoute uses the shared navigation map under authenticated admin/staff layouts; unknown routes deny. Administrator-only role navigation and authenticated-only Settings are intentional exceptions.

Cached UI grants may lag revocation until refresh, but every migrated backend request resolves current grants. Modifying browser permissions can expose buttons, not bypass server guards. Offline checkout checks cached grants before queue/sync and reaches the same guarded checkout endpoint on retry; server-side revocation blocks execution even if local queue creation used stale state.

# Backend Audit

| Check | Result |
| --- | --- |
| npx tsc --noEmit -p tsconfig.build.json | PASS |
| npm test -- --runInBand | PASS: 31 suites, 800 tests |

Authorization suites cover the eight migrated module areas, no-session 401, missing-grant 403, Administrator/custom grants and revocation. Settings intentionally does not require feature grants. Test logs include simulated SMTP rejection and disabled background-job messages; these do not establish a live SMTP failure.

Nest module/controller/service structure and DTO validation are intact. main.ts enables whitelist, forbidNonWhitelisted and transformation. A static module dependency review found AuthModule <-> UsersModule; both explicitly use forwardRef. This is managed circular coupling, not a newly detected startup failure. No additional static module cycles were found by the simple imports-array scan; it does not prove all runtime dependencies acyclic.

Large services and substantial domain calculations deserve dedicated regression tests. Most authorization HTTP suites mock business services/persistence; passing them does not prove database rollback, external integrations or concurrent posting. StockBatch.stockRunItemId is unique and Order.idempotencyKey is unique, so those safeguards should not be overlooked when reviewing concurrency. Full concurrent-client acceptance was not performed.

No backend lint command was required or run; do not interpret the TypeScript result as a clean backend lint/dead-code audit. No confirmed dead service was identified; controller-free helper services can be legitimate dependencies.

# Frontend Audit

| Check | Result |
| --- | --- |
| npx tsc --noEmit | PASS |
| npm run lint | PASS exit status, 0 errors, 16 warnings |
| npm run build | PASS: Next 16.2.1, 38 pages generated |
| node --test --test-isolation=none tests/authStore.test.cjs tests/permissions.test.cjs | PASS: 20 tests |

The ordinary Node test command first failed with sandbox spawn EPERM, before running tests. Running the existing tests without process isolation succeeded; this was an environment restriction, not an application assertion failure.

Lint warning inventory: Alerts two missing hook dependencies; InventoryWorkspace four; report sections seven; StaffPOSPage two; lib/reports.ts unused StockRun import one. All remain unfixed. Stale callback closures are a regression risk, not proof of a current infinite loop or stale data bug.

Build/type checks found no unresolved imports or compilation failures. Roles and no-access routes are generated. Dynamic inventory routes remain supported. No authenticated browser hydration/click-through was performed, so hydration health cannot be certified from a production build. Multiple dashboard/layout/modal implementations and legacy alias routes are maintainability candidates, not automatically dead code.

# Database Audit

Configured target: local PostgreSQL ims_db, public schema. Results do not establish remote/production database state.

- npx prisma validate: PASS; schema syntax and relations validate.
- npx prisma migrate status: NON-CLEAN, one pending migration among 19: 20260922000000_convert_voided_orders_to_refunds. RBAC foundation was not listed pending.
- Read-only comparison using migrate diff from schema datasource to schema datamodel found forecast_settings.updated_at default mismatch: database has NOW(), Prisma datamodel has no database default (@updatedAt only).
- The first diff attempt could not download the Prisma engine under restricted network access. Retried with approved network access; schema comparison completed and reported the difference. No SQL was applied.

The pending migration reclassifies historical VOID inventory transactions/reversals/orders as REFUND/REFUNDED, preserving original classification in metadata and not replaying inventory returns. It is a data rewrite, not an additive schema migration. Until separately reviewed/applied, historical rows can retain classifications the post-merge refund-only workflow no longer expects. No count of affected records was obtained, and no data rewrite was executed.

The default discrepancy is explained by migration 20260928000000_forecast_period_settings explicitly declaring DEFAULT CURRENT_TIMESTAMP, while schema.prisma:866 only declares @updatedAt. This is a confirmed schema representation mismatch, not evidence of corrupted forecast values. Review before future migration generation; do not blindly reset or deploy during audit.

RBAC indexes/relations are present: role/permission keys unique, composite role-permission/user-role primary keys, permissionId/roleId/assigner indexes and audit actor/target timestamp indexes. Session expiry/user/revocation indexes exist. No broken relation was reported by validation. Missing indexes cannot be ruled out for all workloads without query plans. Prisma schema comparison does not fully verify custom database triggers/check constraints or historical migration checksums. Foundation SQL includes compatibility/protected-role triggers; their live behavior was not exercised.

Prisma warns that package.json#prisma configuration is deprecated. No package upgrade was performed.

# API Audit

Static tracing and existing tests support these contracts:

| Area | Contract review |
| --- | --- |
| Auth | Login/me return user enriched with roles/effectivePermissions/revision; frontend AuthUser fields and store match |
| User roles | /users/:id/roles returns assigned roles/effectivePermissions; backend remains Administrator-only |
| Products | Existing /admin/products and variant/recipe paths intact; gate mismatches below |
| Inventory | Existing materials/batches/history/waste response paths intact; separate permission dependencies preserved |
| POS | /pos/menu and /pos/checkout match helpers; queued payload retains idempotencyKey; /orders/:id/refund is supported, no completed-order void route added |
| Reports | Helpers map to /reports/* response envelopes; operational order detail is /orders/:id |
| Forecasting | noteSeries addition is represented in frontend types/UI; selected series remain filtered while notes include other materials |
| Settings | Helpers target own account and password routes without target account IDs |

Confirmed mismatches:

1. ProductVariantsRecipeTab.tsx:71 and :147 gate Add/Delete Variant with products.edit. Backend creation requires products.create and deletion products.delete. Authorized actions can be hidden and unauthorized actions displayed before backend 403.
2. Alerts and Forecasting navigation use catalog grants while backend uses legacy Administrator checks. Custom roles get 403 despite visible navigation; legacy Administrators without those grants can still call these APIs directly.
3. UserEffectivePermissions.tsx calls fetchUserRoles, an Administrator-only API, from a Users page available with users.view. Non-Administrator viewers encounter a failed permissions tab. Do not fix by weakening role administration.
4. POS report order-detail drilldown requires pos.orders.view even when report access is allowed with reports.view. Its report caller is not gated by that extra permission.
5. Non-Administrator users.manage holders can see role-related controls that backend rejects. Unchanged profile edits omit role in handleEdit and remain usable; not every edit is blocked.
6. UserRolesSection is additionally wrapped with users.manage in UsersWorkspace although its backend requires legacy Administrator only. An Administrator without users.manage has API authority hidden by that UI.

fetchVariantMargin is an exported helper with no component caller found; candidate unused API helper, not a removed endpoint. apiJsonFetch uses TypeScript assertions rather than runtime response validation, so compilation alone cannot exclude missing fields. Its error helper handles string messages only; array DTO validation messages fall back to generic Request failed. No comprehensive live contract sweep was performed.

# Feature Regression Matrix

| Feature | Status | Evidence / risk |
| --- | --- | --- |
| Dashboard | WORKING | Builds, report fetches gated by reports.view; dashboard-only grants intentionally omit report widgets |
| Products | RISK | Backend tests pass; variant create/delete action parity mismatch |
| Inventory | WORKING | Material authorization tests pass, report gates/section tracking/modals retained; live stock flows not exercised |
| Suppliers | WORKING | CRUD/discovery authorization tested; external map/search provider behavior unverified |
| Stock Runs | WORKING | Authorization/lifecycle tests pass; database uniqueness present; no concurrent receiving acceptance test |
| Reports | RISK | Reporting guards pass; drilldown grant mismatch and pending historical refund reclassification |
| POS | RISK | Focus/menu/checkout/history build and tests pass; pending refund data migration and untested live/offline browser workflow |
| Users | RISK | Direct role-field protections pass; indirect Administrator takeover path remains |
| Roles | WORKING | Final Administrator-only architecture, assignment/protection tests pass; no role permission migration proposed |
| Settings | WORKING | Self-service ownership/password/session tests pass; global forecast setting intentionally separate |
| Forecasting | RISK | Python/backend tests and UI build pass; schema-default mismatch, legacy read policy and historical-data limitations |
| Alerts (additional) | RISK | Legacy policy does not match catalog/UI grants |

No entire feature is labeled BROKEN solely because its happy-path unit tests are incomplete. Specific denied workflows and database readiness issues are identified above.

## Forecasting data audit

Approved required source input python/cafe_raw_material_daily_consumption.csv exists and remains consumed by SARIMA.py and forecast_bridge.py. It is not a generated forecast output and was not reverted.

Structural scan: 52,620,089 on-disk bytes (line endings affect size), 384,242 data rows, 20 columns, 1,308 distinct dates from 2023-01-01 through 2026-07-31. All rows parsed; no missing/extra CSV cells, invalid date/quantity conversions, non-finite quantities or negative quantities were found by the scan. Units: L, g, kg, ml, pcs. This is structural integrity, not validation of real-world provenance or every duplicated transaction identity.

The replacement deliberately changes historical coverage relative to the older file; actual POS overlay is separate. python/CSV_ANALYSIS.md still describes the old 258,021-row weekday dataset and should be refreshed later. No actual long-running model fit on the entire CSV or forecast accuracy validation was performed. Existing forecasting suite: 17 tests PASS using .venv Python. Tests cover conversions, POS history overlay, calendar periods and model safeguards; they do not certify forecast accuracy.

# Security Findings

## S1 ? HIGH: delegated users.manage can take over an Administrator identity

Source-supported path remains unchanged after the merge:

- users/users.controller.ts:75 permits PATCH /users/:id with users.manage; its Administrator-only extra check applies only when dto.role is supplied.
- users/users.service.ts:449 onward accepts email changes for arbitrary target accounts; there is no protected-target Administrator check on that profile update.
- users/users.controller.ts:113 permits password-reset initiation with users.manage for ACTIVE accounts.
- auth/auth.service.ts:94 onward reads the target's current email and sends its reset link there.

A non-Administrator delegated users.manage holder with a known Administrator target ID can set that account's email to a controlled address, request reset and potentially sign in as that Administrator. Preconditions include email delivery and receipt of the reset link. No live exploit was attempted. This bypasses the intended role-assignment boundary indirectly without modifying a role field. Last-admin membership checks do not protect control of an Administrator's login identifier. Blocking issue for safe lower-trust delegation/production sign-off.

## S2 ? MEDIUM: incomplete catalog enforcement outside migrated core

Alerts/Forecasting legacy roles override the intended meaning of their UI/catalog grants. This is a capability mismatch and revocation boundary gap, not a RolesGuard bypass. Role administration is expressly exempt by final architecture and must remain Administrator-only.

## Preserved security controls

- Direct privileged creation/scalar role edits are Administrator-restricted in addition to users.manage; self role edits/suspension/deletion are rejected.
- Last active legacy/protected Administrator and protected compatibility membership restrictions remain. System/protected roles cannot be deleted, and role mutations use revisions/audit records.
- Last-Administrator checks preserve identities/memberships, not a minimum bundle of operational permissions; RolesService only requires Administrator retain at least one permission.
- Session tokens are hashed; session validation rejects revoked/expired/idle-expired/inactive/password-changed identities. Current database user role supplies legacy authorization.
- PasswordService uses bcrypt with cost 12; password DTOs enforce length/complexity. Personal password changes require current password and revoke sessions.
- Cookies are HttpOnly with secure/SameSite values from validated environment configuration. This audit did not expose secrets or certify deployment cookie settings.
- CSRF middleware checks supplied Origin/Referer on unsafe methods but permits requests with neither header. Cookie/browser/proxy behavior should be deployment-tested; this observation alone is not a demonstrated CSRF exploit.
- Frontend permission tampering does not change server grants. No mixed role OR permission fallback was found.
- Offline retry requests still face fresh server authorization; cached local queue data is not a committed sale.

Further review candidate: checkout idempotent replay is looked up globally by key and returns existing order detail before comparing requester identity/payload. Unique keys prevent ordinary duplicate inserts, but cross-user known-key replay and mismatched-payload behavior lack explicit binding checks. No exploitation or key-disclosure route was demonstrated; classify as defense-in-depth/API semantics review, not a proven unauthenticated disclosure.

# Code Quality Findings

- Managed AuthModule/UsersModule circular coupling via forwardRef; consider isolating shared identity/session dependencies in future work.
- Large files: ReportsService 3,564 lines; ProductManagementService 1,828; UsersService 1,154; OrdersService 836. Frontend report-exports 2,153; UsersWorkspace 1,550; lib/reports 1,208; ProductsWorkspace 1,075; InventoryWorkspace 757. Splitting by coherent domain responsibility would reduce review risk, but no refactor was performed.
- Repeated modal/layout/report formatting structures deserve consolidation review, not deletion without caller tracing.
- Legacy aliases remain purposeful compatibility routes; no confirmed unreachable route was found. fetchVariantMargin is a caller-free helper candidate.
- Stale wording: UserEffectivePermissions still describes authorization rollout; shell-navigation TODO proposes role permissions contrary to final architecture. Forecast-setting TODO reflects a genuinely unresolved catalog decision.
- Existing tests are strongest for mocked HTTP authorization. Missing high-value coverage includes S1 protected-target takeover, migrated UI action parity, live database migration/data compatibility, authenticated browser flows and concurrent operations.
- No shared generated API contract/runtime response validator; frontend response assertions can hide drift.

# Critical Issues

1. **S1 Administrator takeover through delegated user management**: prevents a clean authorization/security sign-off. Existing passing tests do not cover this chain.
2. **Database readiness**: pending void-to-refund data migration must be deliberately reviewed before asserting deployment consistency. Its impact on actual historical rows is not quantified in this audit.

The forecast updated_at default mismatch is confirmed but lower risk than S1; it is not by itself evidence the application cannot start.

# Non-Critical Issues

- Six frontend/backend action/dependency mismatches documented in API Audit.
- 16 frontend lint warnings and source organization debt.
- Prisma package.json configuration deprecation.
- Forecast default/schema representation mismatch and outdated CSV analysis documentation.
- Untested live browser/hydration/external provider behavior; no claim of full regression absence.

# Recommended Next Steps

1. Authorize a focused security fix defining protected-target restrictions for delegated users.manage (login identifiers, setup/reset, activation and related control), with a regression test for the full takeover chain. Preserve Administrator-only role administration.
2. Review/backup the intended database in a separate change, quantify pending migration impact, then apply an approved migration plan. Reconcile forecast updated_at schema/default deliberately; do not reset data.
3. Align variant action gates and effective-permissions/report drilldown UX with server authority. Keep role administration Administrator-only; no roles.view/manage expansion.
4. Separately authorize Alerts and Forecasting read-policy migration; choose global forecasting write policy explicitly rather than inventing settings.manage during cleanup.
5. Run authenticated browser acceptance for scoped custom roles, Administrator, offline sync, refund approval, reports, settings and focus-mode/modal interactions.
6. Address hook warnings, stale documentation and API-contract coverage incrementally; measure query workloads before changing indexes.

# Final Verdict

**RED ? blocking security/readiness issues found.** Merge integrity is PASS; compilation, production build and existing automated tests are PASS. That does not override the unresolved protected-account escalation path or non-clean local database migration state. Continued development is possible, but the merged system should not receive an unrestricted production/security approval yet.

No code changes, fixes, migrations or commits were made during this audit. Stop after this report.
