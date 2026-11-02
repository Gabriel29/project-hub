using System.Security.Cryptography;
using System.Text;
using Npgsql;

namespace ProjectHub.Infrastructure;
// EF maps and persists entities; PostgreSQL SQL exclusively owns schema changes.
public sealed class PostgresMigrationRunner(string connectionString)
{
    internal sealed record Migration(string Id, string Sql)
    {
        public string Checksum => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(Sql)));
    }

    public Task RunAsync(CancellationToken ct = default) => ApplyAsync(Load(), ct);

    private static Migration[] Load()
    {
        var assembly = typeof(PostgresMigrationRunner).Assembly;
        const string prefix = "ProjectHub.Infrastructure.Persistence.PostgresMigrations.";
        return assembly.GetManifestResourceNames().Where(name => name.StartsWith(prefix, StringComparison.Ordinal) && name.EndsWith(".sql", StringComparison.Ordinal)).Order(StringComparer.Ordinal).Select(name =>
        {
            using var stream = assembly.GetManifestResourceStream(name)!;
            using var reader = new StreamReader(stream);
            return new Migration(name[prefix.Length..^4], reader.ReadToEnd());
        }).ToArray();
    }

    internal async Task ApplyAsync(IReadOnlyList<Migration> migrations, CancellationToken ct = default)
    {
        if (migrations.Count == 0 || migrations.Select(m => m.Id).Distinct(StringComparer.Ordinal).Count() != migrations.Count || !migrations.Select(m => m.Id).SequenceEqual(migrations.Select(m => m.Id).Order(StringComparer.Ordinal)))
        {
            throw new InvalidOperationException("PostgreSQL migrations must have unique IDs in ascending order.");
        }

        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);
        // Serialize startup across application instances. The lock releases on commit/rollback.
        await Execute("SELECT pg_advisory_xact_lock(71450285)");
        await using (var legacy = new NpgsqlCommand("SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = '__EFMigrationsHistory' OR (c.relname = '__PostgresMigrations' AND n.nspname <> 'projecthub'))", connection, transaction))
        {
            if ((bool)(await legacy.ExecuteScalarAsync(ct))!)
            {
                throw new InvalidOperationException("This database uses a retired migration layout. Use an empty database for the PostgreSQL baseline; existing data will not be reset automatically.");
            }
        }

        await Execute("CREATE SCHEMA IF NOT EXISTS projecthub");
        await Execute("""
            CREATE TABLE IF NOT EXISTS projecthub."__PostgresMigrations" (
                "Id" text PRIMARY KEY,
                "Checksum" text NOT NULL,
                "AppliedAt" timestamp with time zone NOT NULL DEFAULT now()
            )
            """);
        var applied = new List<(string Id, string Checksum)>();
        await using (var command = new NpgsqlCommand("SELECT \"Id\", \"Checksum\" FROM projecthub.\"__PostgresMigrations\" ORDER BY \"Id\" COLLATE \"C\"", connection, transaction))
        await using (var reader = await command.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                applied.Add((reader.GetString(0), reader.GetString(1)));
            }
        }

        // Applied scripts are immutable, and new migrations can only be appended.
        for (var i = 0; i < applied.Count; i++)
        {
            if (i >= migrations.Count || applied[i].Id != migrations[i].Id || applied[i].Checksum != migrations[i].Checksum)
            {
                throw new InvalidOperationException($"PostgreSQL migration history mismatch at '{applied[i].Id}'. Restore the original scripts and append a new SQL migration.");
            }
        }

        foreach (var migration in migrations.Skip(applied.Count))
        {
            await Execute(migration.Sql);
            await using var record = new NpgsqlCommand("INSERT INTO projecthub.\"__PostgresMigrations\" (\"Id\", \"Checksum\") VALUES (@id, @checksum)", connection, transaction);
            record.Parameters.AddWithValue("id", migration.Id);
            record.Parameters.AddWithValue("checksum", migration.Checksum);
            await record.ExecuteNonQueryAsync(ct);
        }

        await transaction.CommitAsync(ct);
        async Task Execute(string sql)
        {
            await using var command = new NpgsqlCommand(sql, connection, transaction)
            {
                CommandTimeout = 120
            };
            await command.ExecuteNonQueryAsync(ct);
        }
    }
}
