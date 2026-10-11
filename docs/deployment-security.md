# Request flood protection

The backend applies an in-memory token bucket limiter before request body parsing,
static file serving, session checks, controllers, and database work. All paths and
HTTP methods (including OPTIONS and unknown routes) count. Rejected requests get
HTTP 429, a JSON error, and Retry-After in seconds. Existing login/password-reset
limits still apply.

Defaults per backend process:

| Environment variable | Default | Meaning |
| --- | ---: | --- |
| REQUEST_BURST_LIMIT | 30 | Per-client capacity and refill per second |
| REQUESTS_PER_MINUTE | 300 | Per-client capacity and refill per minute |
| REQUESTS_GLOBAL_PER_SECOND | 500 | Process-wide capacity and refill per second |
| REQUEST_RATE_LIMIT_MAX_CLIENTS | 10000 | Maximum tracked clients |

IPv4 clients share limits by address; IPv6 clients share limits by /64 subnet.
Clients behind a shared public IP share a budget. Tune the values for real POS
and dashboard traffic before release. The global cap includes rejected requests,
so a flood can temporarily throttle legitimate users too. At client capacity,
new clients receive 429; idle entries are reclaimed once a minute.

## Deployment requirements

- Use HTTPS through a reverse proxy or managed ingress. Restrict direct access to
  the backend port to that ingress.
- Set TRUST_PROXY to the actual proxy IPs/CIDRs, comma separated. Leave it empty
  for direct connections. Do not trust arbitrary forwarding headers or all IPs.
  Ensure the ingress replaces client-supplied forwarding headers. See
  [Express proxy guidance](https://expressjs.com/en/guide/behind-proxies/).
- Configure request, connection, body-size, and timeout limits at the ingress for
  both the Next.js frontend and backend. Enable the host/CDN's DDoS protection:
  application middleware cannot prevent network or connection exhaustion.
- With multiple backend replicas, enforce a shared rate limit at the ingress or
  use a shared atomic store. These local budgets multiply with replicas and reset
  on restart; they are not a cluster-wide limit.
- Confirm normal login, POS operations, dashboard polling, image loading, and
  browser preflight requests stay below limits in staging.

## Verification

From ims-backend run:

```powershell
npm test -- --runInBand src/security/request-rate-limit.spec.ts
npm run build
```

The regression test simulates 10,000 same-client requests at one instant: 30
reach downstream work and 9,970 receive 429. This is a deterministic budget test,
not a network throughput benchmark. It also verifies refill, sustained/global
limits, bounded storage, spoofed forwarding headers, early rejection of invalid
JSON, and IPv6 subnet grouping. Perform network load testing only against staging.
