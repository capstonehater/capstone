# CI/CD preparation

Hosting is still undecided. The repository now checks updates and produces
versioned source release candidates. It does not connect to or restart a live
host. The host-specific deployment job must be added once hosting is selected.
For a Docker host, [the scaling setup](scaling.md) provides load-balanced images,
shared storage, a singleton scheduler, and a container smoke-test workflow.

## Branch and environment setup

The development branch is `feature/route-policy-centralization` (this is the
actual Git branch spelling). Pushes to it create a development candidate only
after all checks pass. Pull requests and pushes to other branches run checks.
Tests never receive live credentials.

In GitHub, create `development` and `production` environments. Restrict their
deployment branches. Choose a production branch and set the repository variable
`PRODUCTION_BRANCH` to its exact name. Require review for production where the
repository's GitHub plan supports environment protection rules. Configure branch
protection/rulesets to require the backend, frontend, Python, and migration checks
before merging. These settings are configured in GitHub, not by YAML alone.
See [GitHub deployment controls](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments).

Production candidate preparation is manual: Actions → CI and release preparation
→ Run workflow → select the configured production branch and `production`.
The workflow reruns checks on that exact commit before packaging. Nothing is
published or deployed to a host. Development and production candidates use
separate GitHub environments and serialized packaging jobs. Workflow dispatch
becomes available once the workflow exists on the repository's default branch.

## Checks

- Backend: Node 22, clean `npm ci`, Prisma generation/schema validation,
  non-mutating lint, Jest unit tests, mocked HTTP integration tests, and build.
- Migrations: replay committed Prisma migrations against a disposable PostgreSQL
  16 instance, then check migration status and compare the result to the Prisma
  schema. This does not validate drift in the
  existing live database or replace testing a migration on a restored backup.
- Frontend: Node 22, clean `npm ci`, lint, Node tests, and Next.js production build.
- Python: Python 3.12, declared requirements, forecast/store recommendation tests,
  and release packaging tests.

No failing checks are ignored. Initial local verification found 2 failing backend
unit tests (1,121 passing), 24 failing mocked HTTP integration tests (16 passing),
frontend test failures, and backend lint errors. These must be resolved before
a release candidate can pass. The backend build, 59 forecast tests, 39 store
recommendation tests, and 3 packaging tests passed locally. Linux CI, clean
installs, and migration replay still need a first GitHub run. Local runtime
versions can differ from CI.

## Release packages

Artifacts are named by environment and full Git commit SHA and retained for
30 days. The archive contains allowlisted committed application source, lockfiles,
schema/migrations, Python modules and catalog reference data, plus a manifest
with SHA256 hashes. A separate archive checksum is included. Working-tree edits,
environment files, database dumps, uploaded images, historical CSV datasets,
trained models, and dependencies are excluded. This is a source package, not
a prebuilt image; the chosen host must build it with its environment settings.
Catalog reference data is deliberately included and should be reviewed before
release. Runtime forecast history/models must be provisioned separately if used.

## Connecting the eventual host

Add a deployment job after successful checks/package creation. Use environment
secrets or OIDC for the selected host and deploy the exact checked SHA/artifact;
do not trigger an unqualified deployment of the latest branch head. Keep database,
session, SMTP, and third-party credentials separate for each environment. Public
Next.js values and rewrites are build-time configuration: build per target with
the correct `NEXT_PUBLIC_API_BASE_URL` and `API_UPSTREAM_URL`.

Release sequence for an existing live installation:

1. Stage the candidate in a new release directory or immutable image. Install
   Node dependencies from the lockfiles. The backend currently requires Prisma
   CLI and client packages in devDependencies, so build/migration phases need
   `npm ci --include=dev`, not a production-only install. Generate Prisma and
   build the backend and frontend. Install Python requirements in an isolated
   environment and set the Python executable paths in the backend environment.
2. Preserve the existing database and persistent runtime paths: backend
   `profile picture` and `product-images`, and any forecast model/history data.
   Mount or link these paths into each release; never replace them with package
   contents. Run backend commands from `ims-backend` so relative paths resolve.
3. Back up the live database and verify recovery. Confirm migration history and
   drift against a restored staging copy. If the live database predates Prisma
   migration tracking, baseline it deliberately; do not replay initial schema
   creation blindly. Review pending SQL, especially data transformations.
4. Apply committed migrations once using `npm run prisma:migrate:deploy` in
   `ims-backend`, with that environment's database credentials. This project uses
   Prisma 6. Never run `migrate dev`, `db push`, reset, or seed automatically on
   live updates. Use backward-compatible schema additions before switching code.
5. Start the candidate, verify readiness including database connectivity, then
   switch ingress traffic. Check login, permissions, POS, reports, uploads and
   rate-limit responses. Configure one scheduler owner when using replicas.
6. Record the commit, migration result, health checks, and deployment time. Keep
   the previous release available for application rollback. An application
   rollback does not undo database migrations; incompatible changes need an
   explicit recovery plan. Destructive column removal belongs in a later release
   after the rollback window closes.

The host adapter must implement health checks, traffic switching and rollback;
those operations cannot be configured accurately until a host is selected.
Read [deployment security](deployment-security.md) before enabling public traffic.

## Local checks for the pipeline utilities

```powershell
python -m unittest discover -s scripts/tests -p 'test_*.py'
```

Push the intended changes via a pull request to activate CI. Local uncommitted
work is not available to GitHub Actions and is never included by the packager.
