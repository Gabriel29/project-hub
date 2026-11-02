# Database schema changes

Always use PostgreSQL SQL migrations executed by .NET through Npgsql.
Entity Framework Core is for entity mapping and reading/writing data only.
Authentication/Identity tables, AccessLinks, and DataProtectionKeys belong in
`identity`. Business tables and the migration journal belong in `projecthub`.
Never create application tables in `public`. Qualify raw SQL references with the
correct schema. The initial files run in order: `0001_InitialIdentitySchema.sql`,
then `0002_InitialProjectHubSchema.sql`, so business foreign keys can reference users.

- Add new schema changes as ordered, append-only `.sql` files under
  `src/ProjectHub.Infrastructure/Persistence/PostgresMigrations/`.
- `PostgresMigrationRunner` embeds and executes these scripts at startup,
  serializes runners with a PostgreSQL advisory lock, and tracks checksums in
  `projecthub."__PostgresMigrations"`.
- Never use EF migrations, model snapshots, `dotnet ef`, `Migrate`,
  `EnsureCreated`, or `EnsureDeleted` to create or change schema.
- Never edit or remove an applied SQL migration. Append a new migration and
  update EF entity mappings separately to match it.
- Declare primary keys inside `CREATE TABLE`, using explicit constraint names
  and table-level primary keys for composite columns.
- Declare foreign keys inside `CREATE TABLE` where dependencies allow. Create
  referenced tables first and include referenced composite unique constraints
  in the table definition; use later `ALTER TABLE` only for unavoidable cycles.
- Scripts run inside a transaction: do not include transaction control,
  psql backslash commands, or statements such as `CREATE INDEX CONCURRENTLY`.
- Verify fresh installation, repeat/concurrent startup, migration rollback on
  failure, and affected data workflows against disposable local PostgreSQL.
- Never reset database or object storage unless the user explicitly requests it.

See `docs/database-migrations.md` for the workflow and local reset details.

# C# DTO and request formatting

- Format positional records for DTOs, requests, responses, and application contracts
  with one parameter per line, indented by four spaces.
- Put the opening parenthesis after the record name. Keep the closing `);` on the
  final parameter line, or `)` before the body of a record with members.
- Separate consecutive record declarations with a blank line.

# EF persistence simplicity

- Use the shared scoped `PortalDb` directly in EF-backed feature workflows under
  `ProjectHub.Infrastructure/Services`; keep contracts and pure rules in Application.
- Do not introduce custom repositories, query-port adapters, unit-of-work or
  transaction wrappers around Entity Framework Core.
- Use `AsNoTracking` for reads, tracked entity loads for mutations, and EF saves
  and transactions directly. Preserve transaction boundaries shared with Identity.
- Keep schema changes in SQL migrations as required above.

# ProjectHub baseline

The November 2, 2026 branding task explicitly authorized a clean ProjectHub SQL
baseline for new installations. That one-time exception does not authorize
future changes to applied migrations or database/object-storage resets.
