# Load balancing and scaling

This is a Docker Compose deployment for a single Linux host. Nginx distributes
traffic across two API and two Next.js replicas by active connection count,
refreshes Docker DNS every five seconds as replicas change, and passively skips
failing upstreams. One separate backend process owns scheduled jobs. PostgreSQL
remains your existing shared database; this configuration never creates or
replaces a production database.

Docker is not installed in the current local workspace, so container builds and
network failover have not been run locally. The GitHub `Scaling deployment
validation` workflow builds the images, replays migrations in a disposable
database, boots replicas, checks Nginx syntax, and checks distribution before and
after adding a third API instance. Its first successful run is required before
using this setup live. Existing CI failures remain release blockers.

## Start a staging installation

Install Docker Engine and current Docker Compose v2 on your host. From the
repository root in PowerShell:

```powershell
Copy-Item deploy/.env.example deploy/.env
```

Edit `deploy/.env` with the staging database, shared session/reset secrets, and
origins. For local HTTP testing use `http://localhost:8080` for both frontend
origins and `AUTH_COOKIE_SECURE=false`. For a domain behind HTTPS use its HTTPS
origin and `AUTH_COOKIE_SECURE=true`. Containers connect to a database hostname
reachable from Docker, not `localhost`. If using Docker Desktop to reach a host
database, use `host.docker.internal` and configure PostgreSQL access accordingly.
Choose a non-overlapping `NETWORK_SUBNET` if the default conflicts with your host.

```powershell
docker compose --env-file deploy/.env -f deploy/compose.yml config --quiet
docker compose --env-file deploy/.env -f deploy/compose.yml build api web
# After testing pending migrations on a restored backup and reviewing the SQL:
docker compose --env-file deploy/.env -f deploy/compose.yml run --rm migrate
docker compose --env-file deploy/.env -f deploy/compose.yml up -d --wait
python scripts/smoke-scaling.py --url http://localhost:8080
```

The `migrate` service is an explicit one-shot command. It is not run at replica
startup. Do not run initial migrations blindly against an unbaselined live DB;
follow [the live update procedure](ci-cd.md). Build all web replicas from the same
image so they share a Next.js build ID and Server Action encryption key.

## Add capacity

```powershell
docker compose --env-file deploy/.env -f deploy/compose.yml up -d --wait --scale api=4 --scale web=3
# Allow at least five seconds for Nginx's DNS refresh.
python scripts/smoke-scaling.py --url http://localhost:8080 --min-api-instances 4
docker compose --env-file deploy/.env -f deploy/compose.yml ps
docker compose --env-file deploy/.env -f deploy/compose.yml logs --tail=100 edge api worker
```

Include `--scale` values in later update commands to retain your chosen replica
count, or edit `deploy.replicas` in Compose. Do not scale `worker`: forecasting,
expiry snapshots, alerts, and outbox schedules have one owner. The forecasting
scheduler now respects `ENABLE_BACKGROUND_JOBS=false` on API replicas. Manually
requested forecasts still execute in an API child process; this is not a
distributed job queue.

Sessions live in PostgreSQL and all replicas use the same secrets, so API sticky
sessions are unnecessary. Uploads, forecast progress and trained models use shared
named volumes. Never use `docker compose down --volumes` on this installation:
it removes persistent files. To move an existing installation, copy its uploaded
files into the named volumes and preserve ownership for the container's `node`
user (UID 1000). Back up those volumes as well as the database. Generated historic
CSV data is excluded from images; production forecasting uses covered POS days.

## Ingress and shared limits

Only Nginx publishes a host port, bound to `127.0.0.1:8080` by default. Front it
with a host HTTPS reverse proxy or an authenticated tunnel. Backend/web ports
are private. Keep the Docker network limited to trusted app containers: the API
trusts forwarding headers from this subnet. Nginx replaces incoming forwarding
headers and preserves the browser's Origin for CSRF checks.

With a host reverse proxy, Nginx initially sees that proxy's address, so clients
share an IP budget. Before public rollout, configure Nginx `set_real_ip_from` for
the exact upstream proxy CIDRs and `real_ip_header X-Forwarded-For` (or the CDN's
documented header). Ensure that proxy replaces untrusted headers. Do not trust
all addresses. TLS terminates at the outer proxy; requests to this edge use HTTP.
If enabling Server Actions or proxy-aware HTTPS redirects, also propagate the
scheme from a verified trusted TLS ingress instead of Nginx's internal `$scheme`.

Nginx's shared memory limits apply across all API replicas: client burst and
sustained budgets, global request and per-IP connection limits, plus separate
login/reset budgets. HTTP 429 responses include retry guidance. These are leaky
bucket limits, not the identical token/fixed-window limits inside the API.
Tune `deploy/nginx.conf` for actual traffic and shared cafe public IPs. Changing
the number of API replicas does not multiply the edge budgets. They reset on
edge restart and are local to this single edge; multiple ingress hosts need a
shared rate-limit service. Upstream per-process API limits remain defense in depth.
Requests served directly from a CDN do not enter these edge budgets.

The Compose health checks verify database readiness before initial ingress
startup. Nginx uses passive failure detection at runtime, not active readiness
polling. Docker restart policies restart exited processes, not merely unhealthy
ones. Monitor unhealthy containers and replace them through your host platform.
Nginx never enables retries of already-sent non-idempotent writes. Its 120-second
read timeout is suitable for normal API calls; use job status polling for long
work rather than holding a transaction request open.

## Capacity and production updates

Start with a small PostgreSQL pool (`connection_limit=5` in the example URL).
Budget total connections as `(API replicas + worker) × pool size`, plus migration,
admin, and other connections. More replicas cannot speed up a saturated database
or create additional host CPU/RAM. Watch API p95 latency, CPU/RAM, connection pool
waits, database query times, 5xx/429 rates, and worker duration. Test representative
login/POS/report traffic on staging with separate test accounts and data before
claiming a user capacity. The provided smoke check tests distribution, not load
capacity or transaction correctness.

Tag images with the checked commit (`RELEASE_TAG`) and keep the prior images for
rollback. Deploy compatible migrations once before switching application images.
Compose updates are not guaranteed zero-downtime rolling updates: use a second
Compose project and switch the outer ingress for a blue/green release. That
requires shared external upload/model volumes and exactly one active worker
across projects. Do not start two workers during the switchover.

For automatic replica scaling and resilience across machines, migrate these
images to the chosen host's orchestration platform. It must add readiness-based
routing, autoscaling policies, shared object storage or distributed filesystems,
distributed scheduler ownership, and shared ingress limits. This Compose setup
provides manual scaling and process redundancy on one host; that host, edge and
database remain potential single points of failure.

References: [Docker Compose networking](https://docs.docker.com/compose/how-tos/networking/),
[Nginx upstreams](https://nginx.org/en/docs/http/ngx_http_upstream_module.html),
[Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting).
