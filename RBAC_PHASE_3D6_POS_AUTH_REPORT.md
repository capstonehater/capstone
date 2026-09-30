# RBAC Phase 3D-6 - POS Authorization Report

## Pre-change mapping

Reviewed Phase 3D5 report, OrdersController, CatalogController, checkout/refund DTOs and service, frontend POS/history/report callers, offline queue and seed grants before changing code.

| Endpoint | Purpose | Previous authority | New permission |
| --- | --- | --- | --- |
| GET /pos/menu | POS workspace menu | Session only | pos.view |
| POST /pos/checkout | Checkout/payment, including offline sync/retry | Session only | pos.checkout |
| GET /orders | Operational transaction history | Administrator/Staff + session | pos.orders.view |
| GET /orders/:id | Receipt/order detail, also report drilldown | Administrator/Staff + session | pos.orders.view |
| POST /orders/:id/refund | Refund transaction | Administrator/Staff + session | pos.refund |

No separate POS configuration, payment, queue synchronization or completed-order void endpoint exists. Refund approval additionally requires existing Administrator credentials inside OrdersService; that business rule remains unchanged. No void route is added. Report analytics retain reports.view. Product reads retain products.view; shared categories and variant availability remain session-only.

## Offline and compatibility decisions

StaffPOSPage checks pos.checkout before confirming/queueing a new checkout, before sync, and before each queued entry. Sync and retries call POST /pos/checkout with the original idempotencyKey. Backend permission resolution precedes service execution, including idempotent replay. Revoked grants therefore block queued/retried requests before order/payment/inventory work. Frontend checks use cached grants: an offline client cannot learn server-side revocation immediately, and network-error fallback queueing can occur after its earlier client check. Local pending records are not authorized server transactions; current backend grants are always required to sync. No frontend or offline synchronization logic is changed. Rejected sync entries retain the existing FAILED/retry behavior.

Seeded Staff has pos.view, pos.checkout, pos.orders.view and pos.refund. Seeded Manager has only pos.view and pos.checkout. Administrator has all catalog grants. Legacy labels alone no longer authorize POS operations. Permissions do not imply each other: cashier checkout does not grant history/refund; menu-only cannot checkout. Order detail report drilldowns now require pos.orders.view independently of reports.view.

## Implementation and preserved behavior

OrdersController now applies pos.checkout, pos.orders.view and pos.refund per handler, removing the conflicting Roles metadata. CatalogController.getPosMenu now requires pos.view. The global SessionAuthGuard, PermissionsGuard, RolesGuard and permission resolver remain unchanged. There is no role OR permission fallback.

Only these five operational handlers changed authorization. Order creation, payment processing, refund approval and restrictions, transaction creation, inventory deduction/restoration, idempotency handling, audit logging, DTOs and offline synchronization logic remain unchanged. OrdersService is untouched. Permission to request a refund does not replace its separate privileged approval business rule.

## Frontend compatibility

Read-only inspection confirmed pos.view navigation/workspace gating, pos.checkout payment controls and confirmation/sync checks, pos.orders.view transaction-history routing, and pos.refund reversal controls and submission checks. The low-level offline storage helper stores local data; the POS action handler supplies the client permission check. Backend authority does not depend on those client checks. No frontend code was modified.

Reports analytics continue using reports.view. An Analyst now needs pos.orders.view to open the existing operational order-detail drilldown; reports.view alone intentionally does not grant it. Shared catalog reads were not migrated to POS permissions.

## Tests and validation

Added src/orders/pos-authorization.spec.ts using actual Nest HTTP routes, real session/permission/role guards and the real permission resolver with mocked session validation, persistence and business services. Covers all five endpoint policies, full Orders handler coverage, Administrator and custom-role exact grants, missing grants (403), missing sessions (401), legacy Administrator denial without grants, seeded Staff compatibility, all four isolated capability boundaries, report-vs-operational separation, actor attribution, inactive/invalid identities, unknown grants and catalog parity.

The offline/retry test sends the same checkout payload/idempotency key after revocation and verifies both retries return 403 without calling checkout again. Each operational endpoint also has a next-request revocation test. Frontend pre-queue and per-entry sync checks were source-audited, not browser-tested. The HTTP harness mocks business services and does not exercise DTO validation or live payment/inventory operations.

Updated the Products authorization suite to remove /pos/menu from its session-only read cases; the new POS suite now covers that endpoint. Existing shared category/availability cases remain. Existing refund regression and Reports authorization tests pass unchanged.

Validation from ims-backend:

- npx tsc --noEmit -p tsconfig.build.json: passed.
- Jest: pos-authorization, orders.refund, products-authorization and reports-authorization: 4 suites, 300 tests passed.
- Targeted ESLint on both controllers and both changed authorization test files: passed.
- Targeted formatting and controller diff whitespace checks: passed.

No live database mutation, payment processing, seed operation, migration or browser/offline end-to-end test was performed. These tests establish authorization boundaries, not new idempotency, concurrency or refund guarantees.

## Files changed in this phase

- ims-backend/src/orders/orders.controller.ts
- ims-backend/src/catalog/catalog.controller.ts (POS menu handler only)
- ims-backend/src/orders/pos-authorization.spec.ts (new)
- ims-backend/src/catalog/products-authorization.spec.ts (obsolete session-only menu case removed)
- RBAC_PHASE_3D6_POS_AUTH_REPORT.md (new)

Prior uncommitted work was preserved. Other repository changes belong to earlier phases.

## Confirmations

| Area | Backend authorization migration status |
| --- | --- |
| Products | IMPLEMENTED |
| Inventory Materials | IMPLEMENTED |
| Stock Runs | IMPLEMENTED |
| Suppliers | IMPLEMENTED |
| Reports | IMPLEMENTED |
| POS | IMPLEMENTED |
| Users | NOT IMPLEMENTED |
| Settings | NOT IMPLEMENTED |

Frontend changes: NONE in this phase.

Database changes: NONE in this phase.

Prisma, migrations, permission catalog, services and guards: unchanged in this phase.

Stopped after POS authorization migration.
