# Phase 01: Route Policy Centralization

Date: 2026-10-02. Scope: preparatory frontend routing metadata refactor. The complete architecture audit was read before implementation, along with the frontend AGENTS.md, installed Next layouts/pages and usePathname guides, current shell consumers, and both existing frontend test files.

Labels: **IMPLEMENTED** means changed in this phase; **VERIFIED** means confirmed by source inspection or the checks described below; **NOT CHANGED** identifies preserved scope; **NEEDS FOLLOW-UP** identifies work not established or completed here.

## 1. Summary

**IMPLEMENTED:** Introduced a central registry for all 30 protected page paths, stable feature IDs, explicit route policies, 15 compatibility relationships, separate page metadata, navigation presentation, and landing priority. Navigation references route IDs and evaluates their registered policy; it no longer supplies route authorization.

**NOT CHANGED:** All current browser URLs, route files, redirects, inventory query parsing, API requests, backend authorization, database roles/grants/migrations, styling, and business logic remain in place. No canonical routes were introduced.

**VERIFIED:** All 35 frontend tests pass, the standalone TypeScript check passes, the production build passes, targeted ESLint passes, and the final whitespace diff check passes. There were 20 passing tests before this change.

**IMPLEMENTED — explicit requested boundary:** Unknown descendants now deny rather than inherit access through a broad pathname prefix. This is the requested tightening for unregistered paths, not a change to admission for any existing page. `/no-access` is explicitly registered as authenticated-only; its existing page still uses AuthGuard directly and retains the same recovery behavior.

## 2. Files Changed

Paths below are relative to `ims-frontend`, except this report.

| File | Change |
|---|---|
| `src/lib/routing/route-policy.ts` | New policy union, shared existing-key policies, evaluator, access interface |
| `src/lib/routing/routes.ts` | New registry, route ID/href helpers, exact pathname resolution and admission |
| `src/lib/routing/route-aliases.ts` | New compatibility metadata; no runtime redirect changes |
| `src/lib/routing/page-metadata.ts` | Extracted general/staff titles and subtitles |
| `src/lib/routing/landing.ts` | Extracted explicit landing priority independent of navigation |
| `src/components/layout/navigation.ts` | New navigation presentation referencing registry IDs |
| `src/components/layout/shell-navigation.ts` | Replaced mixed implementation with a compatibility re-export facade |
| `src/components/auth/PermissionRoute.tsx` | Imports admission directly from the routing module |
| `src/components/auth/NoAccess.tsx` | Imports landing directly and uses registry href for the unchanged settings link |
| `src/components/login/LoginForm.tsx` | Imports landing directly from the routing module |
| `src/components/staff-pos/StaffDashboardLayout.tsx` | Selects staff settings presentation by route ID instead of an authorization flag |
| `tests/permissions.test.cjs` | Updated metadata assertions and added 15 route-contract tests |
| `docs/architecture/PHASE_01_ROUTE_POLICY_CENTRALIZATION_REPORT.md` | This implementation report, at repository documentation root |

**NOT CHANGED:** `tests/authStore.test.cjs`, all `src/app` page/layout/API files, all backend files, API clients, CSS, package manifests, and database files.

## 3. Previous Architecture

**VERIFIED:** `shell-navigation.ts` previously combined hrefs, menu icons/groups, permission flags, aliases, titles, route admission, and landing selection. Route access searched navigation entries by longest matching path, allowing undeclared descendants to inherit policy. Material action URLs added individual grants after inventory admission. Settings, role management, and recommendations had special policy handling.

Both sidebars already used one shared menu definition. Staff presentation flattened groups and changed the settings link to `/staff/settings`. The general sidebar used report children and retained collapse/scroll/mobile behavior. This phase preserves those renderers.

## 4. New Route Registry Design

**IMPLEMENTED:** `routes` in `routes.ts` is the authoritative mapping of stable IDs to current href and policy reference. It explicitly registers each protected page, including legacy aliases and inventory redirect pages. `routeHref(id)` resolves an href; `resolveRouteId(pathname)` performs exact lookup after the existing one-trailing-slash normalization; `canAccessRoute(id, access)` evaluates policy; `getRouteAccess(pathname, access)` denies unresolved paths.

There is no implicit descendant inheritance. Known descendants, such as both report pages and inventory action paths, have their own registrations. Policy objects are reused intentionally: all report pages use the reports policy, while suppliers does not inherit inventory.view even though its href sits under inventory.

The four public pages (`/`, login, forgot-password, reset-password) are not added to this protected-page registry. The registry test compares the complete filesystem page set, excluding exactly those four public pages, against the 30 protected registrations. The geolocation API is not a page and remains untouched.

Route resolution accepts the pathname returned by usePathname, not arbitrary full URLs. Inventory search parameters remain the responsibility of the unchanged page/workspace. No URL parsing or redirect behavior was added to authorization.

## 5. Route IDs Introduced

**IMPLEMENTED:**

| IDs | Current location / meaning |
|---|---|
| `dashboard` | `/admin/dashboard` |
| `inventory` | `/admin/inventory` |
| `inventory.materials` | Existing materials redirect page |
| `inventory.materials.add` | Existing material creation action path |
| `inventory.materials.createStockRun` | Existing receiving draft action path |
| `inventory.materials.recordWaste` | Existing waste action path |
| `inventory.stockRuns` | Existing stock-runs redirect with optional draft |
| `inventory.lowStock`, `inventory.nearExpiry` | Existing risk view redirect paths |
| `inventory.wasteInsights`, `inventory.highValue`, `inventory.supplierSpend` | Existing insight view redirect paths |
| `suppliers`, `suppliers.legacy` | `/admin/inventory/suppliers`, `/admin/suppliers` |
| `products` | `/admin/products` |
| `reports`, `reports.inventory`, `reports.pos` | Existing report root and child paths |
| `forecasting`, `alerts`, `users`, `roles`, `recommendations` | Corresponding existing `/admin/...` paths |
| `settings`, `settings.staff`, `settings.manager` | Existing self-service settings presentations |
| `pos`, `pos.dashboard`, `pos.transactions` | Existing `/staff/pos`, `/staff/dashboard`, `/staff/transactions` |
| `no-access` | `/no-access` |

Presentation/compatibility IDs distinguish existing page locations without granting access by role name. Later phases can consolidate these adapters while keeping primary feature IDs stable.

## 6. Policy Model

**IMPLEMENTED:** The explicit `RoutePolicy` union supports:

- `permission`: a nonempty tuple of existing PermissionKey values, evaluated all-of.
- `authenticated`: requires authenticated state and a non-null identity.
- `legacy-administrator`: requires authenticated state and legacy `user.role === ADMINISTRATOR`.

PermissionKey is imported with `import type` from the existing backend catalog. No runtime backend module or permission grants are imported into the browser. This avoids duplicating the key union and was validated by TypeScript and production compilation. Runtime tests additionally check every declared permission against the backend catalog.

**NOT CHANGED:** Administrator does not bypass feature permissions. Staff/Manager can enter an admin-prefixed feature when their grants allow it. Inventory action paths require inventory.view plus their original action grant. Inventory workspace action wrappers, stock-run edit/delete/post checks, dashboard dependent-data loading, and backend decorators are unchanged.

## 7. Alias Model

**IMPLEMENTED:** `routeAliases` references registered source IDs and target IDs. Each relation states `shared-page` or `redirect`; existing inventory redirects additionally describe the view/action query and the stock-run draft pass-through.

The 15 relationships cover four supplier/POS/settings compatibility pages, the shared report-root implementation, and ten inventory redirect pages. The metadata never rewrites a URL or performs a redirect. Existing route files remain the executors of their existing behavior.

Admission uses the source registration. It does not replace an action page's stronger policy with its inventory destination policy. Tests execute all ten existing redirect components with absent, empty, and reserved-character draft inputs and compare the resulting URL against the alias metadata. This guards against metadata drifting from the unchanged implementation.

## 8. Navigation Relationship

**IMPLEMENTED:** `navigationGroups` contains stable route IDs, labels, icons, groups, child relationships, and ordering. It contains no href literals, permission keys, administrator flags, authenticated-only flags, or authorization definitions. Resolved menu items obtain hrefs through routeHref; filtering calls canAccessRoute.

`shell-navigation.ts` remains a compatibility facade for existing shell imports. PermissionRoute and login/no-access landing logic import directly from routing modules, so authorization does not depend on menu presentation.

**VERIFIED:** Tests confirm the existing groups, labels, ordering, icons, nested report links, and no-grant settings menu. A test removes menu entries temporarily and proves route access and landing remain intact. Recommendations remains a registered restricted route even though it is absent from navigation.

**NOT CHANGED:** Sidebar rendering, group expansion, collapse state, mobile behavior, staff flattening, and POS focus behavior. Staff settings selection now checks `routeId === settings` and returns the same `/staff/settings` href. Prefix matching retained in matchesShellRoute is used only for visual highlighting, never admission.

## 9. Landing Route Behavior

**IMPLEMENTED / VERIFIED:** `landingPriority` is independent of navigation ordering but preserves its previous effective priority:

1. dashboard
2. POS
3. inventory
4. products
5. suppliers
6. POS transactions
7. reports
8. forecasting
9. alerts
10. users

The first accessible ID resolves through the registry. Settings and legacy Administrator-only pages remain excluded as landing candidates; fallback remains `/no-access`. Tests progressively remove higher-priority grants to verify every transition, including POS before inventory and legacy Administrator with no page-view grants.

## 10. Legacy Exceptions Preserved

**NOT CHANGED:**

- Roles and recommendations use explicit legacy Administrator admission.
- Self-account settings and no-access recovery require authentication only.
- Alerts and forecasting remain permission-driven frontend entries whose backend policies still require legacy Administrator.
- Role assignment, backend role management, refund approval, and geolocation authorization remain exactly as audited.
- Role enum usage, RBAC resolution, role memberships, grants, database synchronization, and server guard behavior were not modified.

## 11. Tests Added / Updated

**IMPLEMENTED:** Updated original tests to reference route IDs instead of removed menu authorization fields. Added tests for:

- Exact registry coverage and unchanged hrefs for all 30 protected filesystem pages.
- Logged-out and missing-identity denial on every registration.
- Staff, Manager, and Administrator admission matrices: no grants, each catalog key individually, existing action combinations, and all grants.
- Unknown top-level paths, unregistered descendants, lookalike prefixes, and not-yet-created canonical URLs.
- Hidden routes and independence from navigation membership.
- Complete default landing priority and no-access fallback.
- Menu groups/labels/icons/ordering/report children and authenticated-only settings.
- Alias registration/policy relationships and actual inventory redirect outcomes.
- All eight inventory views, invalid/default views, all three actions, invalid/default actions, draft preservation, and component remount keys by invoking the unchanged InventoryPage adapter with a stubbed workspace.
- Independent inventory/stock-run action grants through the existing PermissionAction component.
- No-access settings/logout recovery without a recursive workspace link.
- Existing general/staff page titles and alias metadata.

The independent expected route matrix lists the legacy URLs and expected grants instead of deriving expected admission from the registry being tested. Tests use the actual store and static rendering, with existing-style Next/module stubs. They are not browser end-to-end tests.

## 12. Commands Executed

**VERIFIED:** Relevant validation commands, with frontend working directory unless stated:

```text
node --test tests/authStore.test.cjs tests/permissions.test.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run build
node node_modules/eslint/bin/eslint.js src/lib/routing src/components/layout/navigation.ts src/components/layout/shell-navigation.ts src/components/auth/PermissionRoute.tsx src/components/auth/NoAccess.tsx src/components/login/LoginForm.tsx src/components/staff-pos/StaffDashboardLayout.tsx tests/permissions.test.cjs
```

Repository-root inspection/review commands included `git status --short`, `git diff --check`, `git diff --stat`, scoped `git diff`, and `git diff --name-only -- ims-backend ims-frontend/src/app ims-frontend/src/lib/api.ts ims-frontend/src/lib/products/api.ts`. `rg` searches checked route consumers, permission definitions, broad pathname matching, remaining role-prefixed paths, and installed Next documentation. Read-only Get-Content/Get-ChildItem commands inspected the request, report, instructions, source, and tests. No database commands were run.

Tests used the previously approved outside-sandbox Node worker execution. Build used the approved production build command. ESLint was invoked without `--fix`; standalone TypeScript used noEmit and disabled incremental output.

## 13. Test Results

**VERIFIED:** Baseline: 20 passed, zero failed. After implementation: **35 passed, zero failed**. The command runs both and all existing frontend test files: authStore.test.cjs and permissions.test.cjs. Thus the targeted auth/routing run is also the full current frontend test suite.

No backend tests were added or run because backend source, authorization, data models, and API contracts were unchanged. This is not a claim of independently revalidating server behavior against a live database.

## 14. Build / Type-Check Results

**VERIFIED:** Standalone TypeScript completed with exit code 0. Production Next 16.2.1 build completed with exit code 0, including compilation, TypeScript, and prerender generation. The emitted route listing retains `/admin`, `/staff`, `/manager`, public/recovery pages, and `/api/geolocation`; no canonical feature URL was introduced.

Targeted ESLint completed with exit code 0 and no diagnostics. Build-generated artifacts stay in the normal generated output area; no tracked source/configuration file was changed by build/type checking.

## 15. Git Diff Review

**VERIFIED:** Reviewed modified source/test diffs and new routing/navigation files. No changes under `ims-backend` or `ims-frontend/src/app`; no changes to API clients, environment files, CSS, dependency manifests, schema, grants, or migrations. The former mixed shell module is now only re-exports. All permission declarations for route admission live in route-policy.ts, and navigation only consumes registered policy.

Final `git diff --check` passes. An intermediate extra blank line at the facade EOF was corrected; ordinary Windows LF/CRLF notices are not code failures. The audit report and three existing untracked root security/audit plans predated this phase and were left untouched. No commit was created.

## 16. Known Limitations

**NEEDS FOLLOW-UP:** No interactive browser/mobile/visual E2E session was run. Menu metadata and changed branches were inspected, static rendering was tested, and production compilation succeeded; this does not prove every browser interaction. Existing rendering/state/CSS code was retained to minimize that risk.

PermissionRoute remains a client UX boundary; backend checks remain authoritative. Existing alerts/forecasting policy mismatches and other audit findings are not fixed here. The type-only PermissionKey import assumes the backend catalog exists alongside the frontend during type checking; this is the current repository structure, not a separately published frontend package contract.

Alias metadata describes existing behavior and is not yet the runtime source of redirects; tests detect mismatches for inventory aliases. A later URL migration must change the actual route adapters deliberately. New protected pages must be registered explicitly; they no longer inherit admission from a known prefix.

## 17. Remaining Hardcoded Role-Prefixed URLs

**NOT CHANGED / NEEDS FOLLOW-UP:** The registry now owns the routing/navigation href definitions, but this phase does not replace every existing UI link or pathname presentation check. Remaining examples:

- Inventory redirect pages and `InventoryPage` query behavior under `src/app/admin/inventory`.
- `StaffDashboardLayout` focus eligibility, active POS alias, and transaction-header conditions.
- `SidebarAccount` staff settings choice; `AdminHeader` divider conditions; `AdminSidebar` report rendering special case.
- `app/admin/reports/layout.tsx` and `ReportsScopeSwitch.tsx` page/scope matching.
- Dashboard links to alerts, inventory, and reports.
- `InventoryWorkspace` supplier journey and `MaterialActionPage` material/draft return links.
- `lib/products/api.ts` backend `/admin/products` and `/admin/variants` URLs: these are API contracts, not browser navigation and must not be globally replaced.
- Existing test fixtures intentionally preserve literal legacy URLs as regression expectations.

Filesystem import paths such as `components/admin/...` are not browser URLs. No component directory was renamed. Future canonical migration should update page adapters and these consumers together while leaving backend API namespaces alone.

## 18. Risks Found During Implementation

**VERIFIED:** Broad descendant inheritance had to be removed to meet the requested explicit-registration rule. Every current page is covered, and unknown descendant denial is tested separately. This is intentionally different from the old helper for nonexistent/unregistered descendants; it does not remove a registered working route.

**VERIFIED:** Flattening an action alias directly to inventory policy would lose its additional route grant. Source registrations retain all-of action requirements, while query-based inventory access still admits inventory viewers and leaves action UI checks in the workspace.

**VERIFIED:** Conflating settings presentation with an authenticated-only policy flag would keep navigation coupled to authorization internals. Staff settings now selects by stable route identity and preserves its href.

**VERIFIED:** `/no-access` previously bypassed PermissionRoute and used AuthGuard alone. Its new registry policy matches that behavior; its actual page was not changed. Settings remains available with zero grants, and landing does not point back to no-access as an actionable workspace link.

**NEEDS FOLLOW-UP:** Prefix-based visual matching remains by design; do not reuse it for security decisions. When canonical URLs are introduced, update focus/header/report checks as part of each feature batch.

## 19. Readiness for Phase 2

**IMPLEMENTED / VERIFIED:** Phase 1 is complete. Route identity, hrefs, admission policy, compatibility metadata, page metadata, navigation presentation, and landing behavior now have distinct responsibilities. Existing route-contract tests provide a baseline for follow-up work.

**NEEDS FOLLOW-UP:** Phase 2 may address backend policy mismatches from the architecture audit. This report does not authorize or implement that work. Administrative policy decisions and live grant/migration validation remain necessary before changing backend enforcement.

## 20. Recommended Next Step

Review this preparatory change as one focused frontend commit. Then begin the separately scoped authorization reconciliation phase, starting with alert read/acknowledge/dismiss policies and their direct API tests. Forecast reads/settings writes and geolocation require their own explicit decisions and tests. Keep canonical URL migration for the later feature-by-feature phase.
