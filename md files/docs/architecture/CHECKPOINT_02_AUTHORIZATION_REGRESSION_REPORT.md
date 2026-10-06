# Checkpoint 2 — Authorization Regression Review

## Scope

Reviewed the combined uncommitted Phase 2 Alerts, forecasting, and geolocation security changes against the Phase 2A, 2B, and 2D reports. No repository-wide audit or unrelated feature suite was run.

## Tests/results

| Check | Result |
| --- | --- |
| Alerts authorization + forecasting authorization + RBAC + auth-permissions interceptor | 4 suites, 100 tests passed |
| Geolocation + frontend auth store/permissions | 63 tests passed (28 geolocation, 35 frontend); no TODOs |
| Backend production typecheck and build | Passed |
| Frontend typecheck and production build | Passed; `/api/geolocation` emitted as dynamic |
| `git diff --check` | Passed |

Commands: backend Jest with `--runInBand --no-cache --runTestsByPath` targeting `src/alerts/alerts-authorization.spec.ts`, `src/forecasting/forecasting-authorization.spec.ts`, `src/auth/rbac/rbac.spec.ts`, and `src/auth/auth-permissions.interceptor.spec.ts`; frontend `node --test --test-isolation=none tests/geolocation.test.cjs tests/authStore.test.cjs tests/permissions.test.cjs`; backend `tsc --project tsconfig.build.json --noEmit --incremental false`; frontend `tsc --noEmit --incremental false`; `npm run build` in both projects.

The controller tests exercise real global guards and the permission resolver with mocked persistence/business services. Geolocation tests mock backend/provider responses. These checks do not constitute a live cross-service deployment smoke test.

## Combined diff review

Only three tracked production files differ: AlertsController, ForecastingController, and the Next geolocation handler. New scoped tests and reports accompany them. No shared guard/resolver, permission catalog, database/schema/migration, browser route, or unrelated production change exists in the combined diff. The LocationIQ response transformation remains unchanged. Existing unrelated untracked reports were preserved. Phase 2D's local `.env.example` notes are Git-ignored; deployment requirements are retained in tracked report content when committed.

## Security findings

- Alerts: reads require `alerts.view`; acknowledge requires only `alerts.acknowledge`; dismiss requires only `alerts.dismiss`.
- Forecasting: all reads require `forecasting.view`; settings writes retain explicit legacy Administrator policy.
- Geolocation: authoritative `/auth/me` validation precedes provider access. Missing/invalid/revoked sessions and unavailable/error validation deny access without a provider call. Only the intended cookie is forwarded; validation is uncached and redirects are refused.
- No new permission keys, Administrator bypass, public override, or mixed role/permission metadata was introduced. Every scoped Nest handler declares its intended policy. Shared global guard order remains session, permission, then role.

No demonstrated shared auth/RBAC regression required a code fix.

## Deployment caveats

Cookie names align: Nest's configured name is `ims_session`; Next uses that same default unless `SESSION_COOKIE_NAME` is set. The inspected local backend uses non-secure, SameSite=Lax cookies with no explicit domain; cookie availability therefore depends on the browser host. Same-host ports can share cookies, but separate API/Next hostnames do not automatically share a host-only cookie.

The local frontend explicitly configures `NEXT_PUBLIC_API_BASE_URL` as `http://localhost:4000`. This is environment configuration, not a hardcoded destination or fallback in the new bridge. Production must supply a trusted backend URL reachable from the Next runtime; Next public environment configuration must be correct for the build/deployment. Missing configuration denies access. Use HTTPS across untrusted networks.

Confirm actual cookie delivery, cookie-name alignment, and server-to-server `/auth/me` reachability in the deployment smoke test. Separate-host deployments whose cookie never reaches Next will fail closed. No cookie scope or environment values were changed during this review.

## PASS / FIX verdict

**PASS — scoped authorization regression checkpoint.** All requested checks passed. No production fixes were needed. Deployment smoke verification remains outstanding and is not included in this PASS.

## Readiness for Phase 3

Ready to begin separately scoped Phase 3 work. Complete deployment cookie/session smoke verification before treating Phase 2 as production-validated.
