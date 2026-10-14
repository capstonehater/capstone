# Backend read caching

The global `ReadCacheModule` provides a process-local, bounded LRU cache for
opted-in JSON GET routes. It is enabled by default and requires no new service.
Categories and product lists expire after 30 seconds; reports expire after
10 seconds. Authentication, permission/export checks, live POS menus, variant
availability, checkout, and inventory operations are not cached.

Session and permission guards run on every request before the interceptor.
Keys include the authenticated user, controller, handler, and full URL including
query filters. Values use JSON serialization (including Prisma Decimal and Date
wire representations), and each hit returns a fresh object. Errors, non-200
responses, responses setting cookies, and oversized values are not stored.
Browser responses retain `Cache-Control: no-store`; this is server-side caching.

Every mutating HTTP request that reaches a handler clears this process's cache
before and after execution, including failed requests. Reads bypass caching
while writes are active. A generation check prevents an older in-flight read
from repopulating the cache after invalidation. This is deliberately broad
invalidation; it favors freshness over maximizing the hit rate.

## Configuration

Set these in the backend environment and restart to apply changes:

| Variable | Default | Meaning |
| --- | --- | --- |
| `READ_CACHE_ENABLED` | `true` | Set `false` to bypass caching |
| `READ_CACHE_MAX_ENTRIES` | `1000` | Maximum cached entries per process |
| `READ_CACHE_MAX_BYTES` | `16777216` | Maximum stored JSON and key bytes per process |
| `READ_CACHE_MAX_ENTRY_BYTES` | `524288` | Maximum bytes per stored result |

The byte budget bounds stored payloads; JavaScript object overhead and temporary
serialization allocations add to actual memory use. Expired records are removed
on access or insertion. LRU eviction prevents unbounded accumulation; no timers
or persistent cache files are created. Restarting produces a cold cache.

## Multiple instances and background jobs

Each backend replica has an independent cache. Mutations on another replica,
background jobs, and direct database changes become visible when a cached entry
expires: up to 30 seconds for catalog lists and 10 seconds for reports. Cache
reads are not a transactional consistency guarantee. Disable caching if those
windows are unacceptable. For immediate invalidation across replicas, replace
the store with shared Redis plus a shared generation/invalidation mechanism;
do not merely share values while retaining local invalidation.

Use `@CacheRead(ttlMs)` on additional handlers only after checking user scope,
response serialization, absence of response side effects, and acceptable
staleness from out-of-band writes or time-dependent calculations. A value of
zero overrides a controller policy. Services doing non-HTTP writes may inject
`ReadCacheService` and call `invalidate()` for local invalidation.

## Validation and operations

Run `npm test -- --runInBand src/cache` and
`npx tsc --project tsconfig.build.json --noEmit --incremental false`. Tests cover expiry, isolation, memory
limits, invalidation races, overlapping writes, response bypass behavior, and
session/permission checks on warm-cache HTTP requests.
Compare request latency and database load under representative repeated reads
before adjusting TTLs or limits. This change reduces repeated reads; it does
not replace indexes, backups, retention policies, or capacity planning.
