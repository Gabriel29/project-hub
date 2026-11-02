# Dokploy operations

## Production configuration

- Project: `projecthub` (replace with your Dokploy project).
- Environment: `production`.
- Compose application: `projecthub` (replace with your application name).
- Repository: `your-organization/projecthub`, branch `main`; connect your GitHub App.
- Compose file: `compose.dokploy.yml`, repository root build context.
- Example HTTPS origin: https://portal.example.com, service `web`, container port **80**.
- Persistent volumes: `postgres-data` at `/var/lib/postgresql` and
  `seaweedfs-data` at `/data`; actual volume names depend on your deployment.

These are template placeholders. Configure your own domain, repository, resource
IDs, credentials and proxy settings before deploying.

Do not combine the production file with development `compose.yml`. The production
stack contains `web`, `postgres`, and `storage`. PostgreSQL and SeaweedFS have no
published host ports; the backend network is internal. Dokploy adds its isolated
routing network. The web process runs as non-root with the existing port-80
sysctl and waits for PostgreSQL and storage readiness.

Set private `POSTGRES_PASSWORD`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and
`BOOTSTRAP_TOKEN` values in Dokploy Environment. `.env.production.example`
documents configuration without real credentials. `PUBLIC_ORIGIN` and explicit
`PORTAL_ALLOWED_HOSTS` are required. Trust only the actual routing proxy IP or
network using `TRUSTED_PROXIES` or `TRUSTED_PROXY_NETWORKS`.
`STORAGE_DELETION_TIMEOUT_MINUTES` defaults to 90.

## SeaweedFS rollout

The repository now uses SeaweedFS; this change has not been deployed. Before
rollout, set the new AWS credential variables in Dokploy, copy existing S3 objects
with identical keys, verify them, and then switch services. The new volume name
prevents reuse of the incompatible MinIO on-disk format. Do not delete old data
until migration is verified. See [storage](storage.md).

## Fresh production deployment (19 October 2026)

The user explicitly requested removal of the production adoption migration and
all database upgrade compatibility code, deletion of the old Dokploy deployment,
and erasure of the production database and uploaded files. The replacement uses
new credentials and empty PostgreSQL and storage volumes. Owner setup is required
again; no accounts, projects or files are seeded. The owner setup key is available
in the private Dokploy Environment.

Only `0001_InitialIdentitySchema.sql` and `0002_InitialProjectHubSchema.sql` remain.
There is no legacy upgrade switch. Startup rejects unsupported histories and never
resets data automatically. The former installation's same-volume recovery copies
are also removed when its PostgreSQL volume is deleted. Future resets require a
new explicit user request; normal deployments must preserve volumes.

## Validation and recovery

Run the backend suite against disposable local PostgreSQL before rollout. It
verifies fresh/repeated/concurrent initialization, SQL failure rollback, immutable
migration history, mapped-table access and application workflows. Validate Compose
with `docker compose -f compose.dokploy.yml config --quiet` using private production
variables, and build the production image.

After deployment, verify the deployed commit, healthy containers, storage
verification logs, HTTPS `/health`, login/static assets and unauthenticated API
behavior. For a fresh installation, `/api/auth/setup-status` must report setup
required. Do not create a test Owner in production.

Before future schema changes, back up PostgreSQL and object storage together.
Volumes alone are not backups. Keep immutable migration files and append schema
changes; never reuse an incompatible database or silently rewrite its journal.

## Local development

Run `docker compose up --build`, then open http://localhost:5173. Development
services expose ports only on loopback. PostgreSQL and storage readiness gate API
startup. Vite proxies `/api` to the API container.

For host-based development, start only `postgres storage`, export the values from
`.env.example`, then run the API and Vite on the host. The private `.env` is not
automatically loaded by `dotnet run`.
