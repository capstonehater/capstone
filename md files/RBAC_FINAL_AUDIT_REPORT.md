# Final RBAC Completion Audit

Date: 2026-09-30. Method: read-only source inspection and permission-literal comparison. Only this requested report was created. No fixes, tests, migrations, seeds, live API mutations or database operations were run during the audit. Existing uncommitted implementation work was preserved.

**No RBAC implementation changes were made during this audit.**

## 1. Conclusion and final architecture

The eight requested module areas have the intended core policies, but this is not a clean security/parity sign-off. A high-priority account-takeover risk and several permission mismatches remain. The implementation must not be described as having no privilege escalation path based on this audit.

The system deliberately combines:

- Session authentication for all non-public routes.
- Catalog-based permissions for migrated feature endpoints.
- Administrator-only role definitions and membership administration, as the FINAL architecture, not a pending migration.
- Authenticated personal account settings without a feature permission.
- Remaining legacy feature checks identified below.

AuthModule registers SessionAuthGuard, PermissionsGuard and RolesGuard in that order. Permission requirements are all-of, not OR. RequirePermission validates keys; PermissionsGuard rejects malformed/unknown requirements and conflicting role/public metadata. No conflicting policy was found on migrated controllers. Administrator identity alone does not bypass migrated permissions.

PermissionResolver reads current active account status and memberships from the database, unions known catalog grants and computes an authorization revision. Permission checks do not trust the frontend cache. RolesGuard uses the current legacy User.role from the validated session. Holding an additional Administrator AccessRole on a Staff identity does not itself grant legacy Administrator-only role administration.

Evidence: src/auth/auth.module.ts; auth/guards/{session-auth,permissions,roles}.guard.ts; auth/decorators/require-permission.decorator.ts; auth/rbac/permission-resolver.service.ts (backend paths throughout unless otherwise stated).

## 2. Permission catalog summary

34 supported keys; frontend source contains references to all 34. Static quoted-key comparison found no frontend-only keys in the audited permission namespaces and no unknown controller RequirePermission key.

| Module | Keys |
| --- | --- |
| Dashboard (1) | dashboard.view |
| Products (6) | products.view, products.create, products.edit, products.archive, products.restore, products.delete |
| Inventory (5) | inventory.view, inventory.create, inventory.edit, inventory.archive, inventory.waste |
| Stock Runs (5) | stockRuns.view, stockRuns.create, stockRuns.edit, stockRuns.delete, stockRuns.post |
| Suppliers (5) | suppliers.view, suppliers.create, suppliers.edit, suppliers.delete, suppliers.searchAvailability |
| Reports (1) | reports.view |
| Forecasting (1) | forecasting.view |
| Users (3) | users.view, users.manage, users.sessions.revoke |
| POS (4) | pos.view, pos.checkout, pos.orders.view, pos.refund |
| Alerts (3) | alerts.view, alerts.acknowledge, alerts.dismiss |

29 keys are used in controller RequirePermission decorators. The five without such usage are dashboard.view, forecasting.view and the three alerts keys. Dashboard is a frontend page gate whose report dependencies separately require reports.view; absence of a dashboard decorator is not itself a missing report guard. Forecasting and Alerts are genuine policy mismatches.

roles.view and roles.manage are absent from the catalog and production source authorization checks. Do not introduce them. settings.manage is also absent; no unsupported Settings key was introduced.

## 3. Module coverage

| Module | Current coverage | Qualification |
| --- | --- | --- |
| Products | 19 product/variant/recipe/read handlers use six product keys | Variant create/delete frontend mismatch remains |
| Inventory | 12 material/unit/history/summary/waste handlers use five inventory keys | Shared supplier discovery is separately authorized; no adjustment API exists |
| Stock Runs | 10 handlers use five stockRuns keys | Three draft-delete aliases are protected; material/supplier selector reads require their separate grants |
| Suppliers | Four CRUD/list handlers plus two discovery handlers use five supplier keys | Receiving full-directory selector requires suppliers.view; Stock Run writes do not require supplier management grants |
| Reports | All 17 reporting handlers inherit reports.view | Operational order drilldown separately needs pos.orders.view |
| POS | Five menu/checkout/history/refund handlers use four POS keys | Refund also retains privileged approval; offline retries use guarded checkout |
| Users | 12 handlers use three user keys | Direct legacy role changes remain Administrator-only; indirect account-takeover risk below |
| Settings | Three personal routes are authenticated self-service | Shared forecasting configuration exists and remains legacy Administrator-only; global settings permission migration is deferred |

Shared GET /categories and GET /variants/:id/availability remain session-only. These are existing shared operational reads, not product-management mutations. Root and authenticated auth endpoints are also session-protected rather than feature-permission routes. Login/forgot-password/reset-password remain explicitly public authentication flows.

## 4. Every remaining @Roles usage

Four production controller decorators remain:

| Location | Covered endpoints | Classification | Recommendation |
| --- | --- | --- | --- |
| roles/roles.controller.ts:22 | GET /roles; GET /roles/permissions; POST /roles; PATCH/DELETE /roles/:id | INTENTIONAL final Administrator-only architecture | Keep |
| users/user-roles.controller.ts:13 | GET/POST /users/:id/roles; DELETE /users/:id/roles/:roleId | INTENTIONAL final Administrator-only architecture | Keep |
| alerts/alerts.controller.ts:11 | GET /alerts; GET /alerts/unread-count; POST acknowledge/dismiss | LEGACY; SHOULD MIGRATE to existing matching alert keys in separately authorized work | Current custom grants cannot authorize these APIs; legacy Admin without alert grants still can |
| forecasting/forecasting.controller.ts:25 (read handlers) | GET /forecasting/products, /latest, /runs/:id | LEGACY; SHOULD MIGRATE to forecasting.view in separately authorized work | Frontend and backend differ |
| Same forecasting decorator (write handler) | PUT /forecasting/settings | LEGACY global configuration; intentionally retained pending explicit catalog/policy decision | Do not treat forecasting.view as write authority; settings.manage does not exist |

Additional role checks are not accidental duplicates: UsersController restricts privileged creation and scalar role edits; UserRolesService rechecks an active Administrator actor; UsersService counts legacy/protected Administrators; OrdersService asks AuthService for Administrator credential approval for refunds. These must be distinguished from role-based feature route access. No recommendation here changes role administration authorization.

## 5. Intentional Administrator-only areas

Role definitions, permission assignment to roles and user-role membership changes stay Administrator-only. The roles navigation entry uses administratorOnly, and role assignment UI also checks the legacy Administrator role. RolesService rejects unknown permission keys, protects system/protected role deletion, rejects deletion of roles with members and uses revision checks/audit records. Database migration source also protects protected-role identity/deletion; deployment of that migration was not verified against a live database.

UserRolesService rejects non-Administrator and inactive actors, protects matching compatibility memberships and last active protected Administrator membership, uses serializable transactions, logs assignment changes and revokes target sessions. The scalar role compatibility path remains separate and Administrator-restricted.

The frontend shell-navigation TODO proposing future role permission keys is now stale relative to the final architecture decision. It is documentation cleanup, not permission migration work.

## 6. Frontend/backend parity

Navigation uses canAccessNavigation and getRouteAccess, including nested routes and aliases. PermissionRoute enforces the shared navigation map, and PermissionAction uses can/canAll for action visibility. authStore checks server-supplied effectivePermissions without an Administrator bypass. AuthBootstrap refreshes on focus/visibility; UI grants can temporarily be stale, while backend checks remain current. Literal-key parity does not establish action-level parity.

Confirmed mismatches and qualifications:

1. **Product variants:** frontend ProductVariantsRecipeTab.tsx:71 gates Add Variant with products.edit, but POST /admin/products/:id/variants requires products.create. Its Delete action at approximately line 147 also uses products.edit, while DELETE /admin/variants/:id requires products.delete. Edit-only users see denied actions; users holding only create/delete may not see permitted ones.
2. **Alerts:** navigation/actions use alerts.view/acknowledge/dismiss, but all four APIs use legacy Administrator authorization.
3. **Forecasting:** navigation uses forecasting.view while backend reads require Administrator. Shared horizon updates also remain Administrator-only; a read grant must not implicitly permit them.
4. **Users:** controls use users.manage but can offer privileged creation or role changes to non-Administrators that the backend rejects. Correction to the earlier broad compatibility note: handleEdit in UsersWorkspace.tsx:531 omits the role field when unchanged; ordinary profile edits are not universally blocked. A changed role still produces the intended 403 for non-Administrators.
5. **Role assignment UI:** UsersWorkspace additionally wraps UserRolesSection in users.manage, while the separate backend role-assignment API requires only legacy Administrator identity. An Administrator stripped of users.manage can have backend role authority that this section hides. Role administration itself remains intentionally Administrator-only.
6. **Composed workflows:** inventory entry requires inventory.view; receiving selectors need suppliers.view; report widgets need reports.view; report order detail needs pos.orders.view; recipe editing also needs inventory.view. These are explicit cross-module dependencies, not implicit grant inheritance.
7. **Settings:** authenticated-only frontend access matches self-service backend. No settings.manage requirement is appropriate for personal account routes.

## 7. Security observations

### High priority: users.manage can enable Administrator account takeover

Source evidence:

- UsersController.updateUser requires users.manage and blocks non-Administrator callers only when dto.role is supplied (src/users/users.controller.ts:75 onward).
- UsersService.updateUser accepts dto.email for any target and does not restrict editing Administrator identities (src/users/users.service.ts:449 onward, email assignment around line 471).
- POST /users/:id/password-reset also requires users.manage and permits ACTIVE accounts.
- AuthService.issuePasswordResetForUserId sends the token to the target account's current email (src/auth/auth.service.ts:94 onward).

Consequently, a delegated non-Administrator with users.manage and a known Administrator target ID can change that account's email to an address they control, request reset, and potentially sign in as that Administrator. Preconditions include working email delivery and ability to receive the reset message. This is a source-supported escalation path, not a live exploit performed during this audit. The explicit role-field restriction does not prevent this indirect takeover. Last-admin checks count account identity/membership, not ownership of its email.

Recommended separately authorized remediation: define protected-target policy for delegated user management, including login identifier changes, setup/reset, activation and other sensitive control of Administrator or more-privileged accounts. Add regression tests for this chain before treating delegated users.manage as lower trust than Administrator. No fixes were made.

### Existing safeguards verified in source

- Self role edits, suspension and deletion are rejected by UsersService.
- Demotion/suspension/deletion preserve last active legacy and protected Administrator checks; membership removals have their own protected checks.
- Session validation checks hashed token lookup, revocation, absolute/idle expiry, active status and password-change timestamp. Session identity is loaded from the database.
- Self-service settings use CurrentUser.id; DTO whitelisting rejects injected target/role/status fields. Password change verifies current password; password/email changes revoke sessions and clear cookies.
- Feature grants are resolved fresh on each protected request, including offline checkout replay; cached browser grants cannot authorize revoked operations.
- Dedicated session revocation checks the session belongs to the requested user. Account management operations may also invalidate sessions as an existing side effect.

### Residual limitations

Protected Administrator role editing requires at least one remaining permission, not a required administrative permission bundle (roles/roles.service.ts). Last-admin checks preserve identities/memberships, not guaranteed access to every migrated module. An Administrator can intentionally remove operational grants and lock out workflows, although final legacy role administration still offers recovery for an active legacy Administrator. Document that distinction.

No concurrency, deployed migration, production grant assignment, live session or browser behavior was tested here. Source inspection cannot certify absence of all escalation paths. Prior phase test reports do not cover the identified takeover chain.

## 8. Recommended cleanup, not performed

1. Prioritize the protected-target users.manage escalation review and regression coverage.
2. Align variant Add/Delete visibility with backend products.create/products.delete.
3. Separately authorize Alerts and Forecasting read migrations using existing keys; decide shared forecast-setting policy without weakening it to a read grant.
4. Preserve Administrator-only role administration; remove stale TODOs suggesting future roles.view/roles.manage.
5. Align role-assignment UI and user role controls with the final Administrator boundary; preserve ordinary profile editing.
6. Document cross-module workflow grants, shared session-only reads, grant-refresh behavior and recovery procedures.
7. Distinguish identity-based last-Administrator protection from operational permission continuity.

**No RBAC implementation changes were made during this audit.**

Stopped after the read-only audit and creation of this report.
