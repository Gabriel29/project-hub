# Operations

## Current deployment

The example production origin is https://portal.example.com. Replace it with your domain. See [Dokploy operations](dokploy.md) for deployment configuration placeholders.

## Object storage

The Compose configurations use the pinned `chrislusf/seaweedfs:4.48` image,
with its S3 endpoint on port 8333 and persistent storage under `/data`.
No custom storage image or Go build is required. Both the API and SeaweedFS use
`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. The application continues to
use the AWS S3 SDK and the private `projecthub-files` bucket.

See [storage](storage.md) for startup, authentication, persistence and migration.
Production remains on its existing storage until an explicit rollout migrates
objects and updates the Dokploy environment. Repository changes do not migrate
stored data or alter live services automatically.

## Database lifecycle

The October 16 local reset replaces all EF migrations with the PostgreSQL SQL baselines `0001_InitialIdentitySchema.sql` and `0002_InitialProjectHubSchema.sql`. The .NET runner executes embedded SQL through Npgsql and records checksums in `projecthub."__PostgresMigrations"`. EF is for data access only. No accounts or project data are seeded; startup creates only Owner/Admin/Client roles.

Use this baseline only with an empty database. Existing EF-managed installations are rejected and require an explicit SQL transition; this local reset does not authorize changing remote databases. Future schema changes must append PostgreSQL SQL scripts, with EF mappings updated separately. See [database migrations](database-migrations.md).

Milestones persist `StageComplete`. Project current stage and overall completion are derived from ordered milestones; no project stage/completion columns or synthetic milestone are stored.

## Owner setup

Open the portal setup screen and enter the new private bootstrap key, your name, email and chosen password. Passwords need six characters, a letter and a digit. Setup closes after the first Owner is created; the bootstrap key can then be removed from deployment variables. No production test account is created during deployment verification.

Create clients and deliver activation links through your existing channel. Activation links expire after seven days; password reset links after 24 hours. Links are single-use. No automatic email delivery is configured.

## Verification and backups

`/health` checks PostgreSQL. Storage verification runs before readiness. Backend integration tests create disposable local PostgreSQL databases and verify a clean baseline, mapped-table compatibility, repeat/concurrent SQL migration, transactional rollback, authentication and portal workflows. GitHub CI also builds the frontend and runs component/browser checks.

Back up both PostgreSQL and the storage volume; restoring only metadata cannot recover file bytes. Storage and database volumes are not redundant backups.

## Backend configuration and cleanup

Production requires PUBLIC_ORIGIN (HTTPS origin, no path), explicit AllowedHosts, DATABASE_URL and AWS_ENDPOINT_URL/AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/AWS_S3_BUCKET_NAME. For Dokploy, PORTAL_ALLOWED_HOSTS feeds AllowedHosts and includes localhost for internal health checks. Configure TRUSTED_PROXIES (semicolon-separated IP addresses) or TRUSTED_PROXY_NETWORKS (semicolon-separated CIDRs) using the actual routing network. Do not use 0.0.0.0/0 or ::/0. Existing loopback proxy defaults remain. Verify external scheme/client IP after changing routing. Unsupported URL-style database query parameters fail configuration; use a full Npgsql connection string for advanced options. Secrets are not logged.

The fresh business baseline (0002_InitialProjectHubSchema.sql) includes StorageDeletions; there is no separate cleanup migration. This user-authorized consolidation requires an empty database; existing histories are rejected rather than reset. Metadata deletion and cleanup jobs commit together; StorageCleanupWorker polls every 15 seconds, processes at most 20 jobs per batch, times out each deletion after `STORAGE_DELETION_TIMEOUT_MINUTES` (default: 90 minutes, valid range: 1–71582), and retries failures with backoff capped at one hour. Multiple workers use transactional row claims. Monitor warning logs, pending row count and oldest CreatedAt in projecthub.StorageDeletions. Successful jobs are removed; repeated failures remain queued. STORAGE_CLEANUP_ENABLED=false pauses processing without losing jobs. Maintenance mode also pauses workers.

Upload recovery checks committed metadata before deleting bytes, queues compensating deletion durably, and logs incomplete recovery. General orphan reconciliation is not implemented. Never manually delete objects that still have metadata. Back up the database and object storage together.

Before rollout, restore/build/test, run .NET formatting checks and frontend checks, and verify fresh/upgrade migration behavior against disposable databases. Deploy backend and bundled frontend together for error-code support. Application rollback must use a build with the same consolidated baseline checksums; a pre-consolidation build will fail migration-history validation. Preserve the cleanup table and pending jobs during rollback rather than editing history or dropping data. Applied SQL files remain immutable outside the explicitly authorized fresh-baseline replacement. This refactor does not itself authorize a production deployment.
