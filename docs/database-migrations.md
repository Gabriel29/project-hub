# PostgreSQL migrations

Schema creation and upgrades use PostgreSQL SQL executed by .NET through Npgsql.
EF Core handles mappings and data reads/writes only. Never use EF migrations,
model snapshots, `dotnet ef`, `Migrate`, `EnsureCreated`, or `EnsureDeleted` for
schema management. Future AI tasks must follow the repository root `AGENTS.md`.

## Schema files and order

- `0001_InitialIdentitySchema.sql` creates the `identity` schema and authentication
  tables: ASP.NET Identity users, roles, claims, logins and tokens, AccessLinks,
  and DataProtectionKeys.
- `0002_InitialProjectHubSchema.sql` creates business tables in `projecthub`, with foreign
  keys to `identity` users where needed, including the durable
  `StorageDeletions` cleanup queue.
- The runner creates `projecthub."__PostgresMigrations"` for its journal before
  applying the files. No application tables use `public`.

Scripts are embedded in the Infrastructure assembly and executed in filename
order. Identity runs first because business tables reference its users. Use
unique sequence numbers across files. The next schema change starts with `0003_`.

## Adding changes

Add a new append-only `.sql` file under
`src/ProjectHub.Infrastructure/Persistence/PostgresMigrations/`. Write explicit
PostgreSQL DDL/DML with schema-qualified table names, including constraints,
indexes, defaults and data backfills. Declare primary keys inside `CREATE TABLE`: use
named inline constraints for single columns and named table-level constraints for
composite keys. Declare foreign keys in the table definition when possible,
creating referenced tables first and including composite unique constraints
there as well. Defer only unavoidable circular dependencies to `ALTER TABLE`.
Update EF entities/mappings separately to
match the SQL. Never edit, rename, remove, or insert before an applied script.

At normal startup, `PostgresMigrationRunner` opens an Npgsql connection and
transaction, acquires `pg_advisory_xact_lock(71450285)`, checks migration IDs and
SHA-256 checksums, executes pending scripts, and records them in the journal.
The pending batch and journal commit atomically. Failures roll back the batch and
fail startup; concurrent/repeated startup applies each script once. Maintenance
mode skips migrations and role creation.

Scripts must not contain transaction control, psql backslash commands, or commands
requiring execution outside a transaction such as `CREATE INDEX CONCURRENTLY`.
There are no automatic down migrations. Recovery uses an explicit forward SQL
correction or coordinated database/object-storage restoration.

Verify fresh creation, repeat/concurrent startup, rollback on SQL failure,
append-only upgrades, data preservation/backfills, and affected application
workflows using disposable PostgreSQL databases. Tests also create the schemas
with `public` removed.

## Fresh local deployment

On October 16, 2026, the user explicitly requested a fresh local deployment with
separate `identity` and `projecthub` baselines, replacing the previous unreleased
single-schema baseline. This authorized reset is an exception to baseline
immutability, not permission to rewrite applied migrations in future tasks.
PostgreSQL and MinIO/S3 containers and their data volumes are recreated empty.
Startup creates both schemas, the development bucket and application roles;
there are no seeded accounts, projects or files. Owner setup is required again.

Existing incompatible migration layouts/checksums are rejected rather than reset.
Existing installations are not upgraded automatically by this release.
Normal `docker compose down` preserves data volumes. Future destructive resets
require a new explicit user request; startup must never reset database or storage.

## Production fresh baseline (October 19, 2026)

The user explicitly requested removal of the production adoption migration and
its compatibility path and explicitly authorized erasing the production database
and uploaded files for a fresh Dokploy deployment. Only the Identity and
business baseline scripts remain. This is a one-time authorized removal of an
applied migration, not permission to rewrite applied scripts in future tasks.
Databases containing the removed migration fail history validation; application
startup never resets them. Older EF layouts remain unsupported.

## Fresh-baseline consolidation

On October 17, 2026, the user explicitly requested another fresh installation
and inclusion of StorageDeletions in the initial schema. Its table, primary key,
nonnegative-attempt constraint and retry index now belong to
`0002_InitialProjectHubSchema.sql`; the standalone cleanup migration was removed.
`0001_InitialIdentitySchema.sql` remains Identity-only. Both fresh-baseline
scripts declare primary keys inside `CREATE TABLE`, preserving their names
and column order; separate primary-key `ALTER TABLE` statements are removed.
Tables in both schemas are ordered by dependency, allowing every existing
foreign key (including the folders self-reference) and composite unique
constraint to be declared inside `CREATE TABLE`, with their names and delete
behavior preserved.
This is a user-authorized baseline replacement for empty databases, not an
upgrade path or ongoing permission to rewrite applied scripts. No database or
object-storage reset was performed as part of this consolidation. Existing
migration histories/checksums still fail validation rather than being reset.

## Local PostgreSQL recreation (October 17, 2026)

After explicitly selecting Local Docker Compose, the user requested PostgreSQL
deletion and redeployment. The local `postgres` container and
`projecthub-portal_postgres-data` volume were removed and recreated; the API and
frontend were rebuilt/recreated. MinIO's container and
`projecthub-portal_minio-data` volume were preserved. Production was not changed.

Verification confirmed both baseline migrations, all 24 foreign keys, three
roles, and zero users/projects/files/cleanup jobs. API health and the frontend
returned HTTP 200; the proxied setup endpoint reported setup required, and an
anonymous project request returned the expected 401 Problem Details. Owner setup
is required again at http://localhost:5173. Preserved storage objects have no
restored project metadata; no storage reset or automatic relinking was run.

## Git history

Earlier Git versions did put SQL inside C#:

- `4857d2d` (October 12, 2026): `src/ProjectHub.Infrastructure/InitialSchema.cs`
  contained explicit PostgreSQL `CREATE TABLE` and index commands in a C# raw
  string passed to `MigrationBuilder.Sql(...)`.
- `1ff9931` (October 13): the same approach lived under
  `src/ProjectHub.Infrastructure/Persistence/InitialSchema.cs`; `ClientOwnership.cs`
  used explicit PostgreSQL `ALTER TABLE`, `CREATE TABLE`, and data updates.
- `cada0ef` (October 14): replaced that chain with a generated EF baseline.

Those earlier scripts were handwritten SQL, but EF still controlled migration
execution and history. The current implementation executes PostgreSQL SQL through
Npgsql directly, with its own transactional journal and checksums. The embedded
`.sql` format keeps the SQL reviewable independently of C# runner code.

## ProjectHub template baseline (November 2, 2026)

The user explicitly selected a clean baseline for new installations as part of
the ProjectHub rename. The business baseline is now
`0002_InitialProjectHubSchema.sql`, business tables and the migration journal
use `projecthub`, and Identity remains in `identity`. This is a one-time
authorized baseline replacement; future applied migrations remain immutable.
Existing installations require a separately planned data migration and matching
configuration. No database or object-storage reset is part of this rename.
