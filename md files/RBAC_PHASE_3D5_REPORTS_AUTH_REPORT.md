# RBAC Phase 3D-5 - Reports Authorization Report

## Pre-change endpoint mapping

Reviewed Phase 3D2, 3D3 and 3D4 reports, all Reports controller routes, services, DTOs, frontend callers and forecasting dependencies before modifying code. All routes below currently inherit Administrator-only Roles metadata and session authentication. All will require reports.view and retain session authentication.

| Endpoint | Consumer | Previous authority | New permission |
| --- | --- | --- | --- |
| GET /reports/sales-overview | Admin dashboard | Administrator | reports.view |
| GET /reports/variant-margin | API helper; no active UI caller found | Administrator | reports.view |
| GET /reports/waste-summary | Admin dashboard; inventory overview/insights | Administrator | reports.view |
| GET /reports/stock-run-spend | Admin dashboard; inventory overview/insights | Administrator | reports.view |
| GET /reports/inventory-health | Admin dashboard; inventory overview | Administrator | reports.view |
| GET /reports/inventory-kpi-summary | Inventory Reports workspace | Administrator | reports.view |
| GET /reports/inventory-availability-risk | Inventory Reports workspace | Administrator | reports.view |
| GET /reports/pos-dashboard | POS Reports workspace (pos-dashboard) | Administrator | reports.view |
| GET /reports/pos-transaction-history | POS Reports workspace (pos-transaction-history) | Administrator | reports.view |
| GET /reports/pos-sales-analytics | POS Reports workspace (pos-sales-analytics) | Administrator | reports.view |
| GET /reports/pos-payment-reports | POS Reports workspace (pos-payment-reports) | Administrator | reports.view |
| GET /reports/pos-refunds-voids | POS Reports workspace (pos-refunds-voids) | Administrator | reports.view |
| GET /reports/pos-product-performance | POS Reports workspace (pos-product-performance) | Administrator | reports.view |
| GET /reports/pos-staff-performance | POS Reports workspace (pos-staff-performance) | Administrator | reports.view |
| GET /reports/pos-peak-hours | POS Reports workspace (pos-peak-hours) | Administrator | reports.view |
| GET /reports/pos-inventory-linked | POS Reports workspace (pos-inventory-linked) | Administrator | reports.view |
| GET /reports/pos-audit-exceptions | POS Reports workspace (pos-audit-exceptions) | Administrator | reports.view |

## Dashboard and scope decisions

Decision B: report data keeps its separate reports.view requirement. dashboard.view permits the dashboard page, not report data. The four dashboard report requests and widgets already check reports.view. Dashboard-only users receive 403 from these report APIs; users with reports.view can access them without dashboard.view. No OR permission fallback or weaker gate is introduced. If a limited dashboard-only dataset is needed later, it should be a separately designed endpoint; none is created here.

InventoryWorkspace already gates report loading and widgets with reports.view. inventory.view and stockRuns.view do not imply report access. All pos-* routes above are reporting reads, not POS checkout/refund/void actions; those operational endpoints remain outside this phase. The order-detail drilldown uses /orders/:id, which also remains outside this phase with its existing authorization; custom Analysts may encounter that separate access boundary.

ReportsService depends internally on InventoryService, OrdersService and Prisma. These internal calls do not go through HTTP controller guards; no extra inventory/POS grant is imposed on reports. No ReportsService/report-API dependency was found in backend forecasting, whose controller/service remain unchanged. No separate backend report export endpoint exists: exports use frontend snapshot utilities. No reports.export permission is added.

## Implementation

Replaced ReportsController's class-level Roles(ADMINISTRATOR) with RequirePermission('reports.view'), covering all 17 GET handlers. Removed unused role imports. No handler overrides this permission. The global SessionAuthGuard -> PermissionsGuard -> RolesGuard chain and fresh permission resolution are unchanged. Unknown permission declarations are rejected and unknown database keys cannot authorize requests.

ReportsService, its internal InventoryService/OrdersService calls, all DTOs, query handling, aggregation, date filtering, timezone logic and response envelopes remain unchanged. This phase changes only authorization in production code.

## Frontend compatibility

Reports navigation and report routes use reports.view through the shared navigation/route gating configuration. Admin dashboard report calls and InventoryWorkspace insights explicitly check reports.view. POS Reports is a reporting workspace; its name does not imply operational pos.view authorization. No frontend code was changed. The variant-margin endpoint has an exported frontend API helper but no active component caller was found.

The existing order-detail drilldown retains Administrator/Staff authorization on /orders/:id. An Analyst on a legacy Manager identity can now retrieve report data but may still receive 403 on this operational drilldown until the later POS migration. No bypass was introduced to conceal this boundary.

## Tests and validation

Added reports-authorization.spec.ts with 130 tests using actual Nest HTTP routes, real session/permission/role guards and the real permission resolver, with mocked session validation, persistence and report services. Tests cover every report route for granted Administrator, custom Analyst, missing grants (403), missing session (401), legacy Administrator without grants, unrelated dashboard/inventory/stock-run/POS grants, and unknown database permission keys. They also verify full handler coverage, class/handler policy consistency, unknown declaration rejection, catalog parity, revocation, invalid sessions, inactive identities, response envelopes, date/limit forwarding and invalid filter rejection.

Removed the obsolete Reports-remains-legacy assertion from the Inventory and Supplier authorization suites now that Reports has migrated. Their authorization coverage otherwise remains unchanged. Existing dashboard-hours tests remain unchanged and pass.

Validation from ims-backend:

- npx tsc --noEmit -p tsconfig.build.json: passed.
- Targeted Jest: reports-authorization, dashboard-hours, inventory-authorization, suppliers-authorization: 4 suites, 285 tests passed.
- Targeted ESLint on all four changed TypeScript files: passed.
- Targeted Prettier formatting and controller whitespace check: passed.

Tests do not exercise a live database or browser, and mocked report-service HTTP tests do not independently validate all aggregation calculations. No database writes, migrations or seed operations were performed.

## Files changed in this phase

- ims-backend/src/reports/reports.controller.ts
- ims-backend/src/reports/reports-authorization.spec.ts (new)
- ims-backend/src/inventory/inventory-authorization.spec.ts (obsolete boundary assertion removed)
- ims-backend/src/inventory/suppliers-authorization.spec.ts (obsolete boundary assertion removed)
- RBAC_PHASE_3D5_REPORTS_AUTH_REPORT.md (new)

Earlier uncommitted work was preserved; other repository changes predate this phase.

## Confirmations

| Area | Backend authorization migration status |
| --- | --- |
| Products | IMPLEMENTED |
| Inventory Materials | IMPLEMENTED |
| Stock Runs | IMPLEMENTED |
| Suppliers | IMPLEMENTED |
| Reports | IMPLEMENTED |
| POS | NOT IMPLEMENTED |
| Users | NOT IMPLEMENTED |
| Settings | NOT IMPLEMENTED |

Frontend changes: NONE in this phase.

Database changes: NONE in this phase.

Prisma, migrations, permission catalog, guards and business services: unchanged in this phase.

Stopped after Reports authorization migration.
