# System test results — September 11, 2026

## Assessment

The system builds successfully and all 132 existing automated tests pass. PostgreSQL is reachable and migration history is current. Basic HTTP checks pass when the backend is launched using its actual compiled entry point. Production startup configuration and code quality checks need attention. These results do not establish that every business workflow works end to end.

## Framework and data flow

Browser → Next.js 16.2.1 / React 19.2.4 / TypeScript → NestJS 11 API → Prisma 6 / PostgreSQL.

The frontend also uses Bootstrap, Tailwind CSS, Zustand, and Leaflet. NestJS modules cover authentication, users, catalog, recipes, inventory, stock runs, orders, availability, events, reports, alerts, settings, and forecasting. The backend launches Python workers for SARIMA forecasting and store availability searches. Forecasting incorporates historical CSV data and completed POS ingredient usage; results are persisted in PostgreSQL. Store search integrates external providers.

## Executed checks

| Check | Result |
| --- | --- |
| Backend `npm.cmd test -- --runInBand` | PASS: 52 tests, 11 suites |
| Backend `npm.cmd run test:e2e -- --runInBand` | PASS: 40 tests, 1 suite; Prisma mocked |
| Python forecasting unittest discovery | PASS: 10 tests |
| Python store recommendation unittest discovery | PASS: 30 tests |
| Frontend `npm.cmd run build` | PASS, including TypeScript and page generation |
| Backend `npm.cmd run build` | PASS |
| Frontend `npm.cmd run lint` | 0 errors, 21 warnings |
| Backend ESLint without `--fix` | FAIL: 272 errors, 16 warnings |
| Prisma `migrate status` | PASS: PostgreSQL reachable; 16 migrations, schema up to date |
| Frontend `GET /login` | PASS: HTTP 200 |
| Backend `GET /auth/me` without session | PASS: HTTP 401 |
| Backend `GET /forecasting/products` without session | PASS: HTTP 401 |
| Backend `GET /` | HTTP 404; root controller is not registered in AppModule, so this is not a health endpoint |

## Findings

1. Backend production startup script uses `node dist/main`, but this build emits `dist/src/main.js`. Attempting the former entry point failed with MODULE_NOT_FOUND. Launching the actual emitted entry point allowed the API smoke checks to run.
2. Backend lint errors include unsafe `any` usage, unused variables, async methods without await, and formatting. ESLint reports 170 errors as potentially auto-fixable. No automatic fixes were applied.
3. Frontend warnings include missing React Hook dependencies and unused imports/variables.
4. Prisma warns that the package.json Prisma configuration is deprecated for a future major version.

## Scope and limits

The API integration suite exercises authentication, authorization, CSRF protection, settings, and user management with a mocked database. Backend unit suites cover additional inventory, catalog, event, alert, forecasting, and store-service behavior. Python tests exercise forecasting history/bridge and store logic; some recommendation tests deliberately exercise provider fallback.

No authenticated browser journey, real checkout/refund, real provider search, forecast accuracy evaluation, or load test was performed. No business transactions or migrations were submitted. Temporary servers were stopped after smoke checks; background jobs were disabled for these launches. Existing source changes were preserved. The report is the only intentionally added source artifact.
