# Current schema baseline

The October 16, 2026 local reset removes the previous EF migration chain and
model snapshots. The current schema is created by `0001_InitialIdentitySchema.sql` and `0002_InitialProjectHubSchema.sql`,
embedded PostgreSQL scripts executed by .NET through Npgsql. EF is used only for
mapping and reading/writing data. See [database migrations](database-migrations.md).

Identity, access links and encryption keys live in identity; business tables and migration history live in projecthub. Projects, client ownership, file trees, notes,
activities, maintenance dates, access links and persistent cookie keys remain in
the model. Milestones persist StageComplete; project status is derived from these
flags. NotificationReads, FileCleanupKeys, project cover/current-stage/completion
columns, and activity stage references are absent.

Startup applies pending SQL migrations under a PostgreSQL advisory lock and
records checksums transactionally, then creates application roles. No accounts or
projects are seeded. Tests cover fresh schema creation, repeat/concurrent startup,
rollback on SQL failure, append-only upgrades, and application workflows against
disposable PostgreSQL databases. The baseline never resets an existing database.

The user-authorized fresh business baseline (`0002_InitialProjectHubSchema.sql`) includes `projecthub."StorageDeletions"` for durable object cleanup. There is no standalone cleanup migration; the retired FileCleanupKeys table remains absent. See [backend audit](backend-audit.md) for the current file-by-file review and [operations](operations.md) for retry monitoring.
