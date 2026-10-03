# Phase 2B — Forecasting Authorization Reconciliation

## Changed files

- `ims-backend/src/forecasting/forecasting.controller.ts`: moved authorization to individual handlers.
- `ims-backend/src/forecasting/forecasting-authorization.spec.ts`: added targeted HTTP authorization coverage.
- This report.

## Old policy

All four endpoints inherited `@Roles(Role.ADMINISTRATOR)`. Read access did not enforce `forecasting.view`, so non-Administrators with that grant were denied and Administrators without it were admitted.

## New policy

| Endpoint | Required policy |
| --- | --- |
| GET `/forecasting/products` | `forecasting.view` |
| GET `/forecasting/latest` | `forecasting.view` |
| GET `/forecasting/runs/:id` | `forecasting.view` |
| PUT `/forecasting/settings` | Legacy Administrator |

Removed the class-level role decorator. Each read now declares its permission; the settings handler declares the existing Administrator role requirement. Every endpoint still requires authentication. No endpoint has mixed role/permission metadata or session-only authorization. No write permission was created.

Frontend policy already matches: the forecasting route requires `forecasting.view`, while the settings form checks Administrator role. No frontend change was necessary.

## Tests/results

**VERIFIED:** 15 new forecasting tests and 16 existing RBAC tests passed (31 total). HTTP tests use the real controller, validation pipe, session/permission/role guards, and permission resolver, with mocked session persistence, database reads, and forecasting service calls.

Coverage includes missing/invalid sessions; all three legacy roles with and without `forecasting.view` across all four endpoints; no-grant read denial; action denial for non-Administrators even with the read grant; Administrator settings access without grants; exact endpoint/policy metadata; unrelated grants; read-grant revocation; and unchanged argument forwarding/settings validation.

Commands run from `ims-backend`:

```text
node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath src/forecasting/forecasting-authorization.spec.ts src/auth/rbac/rbac.spec.ts
node node_modules/typescript/bin/tsc --project tsconfig.build.json --noEmit --incremental false
npm run build
node node_modules/eslint/bin/eslint.js src/forecasting/forecasting.controller.ts src/forecasting/forecasting-authorization.spec.ts
```

Production type check, build, and scoped non-mutating lint passed. The new spec was explicitly formatted with Prettier; no lint autofix was used. No full backend/frontend suite or all-files type check was run.

## Diff review

**VERIFIED:** `git diff --check` passed. Reviewed the scoped controller diff and new spec. Production edits consist only of one decorator import and handler-level authorization metadata. Calculations, service logic, browser routes, catalog, schema, roles/assignments, and other features are unchanged. Pre-existing Phase 2A Alerts edits and untracked reports were preserved.

## Risks/follow-up

Administrators lacking `forecasting.view` now receive 403 on reads, as required. They retain direct settings API access under the legacy policy, although the read-gated frontend page remains inaccessible without the read grant. No grants were changed. Tests do not exercise a live database or browser; forecasting calculations were outside this phase's scope.

## Readiness for Phase 2C

Phase 2B is complete within the requested scope and ready for review. Phase 2C can proceed under its own defined scope; no Phase 2C work was started.
