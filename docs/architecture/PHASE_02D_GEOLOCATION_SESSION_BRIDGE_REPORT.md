# Phase 2D — Geolocation Session Validation Bridge

## Changed files

- `ims-frontend/src/app/api/geolocation/route.ts`: authoritative session validation before existing lookup logic.
- `ims-frontend/.env.example`: local cookie-name alignment and backend reachability notes (ignored by Git; deployment requirements are also recorded below).
- `ims-frontend/tests/geolocation.test.cjs`: replaced Phase 2C characterization/TODO cases with enforcement tests.
- This report.

## Authentication flow

The handler extracts exactly one cookie named by server-side `SESSION_COOKIE_NAME` (default `ims_session`, matching Nest). It forwards only that encoded credential to `${NEXT_PUBLIC_API_BASE_URL}/auth/me`; no caller authorization, permissions, host, or unrelated cookies are forwarded. The destination comes exclusively from deployment configuration, preserves a configured API path prefix, and has no localhost fallback.

Nest's existing SessionAuthGuard validates the session through SessionService. Inspection confirmed checks for missing/revoked/expired sessions, inactive users, and password changes. Only a 200 response containing a nonempty user ID permits the original geolocation logic. No permission or frontend auth state is consulted.

Authentication fetches use `cache: no-store`, a five-second timeout, and `redirect: error`. The route is force-dynamic and all returned responses use `Cache-Control: private, no-store`. Each request validates anew.

## Fail-closed behavior

Missing, empty, malformed, or duplicate session credentials receive 401. Backend 401/403 responses map to 401. Missing/invalid backend configuration, other backend statuses, malformed success responses, network failures, timeouts, and redirects deny with 503. Denied requests never reach LocationIQ. Authentication precedes input validation; authenticated invalid geographic input still receives the existing 400 response without a provider call.

## Tests/results

**28 targeted tests passed, no TODOs.** Coverage includes missing/arbitrary credentials, backend invalid-session rejection, next-request revocation, unavailable/error validation, malformed backend output, custom cookie names, credential-only forwarding, configured path prefixes, no-cache/redirect options, authenticated search/reverse behavior, and invalid inputs. Network/timeout/redirect failures are mocked; no live backend or provider was contacted.

Commands from `ims-frontend`:

```text
node --test --test-isolation=none tests/geolocation.test.cjs
node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target ES2017 --lib dom,dom.iterable,esnext --module esnext --moduleResolution bundler src/app/api/geolocation/route.ts
node node_modules/eslint/bin/eslint.js src/app/api/geolocation/route.ts tests/geolocation.test.cjs
```

All passed. Type checking was restricted to the changed production handler. No full frontend/backend suite, build, or mutating lint ran.

## Diff review

`git diff --check` passed. Scoped review confirmed the existing LocationIQ lookup body and response transformation are unchanged; it is now called only after validation. No supplier logic, browser routes, backend implementation, catalog, schema, Alerts, or forecasting changes were made in this phase. Earlier uncommitted phase changes remain intact.

## Risks

The session cookie must reach the Next host, its configured name must match Nest, and `NEXT_PUBLIC_API_BASE_URL` must be trusted and reachable from Next. A host-only cookie on a separate API hostname will not arrive at Next: that topology now denies access until cookie delivery is deliberately configured. Cookie scope was not broadened automatically. Use HTTPS when credentials cross untrusted networks; HTTP remains supported for existing local/private deployment conventions.

Each lookup adds an authoritative auth request and inherits the existing validator's idle-session refresh behavior. Backend outages deny lookup access. Live deployment cookie delivery and backend reachability require a smoke test. Authenticated-only access does not introduce provider rate limiting.

## Readiness for Checkpoint 2

The Phase 2C authentication gap is closed in code with targeted enforcement coverage. Ready for Checkpoint 2 review, with deployment smoke verification outstanding. No broader production-readiness claim is made.
