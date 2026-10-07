# Security hardening — October 8, 2026

Reviewed the NestJS backend SQL calls, session authentication, route permissions, cookie parsing, and browser API requests.

## Changes

- Existing application SQL uses Prisma ORM or bound tagged templates. A regression test passes an injection payload into the FEFO allocator and verifies it remains a bound value outside the SQL text. ESLint flags unsafe raw-query methods and Prisma.raw fragments.
- State-changing requests now require the exact configured FRONTEND_ORIGIN in Origin, or a matching Referer when Origin is absent. Missing, malformed, opaque, and foreign origins are denied, including public login/reset routes. Read requests and preflight requests remain allowed by this middleware; authentication and permission guards still apply.
- Client IPs come from Express rather than manually reading attacker-supplied X-Forwarded-For. Proxy trust defaults to disabled. Set TRUST_PROXY to a comma-separated list of trusted proxy IPs or CIDRs only if deployed behind a reverse proxy; ensure the proxy overwrites forwarded headers and direct access is restricted.
- Login attempts are limited per resolved IP (LOGIN_IP_MAX_ATTEMPTS, default 30 per PASSWORD_RESET_RATE_LIMIT_WINDOW_MINUTES, default 15 minutes), in addition to account lockout. The IP limiter is process-local and resets on restart. Multiple instances require a shared limiter or enforcement at the ingress.
- Malformed encoded cookies and duplicate session cookies fail authentication instead of throwing or choosing an ambiguous credential.
- API responses disable caching and include nosniff, frame denial, and a no-referrer policy. Express version advertising is disabled. Existing image routes retain their explicit immutable caching.
- Upload endpoints are included in authorization regression coverage. Settings password fixtures satisfy the current special-character requirement.

## Operation and limits

Restart or redeploy the backend to activate source changes. Browser API calls already send Origin on writes. Scripts and other API clients must explicitly send the configured Origin on POST/PUT/PATCH/DELETE; an Origin value does not replace authentication.

For production, use HTTPS and secure session cookies, keep secrets out of source control, restrict database privileges, and maintain dependency updates. This review is not a full penetration test or an assurance that all attacks are prevented. Database roles, deployed proxy/firewall settings, dependency advisories, and all frontend rendering paths were not comprehensively audited.

References: [Prisma parameterized SQL](https://docs.prisma.io/docs/orm/v6/prisma-client/using-raw-sql/typedsql), [Express proxy trust](https://expressjs.com/en/guide/behind-proxies/).
