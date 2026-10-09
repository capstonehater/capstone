# System Evaluation Context

## 1. System Overview

**Project name (confirmed):** Café Salvacion IMS, inferred from the repository's `ims-*` project names and the frontend asset `cafe-salvacion-logo.png`. The package identifies the frontend as `inventory-management-system`. The deployed/official product name is not established by source code alone.

**Purpose (implementation-supported):** A browser-based café inventory management and point-of-sale system. It maintains products and recipes, raw-material stock and suppliers, records stock runs and waste, processes POS orders and reversals, provides alerts, forecasts, reports, and account/role administration. The repository supports that this is an operational system; the actual business problem statement and measured outcomes are not documented in the code.

**Deployment/platform:** Web client and HTTP API, with separately configured frontend origin and backend port. Local start scripts and run instructions are present, but production hosting, topology, supported browsers/devices, and actual deployed environment cannot be verified here.

**Evidence convention:** “Confirmed” means code/config/schema implements it. “Inferred” means implementation suggests intent, but no product or stakeholder specification confirms it. “Unknown” means repository review cannot establish it.

## 2. Purpose and Scope

The implemented scope covers café catalog and ingredient setup; inventory tracking, procurement/stock intake, waste and availability; sales at a POS; sales/inventory analysis; alerts and forecasts; and account, session, role and permission management. The backend also contains event/outbox processing, inventory snapshots and availability history, which are technical supporting functions rather than clearly separate user-facing modules.

The code does not establish the organization’s formal requirements, operational procedures, actual user population, whether online ordering is in scope, or whether the application is deployed and used in a live café.

## 3. Technology Stack

| Area | Finding | Evidence |
|---|---|---|
| Frontend | Next.js 16.2.1, React 19.2.4, TypeScript; Zustand; Bootstrap/Tailwind/Sass dependencies; Lucide and React Icons | `ims-frontend/package.json`, `ims-frontend/src/app`, `ims-frontend/src/features` |
| Backend | NestJS 11, TypeScript, Express platform | `ims-backend/package.json`, `ims-backend/src/main.ts`, `ims-backend/src/app.module.ts` |
| Database/data access | PostgreSQL via Prisma 6; database URL is `DATABASE_URL` | `ims-backend/prisma/schema.prisma`, `ims-backend/src/prisma` |
| Authentication | Server-side session records and opaque/session token handling, delivered to browser in configured cookie; bcrypt password hashing; forgot/reset flows | `ims-backend/src/auth`, `ims-backend/prisma/schema.prisma` (`AuthSession`, reset-token models) |
| Authorization | Legacy `ADMINISTRATOR`, `MANAGER`, `STAFF` role enum plus additive database-backed access roles and catalog permissions. Guards/interceptor enforce session, role, and permission metadata. Frontend route/action checks also exist. | `ims-backend/src/auth/guards`, `ims-backend/src/auth/rbac`, `ims-backend/src/roles`, `ims-frontend/src/lib/routing/route-policy.ts` |
| Input handling | Nest validation pipe transforms input, strips unknown fields and rejects non-whitelisted fields; DTOs use class-validator | `ims-backend/src/main.ts`, module `dto` directories |
| Other libraries/integrations | Nodemailer for email-related password reset notification; Sharp for image processing; browser geolocation route and Leaflet dependency are present. Actual external mail provider and geolocation data provider/configuration are environment-dependent and not confirmed. | `ims-backend/src/auth/password-reset-notifier.service.ts`, `ims-backend/src/settings/profile-picture.ts`, `ims-frontend/src/app/api/geolocation/route.ts`, `ims-frontend/package.json` |

The frontend calls a separate API through its API client. The browser’s supported device/browser matrix and production deployment configuration are unknown. No confirmed payment gateway integration was found; payment methods represented in the schema include cash, GCash, Maya, card and other, which does not by itself establish external payment processing.

## 4. User Roles and Stakeholders

**Confirmed role values:** `ADMINISTRATOR`, `MANAGER`, `STAFF` (`ims-backend/prisma/schema.prisma`, `ims-backend/src/common/constants/roles.ts`). User accounts also carry active/status fields. The authorization model includes assignable access roles and permissions. These grants can change in stored data; there is no single fixed complete permission matrix derivable from the enum values alone.

**Stakeholders reasonably inferred:** café administrators/owners, managers, staff/cashiers, and people responsible for system evaluation or maintenance. End customers are not established as direct system users: the POS is an authenticated interface and no customer-facing ordering route was found. This stakeholder interpretation should be checked with the project owner.

## 5. Module Inventory

Module evidence is summarized at the behavior level. Backend controllers, DTOs, services, frontend feature components, and route policies are cited; labels in navigation alone are not treated as proof of behavior.

| Module | Purpose, user and implemented behavior | Inputs, processing and outputs | Validation, access, dependencies, exceptions | Evidence |
|---|---|---|---|---|
| Authentication and recovery | Sign in/out, inspect current identity, request and complete password reset. All authenticated users. | Credentials or recovery data; creates/revokes session; sets/clears cookie; returns user/message. | DTO validation, throttling for recovery, account/session checks; email delivery depends on configuration. | `ims-backend/src/auth/auth.controller.ts`, `auth.service.ts`, `auth-throttle.service.ts`; frontend `src/app/login`, `forgot-password`, `reset-password` |
| Dashboard | Present dashboard metrics for permitted users. | Queries summarized POS/inventory report data; outputs dashboard cards/visuals. | Route and report access permissions; actual metrics depend on stored transactions and date rules. | `ims-frontend/src/features/dashboard/DashboardFeature.tsx`, `ims-backend/src/reports/reports.controller.ts`, `reports.service.ts` |
| Products and recipes | Browse/manage products, variants, manual availability, archive/restore/delete, recipe mappings and ingredient usage. Admin/manager-like users with grants. | Product/category/variant/recipe fields; calculates or displays effective availability and ingredient usage; outputs catalog records used by POS. | DTO checks and service eligibility/state rules; permission checks per action. Depends on inventory materials and recipe/availability logic. | `ims-frontend/src/features/products/ProductsFeature.tsx`, `src/components/admin/products/ProductsWorkspace.tsx`, `ims-backend/src/catalog/admin-products.controller.ts`, `product-management.service.ts`, `recipes/` |
| POS checkout | Build and complete café orders from the POS menu. Staff/cashier and other users granted POS actions. | Selected product variants/modifiers, quantities, payment data; prices order, checks availability/recipe, persists order and inventory effects; returns completed order/receipt data. | Checkout permission; DTO and business validations include purchasability/stock and modifier constraints. Inventory/availability and recipe services are dependencies. | `ims-frontend/src/features/pos/PosFeature.tsx`, `ims-backend/src/orders/orders.controller.ts`, `orders.service.ts`, `pricing.service.ts`, `catalog/catalog.controller.ts` |
| POS transaction history / reversal | View prior orders and perform available void/refund actions. | Date/filter/order and reversal reason/payment information; records reversal and related inventory effects. | Separate order-view/refund permissions and service rules; permitted reversal/state checks. | `ims-frontend/src/features/pos/TransactionsFeature.tsx`, `ims-backend/src/orders/orders.controller.ts`, `orders/dto`, `orders/orders.service.ts` |
| Inventory | View materials, balances, batches, transactions and summaries; create/update/archive materials; record waste. | Material attributes, quantities, units, dates/reasons and filters; ledger updates and summary/transaction output. | Action-specific permissions, DTO constraints and inventory/batch rules; depends on units, stock runs, orders and alerts. | `ims-frontend/src/features/inventory/InventoryFeature.tsx`, `ims-backend/src/inventory/inventory.controller.ts`, `inventory.service.ts`, `inventory-actions.service.ts`, `inventory-ledger.service.ts` |
| Stock runs | Create/edit drafts and items, post or delete drafts; posting records received stock. | Supplier, date/reference and line item/material, quantity, cost, batch/expiry fields as supported by DTOs; outputs stock run and inventory entries. | Separate create/edit/post/delete permissions; lifecycle/status checks. Depends on suppliers/materials and ledger. | `ims-frontend/src/app/admin/inventory/materials/create-stock-run/page.tsx`, `admin/inventory/stock-runs/page.tsx`, `ims-backend/src/stock-runs/stock-runs.controller.ts`, `stock-runs.service.ts` |
| Suppliers | List/create/update/delete supplier records and, with a dedicated grant, request/read supplier availability lookup. | Supplier contact/data, material association and lookup request; returns supplier records/search result. | Per-action permissions and DTO/service rules; lookup depends on external/configured search behavior not established as a named provider. | `ims-frontend/src/features/suppliers/SuppliersFeature.tsx`, `ims-backend/src/inventory/inventory.controller.ts`, `store-availability.service.ts` |
| Reports | Inventory and POS dashboards, date-filtered analytics and transaction/business summaries. | Date ranges and report filters; aggregates order, reversal, inventory, waste and stock-run data; outputs report series/tables/cards. | Report permission and DTO filters; results depend on data availability and business timezone logic. | `ims-frontend/src/features/reports/ReportsFeature.tsx`, `InventoryReportsFeature.tsx`, `PosReportsFeature.tsx`, `ims-backend/src/reports/reports.controller.ts`, `reports.service.ts` |
| Alerts | View alert list/unread count and acknowledge or dismiss. Alert types include near expiry, expired, low stock. | Filters and optional action note; state transitions to acknowledged/dismissed; returns alert/count. | View/acknowledge/dismiss permissions; alert rules/re-evaluation are backend services, status constraints apply. | `ims-frontend/src/features/alerts/AlertsFeature.tsx`, `ims-backend/src/alerts/alerts.controller.ts`, `alerts.service.ts`, `alert-reevaluation.service.ts` |
| Forecasting | View forecasts and runs for materials/products as exposed by service, with forecast duration settings. | Product/run selection; reads forecast points, ranges/recommendations; admin-only setting accepts 1–30 days. | Forecast view permission; settings endpoint has legacy Administrator role guard. Depends on stored sales/history/material data and scheduled forecast computation. | `ims-frontend/src/features/forecasting/ForecastingFeature.tsx`, `ims-backend/src/forecasting/forecasting.controller.ts`, `forecasting.service.ts` |
| User administration | List/detail/create/update/suspend/reactivate/delete accounts; request reset; inspect activity/sessions and revoke sessions. | Account identity, status, role, filters; returns account/session/activity data and action result. | `users.view`, `users.manage`, session-revocation grants; privileged role creation/changes retain Administrator restrictions and service safeguards. | `ims-frontend/src/features/users/UsersFeature.tsx`, `ims-backend/src/users/users.controller.ts`, `users.service.ts` |
| Roles and permissions | Administrator-managed access roles and permission assignments. | Role name/description and selected catalog permission keys; create/update/delete with revision; outputs role/permission catalog. | Controller is restricted to legacy Administrator; arbitrary permission keys not accepted. | `ims-frontend/src/features/roles/RolesFeature.tsx`, `ims-backend/src/roles/roles.controller.ts`, `roles.service.ts`, `auth/rbac/permission-catalog.ts` |
| Account settings | Authenticated user reads/edits own account/profile picture and changes password. | Profile fields/image or old/new password; stores updates and may require reauthentication. | DTO/file limits, image handling, password verification; account endpoints require session. | `ims-frontend/src/features/settings/SettingsFeature.tsx`, `ims-backend/src/settings/settings.controller.ts`, `settings.service.ts`, `profile-picture.ts` |
| Technical supporting services | Event outbox, stock/availability history, snapshots and repair, recipe resolution/modifier validation. Not necessarily user-facing. | Internal events and persisted business state; updates projections, availability, history and forecasts. | Worker/scheduling and database state; operational status/monitoring is not established as a user-facing module. | `ims-backend/src/events`, `availability`, `recipes`, `forecasting` |

## 6. Major Features

- Catalog setup with products, variants, categories, recipes/modifiers and manual availability.
- Ingredient/material inventory with batches, transaction history, stock receipts/runs and waste logging.
- POS checkout, order history, and void/refund workflows.
- Supplier records and supplier availability lookup capability.
- Inventory/POS reports and dashboard summaries.
- Low-stock/expiry alerts with acknowledgement and dismissal.
- Forecast runs, forecast display and forecast-day setting.
- Authentication, password recovery, account settings, user/session administration, and configurable access roles/permissions.

Exports/imports and offline POS operation were not established as system-wide supported features from the reviewed routes/controllers. A helper named `pos-offline.ts` exists; whether a complete user-observable offline workflow is supported requires separate runtime verification. No questionnaire is created in this phase.

## 7. Role-Permission Matrix

The following is a structural matrix, not a claim that every role has a fixed grant. Permission grants are data-backed and can be assigned to access roles. Route admission and endpoint enforcement both exist; some endpoints additionally use legacy role guards. Inspect actual deployed role assignments before deciding respondent eligibility.

| Role | Purpose | Accessible modules | Important actions | Restrictions |
|---|---|---|---|---|
| Administrator | Legacy privileged role; role controller and select sensitive settings require it. | Modules for which their account has grants; role management is explicitly legacy Administrator-only. | Manage roles/permissions; can perform user privileged-role operations under controller rules; forecasting settings. | Still subject to endpoint permissions on permission-guarded modules; exact grants depend on database role membership. |
| Manager | Operational management role. | Any route/API permitted by that user's effective grants; common management screens are present but grants vary. | Inventory/catalog/supplier/report/alert/forecast/user actions only when granted. | Cannot use Administrator-only role endpoints; controller prevents privileged account creation/role edits by non-Administrator, with staff creation exception. |
| Staff | Operational/POS role. | POS/dashboard/settings/transactions only if grants allow; other routes likewise depend on permission assignments. | Checkout, order viewing, and other actions only if granted. | Cannot create privileged accounts or change roles; no direct role management. |
| Custom access role membership | Additional grants are assigned via access-role records, additive to legacy role enum. | Union of permission keys assigned to the user's access roles (for active accounts). | Actions corresponding to those catalog grants. | Only catalog keys recognized; some legacy role checks remain alongside permission checks. |

## 8. Major User Workflows

1. **Login/logout:** User → submits email/password → backend verifies account/password, creates or resolves session → sets session cookie and returns identity → logout revokes session when present and clears cookie. Completion is response success/session removal.
2. **Password recovery:** User → submits recovery request → service applies IP-based throttling and initiates reset notification/token flow → user follows reset flow and submits new password/token → service validates and updates password. Email provider/delivery and exact user experience depend on runtime configuration.
3. **Product/recipe setup:** Granted manager/admin user → creates or edits product/variant and recipe → validates fields and ingredient/modifier references → persists catalog and recipe → resulting menu/availability can be used in POS. Archive/restore is a separate lifecycle action.
4. **Stock receipt:** Granted user → creates stock-run draft, adds material/batch quantities and supplier details → edits/removes lines if needed → posts the draft → service updates inventory ledger/batches and summaries. Completion is posted status and resulting stock state.
5. **Waste logging:** Granted user → selects material/batch and quantity/reason → backend validates against available stock and records waste transaction → ledger and summaries update.
6. **POS sale:** Cashier → selects available menu item, variant/modifiers and quantity, enters payment → backend validates checkout and prices/persists order → inventory consumption and order data are recorded → completed order returned. Exact receipt/payment terminal behavior is not established.
7. **Void/refund:** Granted user → selects a prior order and submits reversal details → backend checks order state/permission and records reversal → related inventory/order state updates → reversal result is returned.
8. **Alerts:** User with alert access → opens/filter list or unread count → views low-stock/expiry alert → acknowledges or dismisses with optional note → alert state and actor/time are recorded.
9. **Reports:** User with report access → chooses date/filter → API aggregates matching POS/inventory data → displays report/dashboard results. Completion means results render; correctness of underlying business interpretation needs domain confirmation.
10. **User/role administration:** Administrator or suitably permissioned user → views/creates/updates/suspends/reactivates users or sessions; role administrator edits access role/permissions → service/controller safeguards persist changes and may revoke sessions. Actions vary by effective grants and legacy checks.
11. **Forecast viewing/configuration:** User with forecast access views latest/run data; Administrator changes forecast days in allowed range → service stores setting; scheduled/computation behavior produces runs/points when prerequisites are available.

## 9. User-Observable Behaviors

Potentially observable during realistic use: whether users can sign in and reach allowed screens; menu/page labels and navigation; product/material/supplier/order information shown; successful and rejected form submissions; field/business validation messages; POS totals and completion results; inventory changes after sales, receipts, waste or reversal; filters and report output; alert counts and state changes; forecast values/graphs; account/profile/password changes; access-denied behavior; loading/empty/error states; layout and interactions at tested viewport/device sizes.

These are evaluation opportunities, not quality judgments. Response-time quality, behavior under load, compatibility across browsers/devices, reliability over time, accessibility, and recovery after network/server failure require actual planned use/testing and cannot be concluded from static code review alone.

## 10. Technical/Expert-Observable Characteristics

Ordinary clients generally cannot assess these without technical access: code organization and modularity; coupling/cohesion; database normalization/indexes/constraints; transaction boundaries and concurrency behavior; authorization correctness across all endpoints; password/session implementation details; dependency currency and vulnerability exposure; test coverage and maintainability; deployment/secrets/network configuration; backup/restore capability; logs/monitoring; event/outbox retry behavior; performance under realistic load; security robustness. These require source/database/deployment access, expert review, or controlled tests. Tests in the repository are evidence of test files, not proof of complete quality or passing status.

## 11. Security-Relevant Features

| Area | Static-review finding |
|---|---|
| Authentication | **Implemented:** login/logout/current-user and session-backed guards. **Cannot be determined:** effective deployment cookie flags, transport security and session lifetime without validated runtime environment. |
| Passwords | **Implemented:** bcrypt hashing (12 rounds in `PasswordService`), password change, reset flow and password-related DTOs. |
| Sessions/tokens | **Implemented:** session model, cookie set/clear, session listing/revocation endpoints. Token entropy/expiry policy and live revocation effectiveness require runtime/security testing. |
| Authorization | **Implemented:** legacy roles, permission catalog, user-role/role-permission tables, guards and action checks. **Partially observable:** actual grants depend on deployed database contents; legacy and newer mechanisms coexist. |
| Input validation | **Implemented:** global whitelist/forbid/transform pipe and DTO validation; this does not establish complete safe handling of every input/context. |
| Recovery | **Implemented:** reset token model/flow, notifier and throttling. **Cannot be determined:** actual configured mail delivery, operational recovery success, or token delivery protection from repository alone. |
| Sensitive data | User contact/profile data, password hashes, sessions/reset tokens and order/payment references represented in models. Actual data population, retention, encryption-at-rest and privacy practices are unknown. |
| Audit/history | **Partially observable:** order reversals, inventory transactions, alert actor/time, user activity and authorization audit models/services exist. Coverage/retention and whether all changes are logged consistently are unknown. |
| Backups | SQL dumps and backup files exist in repository, but **not found as an implemented in-app backup/restore workflow**. Production backup schedule, access controls and recovery verification cannot be determined. |
| Access restrictions | **Implemented:** global session guard and permission/role guards plus frontend route policies. Direct API authorization is separately enforced where metadata is present. Full coverage needs technical audit; do not infer from hidden navigation. |
| CSRF/origin | **Implemented:** middleware checks Origin/Referer for unsafe methods against configured frontend origin when those headers are provided. Detailed deployment effectiveness is not established by static review. |

This is feature documentation, not a penetration test or security certification.

## 12. Error Handling and Validation

Validation is applied globally through Nest's `ValidationPipe`; endpoint DTOs provide field constraints. Services/controllers use framework exceptions for invalid states, missing access, not-found conditions, and throttling. Frontend features include request/error/loading handling, but exact user-facing messages differ by workflow and should be evaluated in the running app. Transaction and lifecycle services contain business rules (e.g. draft/post states, stock/availability constraints). Static review does not establish message clarity, consistency, localization, or recovery success under real failures.

## 13. External Integrations

- **Email:** Nodemailer-based reset notification; actual SMTP/provider and credentials are environment configuration and not confirmed here.
- **Geolocation:** a Next.js API route and Leaflet/geolocation-related client files exist. Whether geolocation uses a third-party service, browser coordinates, or is used in a major workflow requires tracing runtime configuration and use.
- **Supplier availability search:** backend service and UI capability exist; source/provider, API contract and external availability were not established.
- **Payments:** payment methods are stored as sale tender categories. No confirmed external payment processor/gateway integration was found.
- **Database:** PostgreSQL is an external infrastructure dependency through `DATABASE_URL`.

## 14. Evaluation Boundaries

Clients/staff should assess only flows they personally use or can observe: POS checkout and transaction history, visible inventory/product data, validations, navigation, access denials, alerts/reports/forecasts they are assigned to use, and their own account settings. Managers can assess operational inventory, product, supplier and report workflows only if those are within their real duties. Administrators can assess account/role administration if they actually perform it.

Do not ask ordinary users to rate internal architecture, schema design, source-code modularity, algorithm correctness absent a domain reference, security controls they cannot see, backup quality, audit completeness, or load/performance limits they have not experienced. Assign those to technical evaluators, domain experts, or controlled measurements. Avoid asking any respondent to rate screens/actions outside their access or experience. Confirm respondent groups and actual permissions before Phase 2.

## 15. Unknown or Unverified Areas

- Official product name, formal problem statement, acceptance criteria and intended stakeholder/respondent groups.
- Whether the system is deployed/live; hosting architecture, operational environment, browser/device support and production configuration.
- Actual user accounts, custom access-role assignments, permission grants and screen usage by role.
- Which frontend legacy routes are still actively used versus compatibility paths.
- Real email, geolocation, supplier lookup and any payment provider configuration.
- Whether offline POS helper implements a complete supported offline workflow.
- Production backup/restore, monitoring/log retention, privacy/data-retention policies and operational support procedures.
- Runtime correctness, accessibility, usability, response time, compatibility, reliability, security posture, and user satisfaction.
- Exact meaning/appropriateness of report and forecasting metrics for café stakeholders.

## 16. Evidence Summary

Primary implementation evidence reviewed: `ims-frontend/package.json`; `ims-frontend/src/app`; `ims-frontend/src/features`; `ims-frontend/src/lib/routing/routes.ts`; `ims-frontend/src/lib/routing/route-policy.ts`; `ims-backend/package.json`; `ims-backend/src/app.module.ts`; `ims-backend/src/main.ts`; backend controllers/services/DTOs under `auth`, `catalog`, `inventory`, `stock-runs`, `orders`, `reports`, `alerts`, `forecasting`, `users`, `roles`, `settings`, `availability`, `events`, and `recipes`; `ims-backend/src/auth/rbac/permission-catalog.ts`; `ims-backend/prisma/schema.prisma`.

Repository reports and SQL dumps were treated as supporting context only; current source code and schema were the primary basis. Review was static and read-only. No database was connected and no application was run. No questionnaire items were drafted.
