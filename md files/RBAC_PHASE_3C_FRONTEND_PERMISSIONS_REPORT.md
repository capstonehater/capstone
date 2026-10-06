# RBAC Phase 3C - Frontend Permission Integration

Date: 2026-09-29. Status: complete. Scope: frontend UX only.

Read the Phase 1, Phase 2, Phase 3A, and Phase 3B reports before implementation. Existing uncommitted work from those phases and earlier UI work was retained.

## 1. Navigation

`shell-navigation.ts` now contains feature access requirements alongside navigation entries. Both admin and staff shells filter the same entries through the existing auth store `can()` helper. Empty navigation groups are removed, and report children are filtered. POS and transaction history are discoverable from either shell according to permissions; custom role grants are not hidden because of the legacy Staff/Administrator label.

Catalog-backed sections use dashboard.view, inventory.view, products.view, suppliers.view, reports.view, forecasting.view, alerts.view, users.view, pos.view, and pos.orders.view. Material action paths also check their action requirement. This is route/action metadata, not a second permission catalog or role-to-permission map.

### Approved compatibility exceptions

The user explicitly instructed that capabilities without catalog keys preserve existing access behavior:

- Roles & Permissions remains **Administrator-only**, including its create/edit/delete workflows. It does not substitute users.manage for role management or introduce new permission keys.
- Role assignment remains Administrator-only and additionally requires users.manage as part of user administration.
- Settings remains authenticated self-service. Account menu links follow the current shell rather than the legacy role.
- The existing recommendations placeholder remains Administrator-only.
- Forecast configuration writes retain Administrator-only access; forecast viewing uses forecasting.view.

TODO: replace these administrative exceptions with backend catalog requirements when the catalog and endpoint authorization are expanded. No missing permission keys were introduced or referenced by application access checks.

## 2. Routes and authentication

`PermissionRoute` evaluates the current pathname against navigation policy, using the most specific matching route. It handles existing aliases and denies unknown sections. Admin and staff layouts now require authentication followed by feature authorization instead of a blanket legacy-role restriction. The manager settings layout also explicitly requires authentication.

`AuthGuard` still redirects unauthenticated visitors to login. Authenticated permission denial renders **No Access** with an explanation, a link to an available workspace where applicable, account settings, and sign out. It does not send authenticated users back to login.

`PermissionGuard` supports an individual permission through can() or all required permissions through canAll(). `PermissionAction` uses the same guard with an empty fallback so unavailable controls are hidden.

The route boundary remounts feature content when the signed-in identity, legacy role, authorization revision, or effective grant list changes. This discards component-local cached data and dialogs after authorization updates. Inventory's shared panel selection can remain in its existing store, but every rendered mutation dialog is separately permission-gated. Existing Phase 3B focus/visibility session refresh remains unchanged.

## 3. Actions

- Products: creation, editing, manual availability, archive, restore, deletion, variant management, and recipe editing. Variant operations follow products.edit, matching the catalog description. The recipe editor additionally requires inventory.view because it loads the material picker.
- Inventory: material creation/edit/archive, waste, store availability, stock-run creation/edit/delete/post, and corresponding dialogs/forms.
- Users: creation, profile edits, setup/reset emails, suspend/reactivate/delete require users.manage. Session revocation uses users.sessions.revoke independently. Role assignment retains the compatibility restriction above.
- Suppliers: create/edit/delete controls and mutation handlers.
- Alerts: acknowledgement and dismissal actions on both the alerts page and dashboard.
- POS: payment/checkout, offline queue synchronization, and refunds. Background checkout synchronization checks the current grant before starting and before each queued request.
- Forecast settings: existing Administrator-only mutation behavior preserved pending a catalog expansion.

Existing backend validation, self-edit restrictions, protected-role rules, last-administrator protections, and refund approval requirements are unchanged.

Removed the old Users role-to-permission display map. The Permissions tab now reads the selected user's effective grants from the existing user-role endpoint and refreshes after role assignments. This display is not used to authorize the signed-in user.

## 4. Data loading

`loadIfAllowed` accepts a deferred request and consults the current auth store before starting it. Denied requests return the caller's empty fallback without invoking the request.

- Denied feature routes never mount their client workspaces, so Users and other feature effects do not run without the corresponding view permission.
- Dashboard report requests require reports.view; alert requests require alerts.view; supplier counts require suppliers.view. Unavailable reports are replaced by an explanatory message rather than showing misleading zero totals.
- Inventory does not list or fetch stock-run details without stockRuns.view. Supplier support data requires suppliers.view. Report summaries and report modal children require reports.view.
- Products loads inventory material choices only with inventory.view.
- Role administration does not mount for non-Administrators. Role assignment/catalog loading is also gated.
- Transaction history requires pos.orders.view; opening the POS workspace alone does not fetch order history.

Feature-internal reads retain their feature scope. For example, product recipe viewing follows products.view, while inventory report modals sit inside the inventory workspace and also require reporting access. Already-started requests are not retroactively cancelled everywhere, but removed feature components cannot expose their returned local state; new gated requests use the latest snapshot.

## 5. Landing routes

`getDefaultLandingRoute()` uses the same navigation policy and the existing auth store checks. Login uses it for both an existing session and a successful sign-in.

Priority: an allowed administrator dashboard, an allowed POS workspace, then the remaining allowed catalog-backed navigation entries. Inventory-only accounts land on `/admin/inventory`; cashiers land on `/staff/pos`; accounts with no feature grants land on `/no-access`. Self-service Settings and compatibility-only entries do not override the no-permission landing state.

Removed the obsolete role-based landing helper and the login page's legacy Manager dead-end message. Manager accounts can now reach a workspace if their effective permissions allow it, subject to existing server authorization.

## 6. Components and helper files created

Paths below are relative to `ims-frontend/`:

- `src/components/auth/PermissionGuard.tsx` (including PermissionAction)
- `src/components/auth/PermissionRoute.tsx`
- `src/components/auth/NoAccess.tsx`
- `src/app/no-access/page.tsx`
- `src/app/manager/layout.tsx`
- `src/components/admin/users/UserEffectivePermissions.tsx`
- `src/lib/permission-loading.ts`
- `tests/permissions.test.cjs`

## 7. Existing files modified in this phase

Paths relative to `ims-frontend/src/`:

- `components/layout/shell-navigation.ts`, `components/layout/SidebarAccount.tsx`
- `components/auth/AuthGuard.tsx`, `components/login/LoginForm.tsx`, `lib/auth.ts`
- `app/admin/layout.tsx`, `app/staff/layout.tsx`, `app/staff/dashboard/page.tsx`, `app/staff/transactions/page.tsx`
- `app/admin/dashboard/page.tsx`, `app/admin/alerts/page.tsx`, `app/admin/forecasting/page.tsx`
- `components/admin/AdminSidebar.tsx`
- `components/admin/inventory/InventoryWorkspace.tsx`, `MaterialDetailPanel.tsx`, `StockRunModals.tsx`, `StockRunsPanel.tsx`
- `components/admin/products/ProductsWorkspace.tsx`, `ProductDetailHeader.tsx`, `ProductListToolbar.tsx`, `ProductVariantsRecipeTab.tsx`
- `components/admin/suppliers/SupplierWorkspace.tsx`
- `components/admin/users/UsersWorkspace.tsx`, `UserRolesSection.tsx`
- `components/admin/roles/RolesWorkspace.tsx`
- `components/staff-pos/StaffDashboardLayout.tsx`, `StaffPOSPage.tsx`, `TransactionHistoryPage.tsx`, `TransactionHistoryPanel.tsx`, `modals/ReceiptModal.tsx`

Other dirty files already present in the workspace belong to previous work; they are not Phase 3C changes. The existing authStore and AuthBootstrap implementations are reused unchanged in this phase.

## 8. Validation

Executed from `ims-frontend`:

- `node --test --test-isolation=none tests/authStore.test.cjs tests/permissions.test.cjs`: **20 passed** (8 existing store cases, 12 new permission cases).
- `npx tsc --noEmit`: passed.
- Targeted ESLint across changed UI/helper/test files: no errors. Existing hook-dependency warnings remain in InventoryWorkspace (4), Alerts (2), and StaffPOSPage (2).
- Local Next development HTTP compilation checks: `/login`, `/no-access`, `/admin/inventory`, `/admin/dashboard`, `/admin/products`, `/admin/users`, `/admin/roles`, `/staff/pos`, `/staff/transactions`, `/admin/settings` returned 200 without Next error pages.

New tests cover Administrator navigation, inventory-only and cashier navigation/landing, no implicit grant from a role label, compatibility exceptions, no-permission landing, missing-action hiding without child rendering, all-of requirements and revocation, denied route rendering without mounting its loader, skipped requests after denial/logout, unknown route denial, and parity of frontend access-check literals with the backend catalog.

The tests render component snapshots against the actual auth store with lightweight Next/router mocks; they are not authenticated browser end-to-end tests. HTTP checks verify compilation, not logged-in business operations. No database or account mutations were performed to validate this phase.

## 9. Security boundary and remaining limits

Frontend checks are UX controls only. A custom role may expose a feature in the UI while the existing backend legacy-role guard still returns 403. This is expected during this staged rollout and must not be worked around by weakening server authorization.

Authentication, API request/response contracts, backend controllers/guards, permission catalog, Prisma schema, migrations, and database contents were not changed in this phase. Backend permission-guard infrastructure from Phase 1 remains present; no existing endpoint was migrated to it here.

Backend changes: **NONE**.

Endpoint authorization migration: **NOT IMPLEMENTED**.

Backend permission enforcement: **NOT IMPLEMENTED in Phase 3C**.

Phase 3C stops here.
