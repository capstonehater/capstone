# Centralized Architecture Audit and Migration Plan

Audit date: 2026-10-02. Scope: analysis and planning only. No application code, configuration, database, or migration was changed. This report is the sole new deliverable and lives in the existing `docs/architecture` directory.

Evidence labels used throughout:

- **VERIFIED FROM CODE**: observed in current source or in the explicitly reported test run.
- **RECOMMENDATION**: proposed design or future work, not implemented.
- **NEEDS VALIDATION**: runtime behavior, deployment state, or product policy not established by this audit.

Paths below are repository-relative. Frontend route source paths in the route table are relative to `ims-frontend/src/app`; backend paths refer to `ims-backend`. Source symbols are included so evidence remains findable after line numbers change.

## 1. Executive Summary

**VERIFIED FROM CODE:** The application is already substantially permission-driven despite its role-named URLs. `/admin`, `/staff`, and `/manager` layouts all use `AuthGuard` and `PermissionRoute` without `allowedRoles`. A staff account with `inventory.view` can enter `/admin/inventory`; an administrator without `products.view` is denied `/admin/products` by the client and the product API. The route prefix itself no longer grants access.

The remaining work is primarily route and shell consolidation, plus explicit handling of unfinished authorization policy. It is not a merger of three complete applications. There is no manager feature tree beyond account settings, and no duplicated staff inventory/products/reports implementation. Settings shares one workspace, staff dashboard and POS share one POS implementation, and supplier/report aliases reuse existing components.

Backend enforcement is real, not just hidden navigation. Global session, permission, and role guards protect Nest controllers. Products, inventory, stock runs, suppliers, reports, POS/orders, and user management have permission decorators. However, alerts, forecasting, role management, and role assignment still use legacy Administrator checks. Alert/forecast navigation uses permissions that their APIs do not enforce. Several intentionally or potentially broad endpoints are session-only; the separate Next geolocation handler has no authentication check.

**RECOMMENDATION:** Introduce canonical feature routes incrementally, preserve the existing backend security boundaries, and keep explicit legacy exceptions until separately migrated. Reuse the navigation model rather than create another role-based menu system. Preserve a POS presentation mode because focus mode is a workflow requirement, not a staff identity requirement. Do not remove the legacy role enum or its database synchronization trigger as part of a URL migration.

**Readiness verdict:** Ready to begin a controlled migration with characterization tests and explicit policy metadata. Not ready for a blanket removal of all role checks or a claim that every capability is fully permission-enforced. The safest first implementation phase is policy/route characterization and separation of route policy from navigation, while retaining all current URLs and outcomes.

## 2. Current Architecture

**VERIFIED FROM CODE:**

| Layer | Current structure | Architectural consequence |
|---|---|---|
| Browser application | Next App Router under `ims-frontend/src/app`; React client workspaces | Most business data loads from client components |
| Authentication state | `src/store/authStore.ts`, Zustand, in-memory | Client state is a UX snapshot, not server authority |
| Feature API client | `src/lib/api.ts` and feature clients | Credentialed requests to `NEXT_PUBLIC_API_BASE_URL`, default `http://localhost:4000` |
| API server | Nest feature modules in `ims-backend/src` | Controllers are already mostly domain-oriented |
| Persistence | Prisma/PostgreSQL, `prisma/schema.prisma` | Legacy enum role and additive many-to-many RBAC coexist |
| Feature services | Catalog, inventory, stock-runs, reports, orders, forecasting, alerts, users, settings | Service/domain boundaries should survive frontend route changes |
| Other execution | `python/` forecasting; `AI-Store Reco/` recommendation scripts | No separate role-based web route tree found in these scripts |
| Next API | `src/app/api/geolocation/route.ts` | Separate server boundary outside Nest guards |

`src/app/layout.tsx` installs global styles and `AuthBootstrap`. Role-area layouts provide authentication/access checks, not visual shells. Individual pages/workspaces instantiate `AdminDashboardLayout` or `StaffDashboardLayout`; `admin/reports/layout.tsx` wraps report pages. The distinction matters: moving a folder alone will not consolidate the shell.

No Next middleware/proxy authorization implementation or `use server` action was found in active frontend source. `next.config.ts` has no route rewrite/redirect configuration. Next redirect pages are not authorization middleware. Client guards must never be assumed to protect server-rendered data loaders added later.

Investigation covered active frontend source/tests/configuration, backend controllers/guards/RBAC and relevant services/tests, Prisma schema and RBAC migration/seed behavior, feature route strings, scripts, Python integration references, and architecture documentation. Binary backups, database dumps, vendored packages, and historical reports were not treated as current executable authority. No live database or production deployment was inspected.

## 3. Existing Route Map

**VERIFIED FROM CODE**, except the final column, which is a **RECOMMENDATION**.

Table conventions: all `/admin`, `/staff`, and `/manager` page routes inherit client `AuthGuard` plus `PermissionRoute`; none requires the matching role merely because of its prefix. `A` = `AdminDashboardLayout`; `P` = `StaffDashboardLayout`; `R` = report layout containing A; `Auth` = `AuthPageShell`; `redirect` = no independent visual feature. Permission entries describe current frontend policy, not a claim of matching backend policy. Redirect source policies do not substitute for destination/action enforcement. Each row's source is the displayed path plus `/page.tsx`, unless explicitly stated otherwise.

| Current URL | Source under app | Feature / prefix | Shell | Current access | Equivalent / duplication | Proposed canonical destination |
|---|---|---|---|---|---|---|
| `/` | `page.tsx` | Entry / none | redirect | Public | Redirects to login | Keep `/`, optionally use shared landing logic later |
| `/login` | `login/page.tsx` | Authentication / none | Auth | Public; signed-in landing logic | Unique | Keep |
| `/forgot-password` | `forgot-password/page.tsx` | Recovery / none | Auth | Public | Unique | Keep |
| `/reset-password` | `reset-password/page.tsx` | Recovery / none | Auth | Public; API validates reset token | Unique | Keep, preserve token query |
| `/no-access` | `no-access/page.tsx` | Denial / none | NoAccess | AuthGuard | Unique | Keep |
| `/admin/dashboard` | `admin/dashboard/page.tsx` | Overview / admin | A | `dashboard.view` | Not equivalent to staff dashboard | `/dashboard` |
| `/admin/inventory` | `admin/inventory/page.tsx` | Inventory / admin | A via workspace | `inventory.view` | One query-driven workspace | `/inventory` |
| `/admin/inventory/materials` | `admin/inventory/materials/page.tsx` | Inventory / admin | redirect | `inventory.view` | Alias to materials view | `/inventory?view=materials` |
| `/admin/inventory/materials/add` | `admin/inventory/materials/add/page.tsx` | Material creation / admin | redirect | `inventory.view` + `inventory.create` in path policy | Alias to action modal | `/inventory?view=materials&action=create-material` |
| `/admin/inventory/materials/create-stock-run` | `admin/inventory/materials/create-stock-run/page.tsx` | Receiving / admin | redirect | `inventory.view` + `stockRuns.create` in path policy | Alias to action modal | `/inventory?view=materials&action=stock-run-create` |
| `/admin/inventory/materials/record-waste` | `admin/inventory/materials/record-waste/page.tsx` | Waste / admin | redirect | `inventory.view` + `inventory.waste` in path policy | Alias to action modal | `/inventory?view=materials&action=waste` |
| `/admin/inventory/stock-runs` | `admin/inventory/stock-runs/page.tsx` | Receiving / admin | redirect | `inventory.view`; panel/data also `stockRuns.view` | Preserves encoded `draft` query | `/inventory?view=stock-runs[&draft=...]` |
| `/admin/inventory/low-stock` | `admin/inventory/low-stock/page.tsx` | Stock risk / admin | redirect | `inventory.view`; dependent report data separately checked | Alias | `/inventory?view=low-stock` |
| `/admin/inventory/near-expiry` | `admin/inventory/near-expiry/page.tsx` | Stock risk / admin | redirect | `inventory.view`; dependent report data separately checked | Alias | `/inventory?view=near-expiry` |
| `/admin/inventory/waste-insights` | `admin/inventory/waste-insights/page.tsx` | Waste reporting / admin | redirect | `inventory.view`; report data `reports.view` | Alias | `/inventory?view=waste` |
| `/admin/inventory/high-value` | `admin/inventory/high-value/page.tsx` | Valuation / admin | redirect | `inventory.view`; report data `reports.view` | Alias | `/inventory?view=value` |
| `/admin/inventory/supplier-spend` | `admin/inventory/supplier-spend/page.tsx` | Purchasing analysis / admin | redirect | `inventory.view`; report data `reports.view` | Alias | `/inventory?view=supplier` |
| `/admin/inventory/suppliers` | `admin/inventory/suppliers/page.tsx` | Suppliers / admin | A | `suppliers.view`, not `inventory.view` | Primary supplier page | `/suppliers` |
| `/admin/suppliers` | `admin/suppliers/page.tsx` | Suppliers / admin | A through imported page | `suppliers.view` alias | Imports primary route component; not a redirect | `/suppliers` |
| `/admin/products` | `admin/products/page.tsx` | Products / admin | A | `products.view` | Unique workspace | `/products` |
| `/admin/reports` | `admin/reports/page.tsx` | Inventory reports / admin | R | `reports.view` | Same workspace as inventory report child | `/reports` redirects to `/reports/inventory` |
| `/admin/reports/inventory` | `admin/reports/inventory/page.tsx` | Inventory reports / admin | R | `reports.view` | Shared workspace | `/reports/inventory` |
| `/admin/reports/pos` | `admin/reports/pos/page.tsx` | POS analysis / admin | R | `reports.view` | Distinct from operational transaction history | `/reports/pos` |
| `/admin/forecasting` | `admin/forecasting/page.tsx` | Forecasting / admin | A | `forecasting.view`; configure UI also legacy Administrator | Unique | `/forecasting` |
| `/admin/alerts` | `admin/alerts/page.tsx` | Alerts / admin | A | `alerts.view`; actions use individual alert permissions | Unique, also dashboard summary | `/alerts` |
| `/admin/users` | `admin/users/page.tsx` | User management / admin | A | `users.view`; action permissions and legacy exceptions | Unique | `/users` |
| `/admin/roles` | `admin/roles/page.tsx` | RBAC administration / admin | A | Legacy `ADMINISTRATOR`, no catalog permission | Unique | `/roles`, retaining explicit legacy policy initially |
| `/admin/recommendations` | `admin/recommendations/page.tsx` | Placeholder / admin | A | Legacy `ADMINISTRATOR` special case | Static coming-next content | `/recommendations` compatibility destination; not new nav |
| `/admin/settings` | `admin/settings/page.tsx` | Own account / admin | A | Authenticated only | Shared SettingsWorkspace | `/settings` |
| `/manager/settings` | `manager/settings/page.tsx` | Own account / manager | A | Authenticated only | Shared workspace, different heading/wrapper | `/settings` |
| `/staff/settings` | `staff/settings/page.tsx` | Own account / staff | P | Authenticated only | Shared workspace, different shell | `/settings` |
| `/staff/dashboard` | `staff/dashboard/page.tsx` | POS / staff | P | `pos.view`; redundant inner AuthGuard | Same StaffPOSPage as POS | `/pos` |
| `/staff/pos` | `staff/pos/page.tsx` | POS / staff | P | `pos.view` | Primary POS entry | `/pos` |
| `/staff/transactions` | `staff/transactions/page.tsx` | Operational transactions / staff | P | `pos.orders.view`; redundant inner AuthGuard | Separate from report workspace | `/pos/transactions` |
| `/api/geolocation` GET | `api/geolocation/route.ts` | Location proxy / none | None | No session/permission validation in handler | Unique server API | Keep API URL; separately resolve authorization |

There are no `page.tsx` entries at `/admin`, `/staff`, or `/manager`, and no cashier route tree. “Cashier” appears as a capability scenario in tests; it is not a fourth legacy enum role. Inventory recognizes `view=overview|materials|stock-runs|low-stock|near-expiry|waste|value|supplier`; invalid view falls back to overview. Only three action query values are accepted. Preserve those semantics in the first migration.

## 4. Current Role-Based Structure

**VERIFIED FROM CODE:** `lib/auth.ts` and Prisma retain `ADMINISTRATOR | MANAGER | STAFF`. Frontend role folders now convey historical placement and presentation. `components/admin` contains most shared operational and management UI; staff components even import its select/field styles. `components/staff-pos` contains the active checkout workflow and focus context. Manager only contributes a settings wrapper.

`prisma/schema.prisma` explicitly documents additive RBAC and continued authority of legacy roles on endpoints not migrated. `20260929000000_rbac_foundation/migration.sql` creates compatibility roles and a synchronization trigger. This explains why role identity remains in code, but does not prove the original authors' reasons for every folder name.

**NEEDS VALIDATION:** Historical intent is inferred from structure and compatibility comments; it is not evidence that every administrator-labeled feature must remain administrator-only. No separate role-specific business implementation was found that requires keeping the role prefix in its URL.

## 5. Authentication Architecture

**VERIFIED FROM CODE:**

1. `LoginForm` calls `loginWithPassword` through `apiJsonFetch`; `apiFetch` always includes credentials.
2. `AuthController.login` delegates to `AuthService.login`: active-account checks, bcrypt password verification through `PasswordService`, failed-attempt lockout, and session creation.
3. `SessionService.createSession` creates an opaque token and persists its hash with absolute and idle expirations. Cookie options are HttpOnly, path `/`, and environment-controlled Secure, SameSite, and optional domain (`auth.constants.ts`, `auth.cookies.ts`). Runtime cookie settings were not inspected.
4. Global `SessionAuthGuard` skips only `@Public` handlers and validates the session against current user/account state. Revoked/expired sessions, inactive accounts, and sessions older than password changes are rejected. Valid requests update last-seen/idle expiry.
5. `AuthPermissionsInterceptor` augments login and `/auth/me` responses with fresh RBAC snapshots. Identity includes the legacy role as well as assigned roles/effective permissions/revision.
6. Root `AuthBootstrap` fetches `/auth/me` initially and refreshes on focus/visibility, with an in-flight guard and five-second throttle. Refresh compares state references to avoid overwriting later login/logout/profile changes. Initial failure clears state; later transient failure preserves it, while 401 clears it.
7. `authStore` is not persisted to localStorage. It preserves existing authorization for same-account partial profile responses, replaces explicit snapshots, and clears authorization on logout/account switches. Client guards return no feature content while loading.
8. Login landing uses `getDefaultLandingRoute`: dashboard first, POS second, then accessible feature entries, excluding settings/administrator-only entries; fallback `/no-access`. `/` redirects to login. `NoAccess` still links to `/admin/settings`.
9. Password reset uses hashed expiring one-use tokens and revokes sessions. Settings operates on `@CurrentUser().id`; changing credentials can clear the cookie and require reauthentication.

`main.ts` allows credentialed CORS from configured frontend origin and installs `csrfOriginMiddleware`. Unsafe requests with a nonmatching Origin/Referer are rejected; requests with neither are allowed. These controls are independent of page prefixes. Static `/profile-picture` delivery is mounted through Express, outside controller guards.

**RECOMMENDATION:** Preserve the cookie/session and password lifecycle during route consolidation. Do not replace it with role tokens or localStorage authority. If server-rendered feature data is introduced, use a server-only session-aware API adapter; the current browser fetch helper does not explicitly forward a server request's cookies.

## 6. RBAC Architecture

**VERIFIED FROM CODE:**

| Model | Purpose / constraints |
|---|---|
| `User.role` | Legacy enum identity, still used by remaining role guards and safeguards |
| `AccessRole` | Unique key/name, description, system/protected flags, revision; custom keys `custom:<uuid>` |
| `Permission` | Unique code-managed key, module, label, description |
| `RolePermission` | Many-to-many role grants, composite role/permission key |
| `UserRole` | Many-to-many membership, assigned timestamp/actor; composite user/role key |
| `AuthorizationAuditEvent` | Role/membership change attribution and before/after JSON, retained historical IDs |

`PermissionResolver.snapshot` does a fresh database read, unions recognized grants from all memberships for active users, sorts/deduplicates them, and hashes membership/version/state data into `authorizationRevision`. No cross-request permission cache, direct user grants, explicit deny rules, or implicit administrator permission bypass was found. `resolve` returns that snapshot's permission set. An AccessRole named/keyed Administrator is not the same check as `user.role === ADMINISTRATOR`.

Current catalog (34 keys), from `src/auth/rbac/permission-catalog.ts`:

| Module | Existing keys |
|---|---|
| Dashboard | `dashboard.view` |
| Products | `products.view`, `products.create`, `products.edit`, `products.archive`, `products.restore`, `products.delete` |
| Inventory | `inventory.view`, `inventory.create`, `inventory.edit`, `inventory.archive`, `inventory.waste` |
| Stock runs | `stockRuns.view`, `stockRuns.create`, `stockRuns.edit`, `stockRuns.delete`, `stockRuns.post` |
| Suppliers | `suppliers.view`, `suppliers.create`, `suppliers.edit`, `suppliers.delete`, `suppliers.searchAvailability` |
| Reports / forecasts | `reports.view`, `forecasting.view` |
| Users | `users.view`, `users.manage`, `users.sessions.revoke` |
| POS | `pos.view`, `pos.checkout`, `pos.orders.view`, `pos.refund` |
| Alerts | `alerts.view`, `alerts.acknowledge`, `alerts.dismiss` |

There is no current role-management, role-assignment, global-settings-management, or forecast-settings-write permission. Do not invent one when translating current policy.

RBAC initial grants are inserted by the SQL migration, not merely by ordinary user seed records: Administrator gets the full catalog at migration time; Staff gets inventory view/waste, suppliers view, all five stock-run keys, and all four POS keys; Manager gets POS view/checkout. Existing users receive corresponding compatibility memberships. The SQL trigger `sync_legacy_access_role` maintains those memberships on user insertion and legacy-role change; protected-role identity is guarded by another trigger. `prisma/seed.ts` creates users with legacy roles and relies on the database structure. A schema-only database setup does not establish that these SQL triggers/catalog entries exist.

`RolesService` validates supported keys, uses serializable transactions, audits writes, and checks revisions for optimistic concurrency. System/protected roles cannot be deleted, assigned custom roles cannot be deleted, and Administrator cannot be saved with zero permissions. That last rule preserves at least one grant, not necessarily every critical capability.

`UserRolesService.assertActor` rechecks an active legacy Administrator for mutations. Membership changes revoke the target user's sessions. Removal protects the last active Administrator membership and disallows removing the compatibility membership independently of legacy role changes. `UsersService` separately preserves last-administrator/self-management safeguards. Ordinary editable legacy user roles are Administrator and Staff; Manager is retained/reserved (`users.constants.ts`, user editor).

Role permission edits increment revisions; the resolver immediately sees the changed grants on subsequent protected API requests. The browser does not receive a push update; focus refresh replaces the snapshot and `PermissionRoute` remounts children on revision/identity/permission changes.

**NEEDS VALIDATION:** Migration application, actual role memberships, edited grants, trigger installation, and production session settings must be checked against a controlled environment before rollout. Source defaults are not evidence of current live grants.

## 7. Authorization Enforcement Map

**VERIFIED FROM CODE:** `AuthModule` registers global `SessionAuthGuard`, `PermissionsGuard`, then `RolesGuard`, plus the auth response interceptor. `PermissionsGuard` requires all listed keys, rejects empty/unknown requirements, and rejects permission metadata combined with legacy role/public metadata. Missing permission metadata does not deny: the request continues to any role policy, otherwise session-only access.

| Surface / source | Server enforcement | Notes |
|---|---|---|
| Auth controller | Login/forgot/reset public; me/logout session | Password/reset validation still applies |
| `catalog/admin-products.controller.ts` | Individual `products.*` grants | Backend base `/admin`; list/detail/recipe/usage reads view, create product/variant create, edits/recipe replacement edit, archive/restore/delete respective grants |
| `catalog/catalog.controller.ts` | `/products` and variants require products.view; `/pos/menu` pos.view | `/categories` is session-only |
| `inventory/inventory.controller.ts` | Units/material reads, batches, transactions, summary: inventory.view; create/edit/archive/waste individual grants | Store availability GET/POST uses suppliers.searchAvailability; supplier CRUD uses supplier grants |
| `stock-runs/stock-runs.controller.ts` | Read view; draft creation create; item changes edit; deletion delete; posting post | Multiple draft deletion endpoints share delete policy |
| `reports/reports.controller.ts` | Class-level reports.view on all 17 GET handlers | No separate dashboard API/permission override |
| `orders/orders.controller.ts` | Checkout pos.checkout; order list/detail pos.orders.view; refund pos.refund | Refund service additionally authenticates legacy Administrator approval |
| `users/users.controller.ts` | Reads/activity/sessions users.view; account mutations users.manage; revocation users.sessions.revoke | Additional role-change restrictions and service safeguards remain |
| `users/user-roles.controller.ts` | Class-level legacy Administrator | All list/assign/remove membership endpoints; not implied by users.manage |
| `roles/roles.controller.ts` | Class-level legacy Administrator | Roles CRUD and permission catalog endpoint |
| `alerts/alerts.controller.ts` | Class-level legacy Administrator | List, unread-count, acknowledge, dismiss do not enforce corresponding alert keys |
| `forecasting/forecasting.controller.ts` | Class-level legacy Administrator | Reads plus PUT settings; no forecasting.view enforcement |
| `settings/settings.controller.ts` | Session plus self identity | GET/PATCH account and POST change-password; not global settings administration |
| `availability/availability.controller.ts` | Session-only | GET `/variants/:id/availability` |
| `app.controller.ts` | Session-only | GET `/`, not marked public |
| Express static profile pictures | No controller guard | Separate static-resource policy |
| Next `/api/geolocation` | No auth/permission check found | Validates coordinates/query, calls configured LocationIQ endpoint |

Frontend `PermissionAction`, `PermissionGuard`, `loadIfAllowed`, and route policies reduce accidental disclosure and unnecessary requests but do not replace this map. Dashboard accesses reports, suppliers, and alerts conditionally. `dashboard.view` grants page admission only: actual report data requires `reports.view`. Inventory combines inventory, stock-run, supplier, report, and availability capabilities. Query-selected action dialogs are wrapped in individual action guards; a permitted inventory URL does not grant waste/create/post authority.

Order history handlers do not scope the request to `CurrentUser`; list filters can include a creator, and detail is looked up by order ID. Therefore `pos.orders.view` currently means broader operational order access, not a verified own-transactions-only rule. “Your transactions” UI wording does not establish ownership enforcement. Preserve current scope until a separately reviewed product/security policy changes it.

There are no current server actions to migrate. Any future action must validate session and permission at its server boundary, and retain service-level ownership/integrity constraints.

## 8. Sidebar / Navigation Architecture

**VERIFIED FROM CODE:** `components/layout/shell-navigation.ts` already contains the shared definition: `adminNavigation`, `materialActions`, `getVisibleNavigation`, `canAccessNavigation`, `getRouteAccess`, `getDefaultLandingRoute`, and page metadata.

`AdminSidebar` renders grouped links and report children from the filtered definition, with collapse/scroll state in `sidebarStore`. `StaffDashboardLayout` uses the same filtered data but flattens groups, ignores nested rendering, rewrites authenticated-only settings to `/staff/settings`, and implements its own sidebar/mobile/focus behavior. There are two renderers, not two independent lists of per-role permissions.

`getRouteAccess` maps known aliases, special-cases recommendations, then uses the longest matching navigation path. Unknown top-level routes deny, but an unregistered descendant of a known route can inherit the parent's policy. Material action paths add another key. Query parameters are not part of this check. `matchesShellRoute` special-cases suppliers under inventory to avoid double highlighting. Header metadata, report layout conditions, focus mode, and account-menu targets also depend on literal paths.

**RECOMMENDATION:** Keep one route metadata source with separate navigability and policy fields. A hidden route still needs policy; removing a menu must not change authorization. Retain shared filtering, but have both general and POS presentations consume stable feature IDs instead of rewriting role-prefixed hrefs.

## 9. Duplicated Features and Components

**VERIFIED FROM CODE** classification and **RECOMMENDATION** disposition:

| Feature | Category / evidence | Disposition |
|---|---|---|
| Staff dashboard / staff POS | A: same StaffPOSPage and StaffDashboardLayout; dashboard adds redundant AuthGuard | One `/pos` page; legacy dashboard redirects |
| Three settings pages | B: shared SettingsWorkspace; wrapper/title/shell variations | One self-account page; shared shell metadata |
| Two supplier pages | A: legacy page imports primary route component | Extract supplier feature entry, one `/suppliers`; both old URLs redirect |
| Reports root / inventory report | A/B: same InventoryReportsWorkspace, pathname-driven header variation | `/reports` becomes alias to inventory reports |
| Inventory legacy pages | Alias routes, not duplicate CRUD implementations | Keep query-driven workspace and compatibility mappings |
| Admin/staff shell | B: shared CSS, account component, nav definition; two renderers and distinct behavior | Shared shell primitives plus POS presentation/focus context; preserve accessibility |
| Dashboard vs POS “dashboard” | D by workflow, not by role: overview metrics vs selling | Keep `/dashboard` and `/pos` distinct |
| POS history vs POS reports | C/D: pos.orders.view vs reports.view, operational refund/receipt vs analytical sections | Keep `/pos/transactions` and `/reports/pos`; share suitable lower-level formatting only |
| Inventory reports vs inline inventory insights | C: different entry/dependency policies, shared domain data | Retain feature-specific composition; do not silently grant reports to inventory viewers |
| Users, roles, forecasting settings | C: additional administrative safeguards | Centralize location, preserve restricted actions |

No separate administrator/staff product or supplier CRUD implementation was found. `components/admin/inventory/InventoryInsightPage` is dynamically imported by InventoryWorkspace and is not dead merely because former route pages redirect. `components/inventory` and old mock-data files are candidates for separate reachability validation, not proof of currently duplicated role behavior.

## 10. Hardcoded Role/Route Dependencies

**VERIFIED FROM CODE:** The following active dependency groups must be migrated deliberately. Import paths containing `components/admin` are filesystem dependencies, not browser URLs; backend API paths are a third distinct category.

| Dependency | Concrete files/symbols | What breaks under naive prefix removal |
|---|---|---|
| Admission, menu, landing, aliases, titles | `components/layout/shell-navigation.ts` | Canonical routes deny or menus/landing keep returning old URLs |
| Login and denial recovery | `components/login/LoginForm.tsx`, `components/auth/NoAccess.tsx` | Landing depends indirectly on registry; account-settings link directly uses old URL |
| Active/header styles | `components/admin/AdminSidebar.tsx`, `AdminHeader.tsx`, report layout and `ReportsScopeSwitch.tsx` | Report dropdown, titles/dividers, scope state fail to match |
| POS focus and transaction header | `components/staff-pos/StaffDashboardLayout.tsx`, `StaffHeader.tsx` | Focus eligibility and special header behavior stop matching canonical URLs |
| Account link selection | `components/layout/SidebarAccount.tsx` | Prefix-based settings destination selects wrong alias |
| Dashboard deep links | `app/admin/dashboard/page.tsx` | Alerts/report/inventory navigation still points to old URLs |
| Inventory action/insight links | `InventoryWorkspace.tsx`, `MaterialActionPage.tsx`; redirect pages | Supplier journey, materials return links, draft deep links break |
| Shared supplier implementation | `app/admin/suppliers/page.tsx` imports another page | Deleting/moving primary page breaks import |
| Route-coupled state | `sidebarStore.openSections` keyed by href; route page keys use view/draft/action | Collapsed sections or dialog remount behavior changes |
| Backend admin namespace | `lib/products/api.ts`, `catalog/admin-products.controller.ts`, `products-authorization.spec.ts`, four product phase runners | Global replacement hits API URLs and may collide with distinct GET `/products` contract |
| Frontend authorization tests | `tests/permissions.test.cjs` | Exact expected hrefs and mocked pathname require staged updates |
| Documentation | `python/README.md`, `docs/architecture/ARCHITECTURE_REVIEW.md`, historical root reports | Operational instructions need current links; historical reports should remain historical |

Legacy role references also remain in `lib/auth.ts`, auth store identity/remount keys, user editor/labels, AccountSettingsCard, forecasting configure controls, RolesWorkspace protected-role UI, user-role services/controllers, user safety logic, and refund approval. Do not remove all occurrences of `ADMINISTRATOR`, `STAFF`, or `MANAGER` as a cleanup operation.

`lib/pos-offline.ts` persists menu/checkout queue under global browser keys (`ims-pos-menu-cache`, `ims-pos-checkout-queue`), not route-prefixed keys. Renaming routes should not reset the queue. It is also not scoped per user: account-switch/replay attribution needs validation. Current sync rechecks pos.checkout and the API still enforces it, but that alone does not establish intended ownership of an earlier user's queued operation.

## 11. Security Risks Relevant to Centralization

**VERIFIED FROM CODE** risks, with proposed response explicitly labeled:

1. **Removing a folder layout can remove the client guard.** New pages outside the three legacy trees will not inherit their guards. RECOMMENDATION: add the shared authenticated layout before exposing canonical entries; ensure unknown/unregistered routes deny.
2. **Alerts permissions do not control their API.** Legacy Administrators can call alert mutations without matching grants; non-administrators with grants still get denied. This mismatch already exists. RECOMMENDATION: migrate read/acknowledge/dismiss to the three existing alert keys in a separate security commit.
3. **Forecast read and write are grouped under Administrator.** RECOMMENDATION: migrate reads to forecasting.view separately from PUT settings; retain explicit Administrator write policy until a write capability is designed. Do not turn forecasting.view into write authority.
4. **Management has no existing catalog capability.** Removing RolesGuard from roles or memberships would make those controllers session-only. RECOMMENDATION: retain explicit legacy policy on `/roles` and membership APIs pending a separate policy migration; preserve last-admin protections.
5. **No permission decorator is not default-deny authorization.** Categories, availability, and root GET are session-only. RECOMMENDATION: record these as explicit exceptions and assess exposure; do not automatically add a single feature permission that breaks legitimate shared callers.
6. **Next geolocation bypasses Nest.** Anyone who can reach it can attempt configured provider requests. RECOMMENDATION: decide the intended caller policy and implement a real server session/authorization bridge or move the handler behind Nest. Add quota/rate controls as appropriate; no nonexistent geo permission is assumed.
7. **Client route protection is not server-data protection.** RECOMMENDATION: do not add sensitive server-component loaders underneath only a client guard. Server API/session checks must happen before returning data; a future server action must enforce independently.
8. **New descendant pages can inherit permissive parent metadata.** Existing longest-prefix behavior should not automatically cover more sensitive future routes. RECOMMENDATION: use explicit route registrations and tested patterns for intentional descendants.
9. **Page admission differs from action/data access.** Inventory query actions, dashboard widgets, POS history/refund, and cross-feature lookups need their own checks. RECOMMENDATION: preserve existing PermissionAction/loadIfAllowed guards and backend decorators during extraction.
10. **Stale browser snapshots and cached feature state.** Backend fresh resolution blocks revoked actions, but inactive browser state may remain visible until refresh; generic API errors do not centrally refresh authorization. RECOMMENDATION: preserve revision remounts, test 401/403/account switches and offline queue ownership, and add request invalidation only as a separate reviewed improvement.
11. **Order scope and refund approval cannot be inferred from URLs.** `OrdersService` requires Administrator credentials for refund approval; operational history is not automatically own-only. RECOMMENDATION: preserve both behaviors while routes move, resolve any desired ownership/approver-policy change separately.
12. **Compatibility role trigger is a security dependency.** Removing legacy role fields/migrations can alter grants or lock out administrators. RECOMMENDATION: defer database role retirement entirely.

Simply changing a frontend URL does not bypass existing Nest guards. The danger is accidentally omitting policy while moving pages, changing backend decorators without understanding their defaults, or broadening data/action rules to make newly visible pages work.

## 12. Proposed Centralized Architecture

**RECOMMENDATION:** Use feature URLs, thin route adapters, feature-owned workspaces, one authenticated boundary, and shared navigation/shell primitives. Continue using the existing Nest feature modules as the authoritative API. Roles group grants; permissions control capabilities; explicit remaining legacy policies remain visible as temporary exceptions.

```text
Session cookie -> Nest SessionAuthGuard -> current identity
                                     -> PermissionsGuard OR explicit legacy RolesGuard
                                     -> controller -> service safeguards -> Prisma

/auth/me -> authStore snapshot -> route policy -> feature workspace
                              -> filtered navigation
                              -> permitted widgets/actions
```

The “OR” above describes a choice of endpoint policy, not a runtime fallback granting either rule. The existing guard rejects mixed metadata, and that behavior should remain.

Keep routes independent of membership names. Use `ApplicationShell` with general and POS presentations; the POS feature retains FocusModeContext and layout requirements. Do not force transaction reporting, checkout, and management pages into identical sizing/scrolling. Feature extraction should retain current business handlers and API clients before reorganizing internal abstractions.

## 13. Proposed Directory Structure

**RECOMMENDATION**, incremental destinations rather than files to create in this audit:

```text
ims-frontend/src/
  app/
    layout.tsx                    # styles and AuthBootstrap
    page.tsx
    login/page.tsx
    forgot-password/page.tsx
    reset-password/page.tsx
    (application)/                # route group does not enter URL
      layout.tsx                  # AuthGuard + explicit route policy boundary
      no-access/page.tsx          # authenticated, no capability requirement
      dashboard/page.tsx
      inventory/page.tsx          # existing query views/actions
      suppliers/page.tsx
      products/page.tsx
      reports/layout.tsx
      reports/page.tsx            # redirect to inventory report
      reports/inventory/page.tsx
      reports/pos/page.tsx
      pos/layout.tsx              # POS presentation/context
      pos/page.tsx
      pos/transactions/page.tsx
      forecasting/page.tsx
      alerts/page.tsx
      users/page.tsx
      roles/page.tsx
      settings/page.tsx
      recommendations/page.tsx    # existing placeholder, explicit policy
    admin/...                     # temporary redirect adapters only
    staff/...
    manager/...
    api/geolocation/route.ts      # separately secured server boundary
  features/
    dashboard/ inventory/ suppliers/ products/ reports/ pos/
    forecasting/ alerts/ users/ roles/ settings/
      # feature entry, internal components, feature types/hooks as needed
  components/
    auth/                         # existing bootstrap, guards, denial UI
    layout/                       # ApplicationShell, Sidebar, account, header
    ui/                           # proven shared fields/select/dialog primitives
  lib/
    routing/routes.ts             # stable route IDs, href builders, aliases
    routing/route-policy.ts       # explicit admission policies, no React icons
    navigation.ts                 # groups/icons referencing route IDs
    auth.ts                       # current session client
    api.ts                        # current credentialed browser adapter
    server/                       # only if server data/auth bridge introduced
    [existing feature API clients]# relocate later if useful
  store/                          # current stores, preserved semantics

ims-backend/src/
  auth/guards/                    # authoritative global guards
  auth/rbac/                      # permission catalog/resolver
  [existing feature modules]/    # controller policy + domain services
```

Avoid double-shell rendering: route adapters or feature layout, not both, must own shell composition. The general shared guard layout can remain visually neutral while shell presentations are composed underneath. Extract workspaces that currently instantiate AdminDashboardLayout in a distinct reviewed step. No new database structure is needed for canonical frontend URLs.

## 14. Proposed Canonical Route Map

**RECOMMENDATION:** The complete old-to-new map is in section 3. Canonical feature admission is:

| Canonical route | Policy | Additional constraints |
|---|---|---|
| `/dashboard` | dashboard.view | reports/suppliers/alerts data remain separately gated |
| `/inventory` | inventory.view | Preserve query views, draft IDs, and action keys; independent action grants |
| `/suppliers` | suppliers.view | Create/edit/delete/searchAvailability independent |
| `/products` | products.view | Individual product lifecycle/recipe grants |
| `/reports/inventory`, `/reports/pos` | reports.view | `/reports` redirects to inventory report |
| `/pos` | pos.view | Checkout requires pos.checkout |
| `/pos/transactions` | pos.orders.view | Refund requires pos.refund and current approval safeguard |
| `/forecasting` | forecasting.view | API read mismatch must be reconciled; settings write remains Administrator initially |
| `/alerts` | alerts.view | API policy must reconcile acknowledge/dismiss grants |
| `/users` | users.view | Mutation/session permissions and legacy restrictions retained |
| `/roles` | Explicit legacy Administrator initially | No existing replacement permission |
| `/settings` | Authenticated self-service | Never requires users.manage or an invented settings permission |
| `/recommendations` | Explicit legacy Administrator initially | Preserve placeholder only; not a new permission-bearing feature |
| `/no-access` | Authenticated only | Avoid route-policy recursion; allow settings/logout recovery |

`/suppliers` is preferred over `/inventory/suppliers` because suppliers already has an independent permission, workspace, and navigation entry. Inventory currently behaves as a cohesive query-driven workspace; splitting every tab into a new canonical subtree would add unnecessary migration scope. `/pos/transactions` gives operational history a feature location while keeping reports distinct.

Backend URLs are unchanged in this frontend migration. `/admin/products` on the API origin is not the Next page route. If later removing that API prefix, first resolve the existing `/products` read contract and use explicit API aliases/versioning; do not redirect mutation requests as part of frontend page compatibility.

## 15. Permission Enforcement Strategy

**RECOMMENDATION:**

- Preserve session-first global guards. Every capability API handler must declare a recognized existing permission or an explicitly reviewed legacy/session/public policy.
- Keep page admission, action permission, and resource/business constraints distinct. Possessing create/delete does not automatically imply view in the current resolver; document prerequisite grants for complete UI workflows instead of silently expanding unions.
- Use a discriminated frontend route policy such as permission, authenticated, or legacy-administrator. Keep current catalog keys unchanged. Multiple required keys mean all-of, consistent with the backend.
- Require every new route adapter to register a policy independently of its presence in navigation. Deny unknown protected routes; allow deliberate compatibility resolution to a known destination.
- Preserve service checks for self-account identity, last-administrator safety, current account status, lifecycle rules, refund approver credentials, and transaction integrity.
- Separate forecast read/write controllers or remove class-level roles and assign nonconflicting handler-level policies. Do not add permission metadata under inherited `@Roles` because the guard intentionally raises a configuration error.
- Treat server actions and Next route handlers as real server entry points. When the geolocation handler is protected, obtain verified identity from the session backend; never trust client-provided permissions or merely test that a cookie exists.

## 16. Navigation Strategy

**RECOMMENDATION:** Evolve the existing abstraction, preserving its strengths. Route entries own IDs, canonical hrefs, access policy, page title/subtitle, and shell presentation. Navigation groups reference those IDs and add icons/order/optional children. `getVisibleNavigation` evaluates the same policy as the route guard; actions remain in feature code with their own metadata.

Keep dashboard-first then POS-first landing behavior during rollout. Keep authenticated settings available even when no feature grants exist. Use stable IDs for expanded sections instead of href strings. Preserve group and report child rendering in any shared sidebar, along with mobile focus trapping, Escape dismissal, scroll position, collapsed labels, and POS focus-mode semantics. A future user-selected starting feature can be separate from role identity; it is not required for migration.

## 17. Backward Compatibility / Redirect Strategy

**RECOMMENDATION:** Keep explicit old-route adapters until bookmarks and deployment consumers have been validated. Each alias should redirect directly to its canonical destination, avoiding chains such as old material page -> old inventory -> canonical inventory. Start with temporary redirects during rollout; adopt permanent redirects only after destination stability and rollback needs are resolved.

Use the full section 3 mapping, including `/admin/suppliers`, `/staff/dashboard`, all three settings URLs, report root, and inventory action aliases. Preserve validated view/draft/action values, encoding draft identifiers. Decide deliberate handling of additional future query keys rather than discarding them accidentally. Keep password-reset token behavior unchanged. Hash-dependent links, if introduced, require browser checks because fragments are not server request parameters.

Legacy layouts must not prevent compatibility redirects because their policy registry was partially updated. Retain alias resolution while adapters remain, and enforce destination policy independently. Do not gate `/admin/...` redirects by Administrator role. Redirects transport the user; they do not authorize data or actions.

Do not implement a catch-all “strip /admin” redirect: supplier aliases, query views, staff dashboard, and settings need nontrivial mappings, and unknown paths should not become new features. Apply redirects only on the frontend origin; keep API clients and backend product routes unchanged. Track old-link usage if deployment logging supports it; external bookmarks, proxies, and integrations are NEEDS VALIDATION.

## 18. Incremental Migration Phases

All phases below are **RECOMMENDATION**, independently reviewable and committable. They were not performed. For each phase, rollback should restore its previous routing/policy configuration without data rollback. Backend permission changes are separate commits from page movement.

### Phase 1 — Characterize and separate route policy

- **Objective:** Establish a trustworthy policy and route contract before moving anything.
- **Affected:** `shell-navigation.ts`, frontend permission tests, new routing metadata modules; backend guard/controller policy tests where gaps exist.
- **Prerequisite:** This audit and agreement to retain documented legacy exceptions.
- **Exact change:** Extract stable route IDs/href builders and explicit route policies from navigation, with compatibility aliases. Keep all current URLs, visibility, landing, and permissions. Add explicit registrations for current pages/query-action behavior and session-only exceptions.
- **Risks:** Changing longest-prefix matching can deny valid descendants; no-access can recurse.
- **Migration considerations:** Preserve all listed legacy aliases; keep inventory query action guards and independent supplier access.
- **Targeted tests:** Every section 3 route and alias with no grants, individual grants, admin-without-grants, unknown descendants, and action queries.
- **Regression tests:** Existing frontend auth/permission suites; backend guard conflict/unknown-key checks; login/default landing.
- **Completion:** Complete reviewed route-policy table, existing positive/negative outcomes preserved, explicit exception list, no URL changes.
- **Must not change:** Role grants, database, API contracts, business handlers, shells, or user-visible URLs.

### Phase 2 — Reconcile remaining authorization boundaries

- **Objective:** Remove misleading permission promises before exposing a fully capability-driven experience.
- **Affected:** Alerts controller/tests, forecasting controller/tests, geolocation handler/server bridge or Nest equivalent, endpoint policy coverage tests.
- **Prerequisite:** Phase 1 policy baseline; product decisions for session-only resources and geolocation callers.
- **Exact change:** In separate commits, map alerts to existing view/acknowledge/dismiss keys; map forecast reads to forecasting.view while retaining Administrator write settings; explicitly protect or document geolocation and shared session-only endpoints. Keep roles/membership policies unchanged unless separately approved/designed.
- **Risks:** Revoking implicit Administrator access can reveal missing grants; inherited mixed decorators cause errors; overrestricting shared endpoints can break POS/product lookups.
- **Migration considerations:** Validate current database grants before rollout; do not equate a newly allowed read with write authority. Missing policy decisions should retain documented old enforcement, not weaken it.
- **Targeted tests:** Direct unauthenticated/denied/granted API requests; non-admin with alert/forecast grants; admin without grants; forecast read-only cannot save settings; geo session denial.
- **Regression tests:** Dashboard alerts, forecasting schedules/read selection, supplier location selection, existing permission authorization suites.
- **Completion:** Agreed endpoint policies enforced and documented, or explicitly retained exceptions with matching UI behavior; no silently session-only management endpoints.
- **Must not change:** Frontend URLs, forecast computation, refund approval, role assignment rules, or operational CRUD semantics.

### Phase 3 — Extract feature entries and common shell primitives

- **Objective:** Decouple features from route files and role-named shell ownership.
- **Affected:** Supplier route implementation, dashboard/alerts/forecasting route implementations, settings wrappers, `components/admin`, `components/staff-pos`, shell/account/header components.
- **Prerequisite:** Phase 1; relevant Phase 2 decisions recorded.
- **Exact change:** Extract one feature at a time into `features/*`; retain old pages as thin adapters. Extract supplier logic out of a page imported by another page. Introduce shared ApplicationShell primitives and POS presentation/context without moving URLs. Consolidate settings content/wrappers.
- **Risks:** Double shells, layout height/scroll changes, focus provider loss, changed remounts canceling dialog state.
- **Migration considerations:** Keep compatibility exports only where needed; retain CSS and API imports initially. Do not rename everything in one commit.
- **Targeted tests:** Supplier callbacks, settings update/logout, POS focus/mobile navigation, report headers, single-shell assertions.
- **Regression tests:** Product recipe/lifecycle, inventory dialogs/drafts, sidebar accessibility, responsive visual comparison.
- **Completion:** Old routes render the same feature behavior through extracted entries; shared shell controls behave correctly.
- **Must not change:** Admission policy, API endpoints, data models, pricing/stock/refund logic, offline keys.

### Phase 4 — Introduce canonical routes by feature

- **Objective:** Make feature URLs the canonical browser locations without breaking bookmarks.
- **Affected:** New `(application)` route adapters/layout, old route adapters, route registry/navigation, headers/report switch/account links/tests.
- **Prerequisite:** Shared policy boundary and extracted feature entries. Each feature's policy must be known.
- **Exact change:** Start with settings and suppliers, then products/users/roles, then dashboard/reports/alerts/forecasting, then inventory and POS as separately reviewed batches. Add canonical entry plus direct legacy redirects in each batch; change that feature's nav/href builders and route metadata atomically.
- **Risks:** Redirect loops, frontend/API prefix confusion, lost query IDs, destination guard omission, POS focus checks still using old paths.
- **Migration considerations:** Mixed old/new URLs are expected during this phase. Keep both in policy resolution; canonical destination is authoritative. Preserve explicit legacy policies for roles/recommendations.
- **Targeted tests:** Direct reloads and client navigation for old/canonical routes, logged-out and denied users, encoded draft IDs, each inventory action/view, POS focus and receipt/refund flow.
- **Regression tests:** API permission suites unchanged; feature smoke tests, mobile sidebar, login landing and no-access recovery, account switching and permission refresh.
- **Completion:** All mapped aliases resolve directly, internal links use canonical builders, authorized results match baseline, unauthorized API calls remain denied.
- **Must not change:** Backend `/admin` product API namespace, seeded grants, legacy enum/trigger, domain calculations or session behavior.

### Phase 5 — Validate rollout and remove redundant code

- **Objective:** Finish frontend structural cleanup after canonical route behavior is stable.
- **Affected:** Unused wrappers/exports, obsolete shell branches, legacy metadata/title maps, old mock components subject to reachability checks, active documentation/tests.
- **Prerequisite:** Full canonical route rollout, regression evidence, old-link usage/bookmark review.
- **Exact change:** Remove proven unused implementations and redundant inner guards; retain compatibility redirect adapters for the agreed support window. Rename role-named generic UI only when imports and styles are migrated. Update operational documentation.
- **Risks:** Dynamic imports mistaken for dead code; external bookmarks invalidated too soon; deleting offline queue data.
- **Migration considerations:** Preserve historical reports and migrations. Redirect retirement is a later explicit decision, not automatic cleanup.
- **Targeted tests:** Reachability/import checks, route build/type checks, all aliases still supported, no unintended new source references to old browser URLs.
- **Regression tests:** Full feature smoke matrix, permission matrix, keyboard/mobile behavior, offline checkout/reconnect.
- **Completion:** Only intentional compatibility and backend API references retain old browser prefixes; unused candidates removed only with evidence.
- **Must not change:** Legacy RBAC database compatibility, public/reset endpoints, API contracts, stored checkout operations.

### Phase 6 — Optional, separately scoped retirement of legacy authorization/API names

- **Objective:** Eventually achieve exclusively capability-driven authorization if product policy requires it.
- **Affected:** Permission catalog/migrations, roles/user-role controllers/services, users safeguards/editor, refund approval, forecast settings policy, API catalog naming if separately desired.
- **Prerequisite:** Canonical frontend stable; explicit administrative capability design and privilege-escalation/last-admin threat review; database migration/rollback plan.
- **Exact change:** Design missing capabilities and controlled grants, migrate legacy exceptions with backend tests, and only then assess enum/trigger retirement. API namespace changes require separate compatibility contracts because `/products` already exists.
- **Risks:** Privilege escalation, loss of all administrators, changed refund approver semantics, grant drift, incompatible API responses.
- **Migration considerations:** Never backfill broad powers based solely on role labels without approved policy. Keep role identity compatibility until all readers/writers are migrated.
- **Targeted tests:** Administrative delegation, anti-self-escalation, last-admin concurrency, role edits/membership revocation, refund approver policy, migration trigger behavior.
- **Regression tests:** Full auth/RBAC/operational suite plus disposable-database upgrade tests and API consumer checks.
- **Completion:** No undocumented legacy authorization remains, migration evidence proves retained access/safeguards, API consumers migrated where applicable.
- **Must not change:** Business ownership/financial rules implicitly; this is not a prerequisite for role-neutral URLs.

## 19. Testing Strategy

**VERIFIED FROM CODE / EXECUTED:** `node --test tests/authStore.test.cjs tests/permissions.test.cjs` in `ims-frontend` passed all **20 tests**. Initial sandbox execution could not spawn workers (`EPERM`); the approved rerun outside the sandbox passed. These are store/static rendering/policy checks, not browser end-to-end tests.

Existing backend suites include `auth/rbac/rbac.spec.ts`, auth interceptor tests, role/user-role services, user safeguards, and authorization suites for products, inventory, stock runs, suppliers, reports, POS, users, and settings. The inspected report authorization suite exercises HTTP guards with mocked sessions/resolver/data services; it explicitly avoids a real database. Migration coverage exists in `test/rbac_migration_test.py`. These tests are useful starting points, but their existence is not evidence of a live deployment's security or of passing this audit's backend test run.

Backend suites, browser tests, builds, database migrations, and database-dependent E2E were **not run** in this analysis-only audit. No database was modified. Backend `npm run lint` includes `--fix`, so it was deliberately not used. Build/generation tools that create artifacts were not needed to write this report.

**RECOMMENDATION:** For migration commits, use the following matrix:

| Dimension | Required cases |
|---|---|
| Identity | Logged out, active Staff/Manager/Administrator, inactive/suspended, expired/revoked session |
| Grants | None, feature view only, action without view, view+action, multiple custom roles, admin with removed grants |
| Entry | Canonical direct reload, client link, old alias, wrong/unknown path, encoded query, manual API call |
| Revocation | Grant removed while page/dialog open; focus refresh; role assignment revokes session; logout/login different user |
| Actions | Inventory waste/create, supplier delete, stock-run post/delete, recipe edit, checkout/refund, user session revoke |
| Data dependencies | Dashboard without reports, inventory without suppliers/stock-runs/reports, products without inventory, POS without order history |
| State | POS offline cache/queue/reconnect, inventory draft selection, receipt state, sidebar collapse/scroll, report filters |
| Security configuration | Public/session/permission/legacy classification for every HTTP handler; mixed metadata rejects; unknown key rejects |

Use disposable seeded databases for session/membership/trigger/last-admin integration tests and never infer coverage from mocked controller tests alone. Browser tests must assert that denial does not mount data loaders, while API tests assert 401/403 independently. Capture pre/post visual behavior for general/POS shells. Run relevant build/type checks after actual future moves; broaden testing when changed surfaces justify it.

## 20. Cleanup Candidates

**RECOMMENDATION** classifications; none deleted:

| Candidate | Classification | Condition |
|---|---|---|
| Duplicate settings wrappers, redundant staff dashboard implementation, supplier page-to-page import | Immediately removable after migration | Canonical entry and redirect replacement tested |
| Redundant inner AuthGuard on staff dashboard/transactions | Immediately removable after migration | Shared authenticated layout verified |
| Role-specific title maps/settings href rewrites, old pathname focus tests | Immediately removable after migration | Stable route metadata fully replaces them |
| Old `/admin`, `/staff`, `/manager` route adapters and alias metadata | Temporarily required compatibility code | Retire only after support-window/bookmark validation |
| Temporary feature re-exports | Temporarily required compatibility code | All static/dynamic consumers moved |
| `components/layout/DashboardShell.tsx`, `components/admin/inventory/MaterialActionPage.tsx` | Uncertain / requires validation | Searches found definitions but no current consumer; confirm full reachability before deletion |
| `components/inventory/*`, mock product/POS data, old transaction/void modals | Uncertain / requires validation | Audit imports, dynamic loading, tests, and intended retained features |
| `InventoryInsightPage.tsx`, `TransactionHistoryPanel.tsx` | Keep, active | Dynamic workspace import / active transaction page consumer verified |
| Legacy `Role`, RolesGuard, compatibility triggers and protected-role safeguards | Keep, active security dependency | Separate Phase 6 only |
| Backend `AdminProductsController` namespace | Keep, active API contract | Separate API migration only |
| Historical migrations/reports, Python integrations | Keep | Do not erase history to remove textual role references |

## 21. Open Questions / Ambiguities

**NEEDS VALIDATION:**

1. Are alerts intended to be fully delegated by their existing grants? Current UI says yes, API says legacy Administrator. Phase 2 must make that policy explicit.
2. Should forecast settings, role administration, role assignment, and refund approval eventually gain separate capabilities? None of those replacement keys exists today.
3. Are categories and variant availability deliberately available to every authenticated user? Which callers require which data shape?
4. Who should be permitted to use geolocation: any authenticated account, supplier readers, supplier editors, or another defined set? Choose policy before changing server enforcement.
5. Is operational order history intentionally store-wide? If own-only access is desired, resource scoping is a separate API change, not a URL rename.
6. What should happen to queued checkouts when another account logs in on the same browser? Global keys and current-session replay need a deliberate ownership policy.
7. Are all RBAC SQL migrations/triggers installed in every environment, and what grants have administrators edited since installation?
8. Which bookmarks, reverse proxies, external links, browser automation, or integrations rely on old paths? Repository search cannot prove their absence.
9. Is the recommendations placeholder still desired? Preserve its existing restriction until product scope is decided; do not expose it as a new completed feature.
10. Should POS focus mode remain selected across navigation? Current local shell state can reset; preserve baseline first, decide persistence separately.
11. Is the current dashboard-first landing order desired for all permission combinations? Keep it initially; a preference-based landing can be future work.

These questions do not prevent preparatory policy extraction or safe feature URL moves that retain current enforcement. They do prevent silently claiming complete removal of all legacy-role authorization.

## 22. Recommended First Implementation Phase

**RECOMMENDATION:** Implement Phase 1 only as the first change set: explicit route IDs and admission policies, a compatibility map, and characterization tests covering every current route. Keep URLs, API handlers, database grants, and visual shells unchanged.

The reviewable outcome should demonstrate that a Staff account with inventory grants can still use the inventory feature, an Administrator without product grants still cannot read product APIs, no-grant accounts can still manage their own settings, and role/membership administration remains protected. Then address alerts/forecasting policy in separate commits and migrate feature entries one at a time.

This audit did not begin that implementation.
