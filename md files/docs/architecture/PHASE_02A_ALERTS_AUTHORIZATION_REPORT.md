# Phase 2A — Alerts Authorization Reconciliation

Date: 2026-10-03

## 1. Summary

**IMPLEMENTED:** All four Alerts HTTP handlers now enforce their existing operation permission. Administrator status alone grants no access. Staff and Manager identities with matching grants can use the same operations.

**VERIFIED:** Continued from the existing working tree without recreating the controller or authorization suite. The only production change is authorization metadata in `ims-backend/src/alerts/alerts.controller.ts`.

## 2. Original authorization behavior

**VERIFIED:** The former class-level `@Roles(Role.ADMINISTRATOR)` applied to all four endpoints. Before the controller change, regression tests reproduced Staff with `alerts.view` receiving 403 and Administrator with no alert grants receiving 200. Both intentionally failing cases now pass under the required policy.

## 3. Exact Alerts endpoints

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/alerts` | `listAlerts` |
| GET | `/alerts/unread-count` | `getUnreadCount` |
| POST | `/alerts/:id/acknowledge` | `acknowledgeAlert` |
| POST | `/alerts/:id/dismiss` | `dismissAlert` |

**VERIFIED:** Reflection tests enumerate HTTP handlers and verify this exact set, paths, and verbs.

## 4. Previous policy per endpoint

**VERIFIED:** Each endpoint required an authenticated session and legacy Administrator role. None declared an alert permission. Consequently, matching grants could not authorize non-Administrators, and Administrator admission did not depend on alert grants.

## 5. New policy per endpoint

| Endpoint | Required permission |
| --- | --- |
| GET `/alerts` | `alerts.view` |
| GET `/alerts/unread-count` | `alerts.view` |
| POST `/alerts/:id/acknowledge` | `alerts.acknowledge` |
| POST `/alerts/:id/dismiss` | `alerts.dismiss` |

**IMPLEMENTED:** Each handler declares exactly one existing permission. Actions do not additionally require `alerts.view`. Session authentication remains required.

## 6. Controller changes

**IMPLEMENTED:** Removed the class-level role decorator and unused Role/Roles imports; imported `RequirePermission` and decorated every handler. Handler bodies, arguments, service calls, response envelopes, and HTTP status behavior are unchanged. No handler is public or session-only; no role metadata is combined with permission metadata.

## 7. Service changes

**NOT CHANGED:** AlertsService, state transitions, filtering, sorting, handled-alert retention, unread counts, actor attribution, scheduled reevaluation, and internal outbox processing. Existing service and reevaluation tests pass. Alert access remains store-wide; this change adds no ownership or tenant policy.

## 8. Frontend changes

**NOT CHANGED:** Browser paths, route registry, API client, dashboard, Alerts page, and action components. `/admin/alerts` already uses the alert read policy; dashboard reads check `alerts.view`; action controls check their individual permissions. An action-only API grant does not grant admission to the read-gated Alerts page.

## 9. RBAC/database changes

**NOT CHANGED:** Shared guards, resolver, permission catalog, schema, migrations, seed grants, roles, and role assignment. Existing guard order remains SessionAuthGuard, PermissionsGuard, RolesGuard. The real resolver obtains current active-user grants for each permission-protected request. No Administrator bypass or new permission key was added.

## 10. Tests added or changed

**IMPLEMENTED:** Added `ims-backend/src/alerts/alerts-authorization.spec.ts` with 60 tests. It mounts the real controller, validation pipe, three global guards in application order, and PermissionResolver. Session persistence, Prisma reads, and AlertsService business calls are mocked. No shared test infrastructure changed.

Tests cover exact handler metadata, missing/invalid sessions, all permission combinations across three legacy roles, unknown/unrelated grants, revocation on the next request, inactive identities, filter validation/forwarding, authenticated actor attribution, optional notes, response envelopes, and rejection of client-supplied actors. Synthetic guard fixtures verify unknown permission metadata rejection, mixed role/permission rejection, and existing all-of semantics.

## 11. Authorization matrix tested

**VERIFIED:** Each authenticated row runs for STAFF, MANAGER, and ADMINISTRATOR against all four endpoints (96 matrix requests). Read success is 200; action success is 201; permission denial is 403.

| Grants | List | Count | Acknowledge | Dismiss |
| --- | --- | --- | --- | --- |
| None | Deny | Deny | Deny | Deny |
| View | Allow | Allow | Deny | Deny |
| Acknowledge | Deny | Deny | Allow | Deny |
| Dismiss | Deny | Deny | Deny | Allow |
| View + acknowledge | Allow | Allow | Allow | Deny |
| View + dismiss | Allow | Allow | Deny | Allow |
| Both actions | Deny | Deny | Allow | Allow |
| All three | Allow | Allow | Allow | Allow |

Missing or invalid sessions receive 401 on every endpoint before permission lookup or business calls. Denied authenticated calls do not invoke AlertsService.

## 12. Commands executed

From `ims-backend`, including the earlier uninterrupted portion of this phase:

```text
node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath src/alerts/alerts-authorization.spec.ts --testNamePattern 'STAFF: view only|ADMINISTRATOR: no grants'
node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath src/alerts/alerts-authorization.spec.ts src/alerts/alerts.service.spec.ts src/alerts/alert-reevaluation.service.spec.ts src/auth/rbac/rbac.spec.ts src/auth/auth-permissions.interceptor.spec.ts
node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath src/alerts/alerts-authorization.spec.ts
node node_modules/prettier/bin/prettier.cjs src/alerts/alerts-authorization.spec.ts
node node_modules/prettier/bin/prettier.cjs --write src/alerts/alerts-authorization.spec.ts
node node_modules/jest/bin/jest.js --runInBand --no-cache
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
node node_modules/typescript/bin/tsc --project tsconfig.build.json --noEmit --incremental false
node node_modules/eslint/bin/eslint.js src/alerts/alerts.controller.ts src/alerts/alerts-authorization.spec.ts
npm run build
```

From `ims-frontend`: `node --test tests/authStore.test.cjs tests/permissions.test.cjs`.

From repository root: `git status --short`, `git diff --check`, `git diff --stat`, `git diff --name-only`, scoped controller diff review, and `rg` searches for alert permission/legacy-role references. TypeScript diagnostics were also filtered with PowerShell `Select-String 'error TS'` to inspect every failing location.

**VERIFIED:** Lint was non-mutating; `lint --fix` was never run. The explicit formatting edit targeted only the new spec. Initial test lint findings were formatting and three unbound fixture methods; formatting and explicit `this: void` annotations resolved them.

## 13. Test results

**VERIFIED:** Initial red reproduction: 2 expected failures, 58 skipped. Targeted Alerts/RBAC/interceptor run: 5 suites, 92 tests passed. Continuation first ran the Alerts suite: 60 passed. Final full backend run after test cleanup: 32 suites, 860 tests passed. Frontend authorization regression: 35 tests passed. Scoped ESLint passed with no diagnostics.

The full backend suite emitted expected simulated notifier failure logs; the suite exited successfully. No live application or database was used for authorization testing.

## 14. Build/type-check results

**VERIFIED:** `npm run build` and production `tsconfig.build.json` no-emit type checking passed. No TypeScript diagnostic names either changed Alerts file.

**NEEDS FOLLOW-UP:** The all-files no-emit check fails with 19 diagnostics in unchanged tests: `auth/rbac/rbac.spec.ts` (extra role property), product/POS/report/settings/stock-run/user authorization specs (Reflector target typing), and `test/app.e2e-spec.ts` (two string `.join` calls). These files have no working-tree diff. They were left untouched to preserve the requested scope; the repository-wide type check is not reported as passing.

## 15. Git diff review

**VERIFIED:** Phase 2A comprises one modified controller, one new authorization spec, and this report. The tracked controller diff is five insertions and three deletions. New files were inspected separately because ordinary `git diff` omits untracked files. `git diff --check` passes.

**NOT CHANGED:** Forecasting, roles, user-role assignment, refund approval, geolocation, POS, users, products, inventory, frontend routing, catalog, Prisma schema, migrations, and seeds. Three pre-existing untracked root reports remain untouched: `PHASE_01_ACCOUNT_SECURITY_PLAN.md`, `POST_MERGE_CODEBASE_AUDIT_REPORT.md`, and `SECURITY_PRODUCTION_READINESS_REMEDIATION_PLAN.md`.

## 16. Security review

**VERIFIED:** Administrator without grants is denied; valid non-Administrator grants authorize the matching operation. Every handler has explicit known permission metadata, with no public or role metadata. Grant removal takes effect on the next tested request. Action grants cannot read alerts; read grants cannot mutate them. Actors still come from the authenticated identity. Shared guards remain unchanged and reject invalid policy declarations.

## 17. Known limitations

**NEEDS FOLLOW-UP:** No live-database, browser, or deployed-environment smoke test was performed. Mock HTTP tests validate enforcement and delegation, while existing service tests cover business behavior. Existing all-files test typing issues remain as described above. This scoped phase does not establish repository-wide production readiness or reconcile other legacy authorization policies.

## 18. Remaining legacy Administrator alert references

**VERIFIED:** No Administrator, Role, or `@Roles` reference remains in production files under `ims-backend/src/alerts`. The new spec intentionally retains legacy roles and a mixed-policy fixture to prove denial behavior. Earlier audit reports retain their historical description of the old Alerts policy. `/admin/alerts` remains an unchanged compatibility URL and does not imply Administrator authorization. Shared frontend legacy-administrator policies still apply to other registered features, including roles and recommendations.

## 19. Readiness for Phase 2B

**VERIFIED:** Phase 2A's endpoint policy, regression coverage, production build/type check, lint, and scope review are complete. The unrelated all-files type-check limitation is recorded explicitly. Phase 2B has not been implemented.

## 20. Recommended next step

Review this scoped change, then proceed under separate Phase 2B instructions. The architecture plan identifies forecasting read authorization as a subsequent reconciliation candidate while preserving Administrator-only write settings. Address the existing test typing diagnostics separately; do not expand this Alerts change into other features.
