using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using ProjectHub.Infrastructure;
using Xunit;

namespace ProjectHub.Tests;

public class PostgresMigrationTests
{
    [Fact]
    public async Task FreshBaselineCreatesCleanupQueueAndRestartPreservesRows()
    {
        using var factory = new PortalFactory(maintenance: true);
        using var scope = factory.Services.CreateScope();
        var runner = scope.ServiceProvider.GetRequiredService<PostgresMigrationRunner>();
        var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
        await runner.RunAsync();
        var cleanup = new ProjectHub.Domain.StorageDeletion { ObjectKey = "pending-cleanup", Attempts = 2 };
        db.Add(cleanup);
        await db.SaveChangesAsync();
        var id = Guid.NewGuid();
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO projecthub.\"Projects\" (\"Id\", \"Code\", \"Name\", \"Location\", \"Description\", \"UpdatedAt\") VALUES ({id}, 'UP-1000', 'Preserved project', '', '', now())");
        await runner.RunAsync();
        await runner.RunAsync();
        Assert.Equal("Preserved project", (await db.Projects.SingleAsync(project => project.Id == id)).Name);
        var preserved = await db.Set<ProjectHub.Domain.StorageDeletion>().AsNoTracking().SingleAsync();
        Assert.Equal(cleanup.Id, preserved.Id);
        Assert.Equal("pending-cleanup", preserved.ObjectKey);
        Assert.Equal(2, preserved.Attempts);
    }

    [Fact]
    public async Task ConcurrentFreshStartupCreatesSchemaExactlyOnceAndEfCanReadIt()
    {
        using var factory = new PortalFactory(maintenance: true);
        using var scope = factory.Services.CreateScope();
        var runner = scope.ServiceProvider.GetRequiredService<PostgresMigrationRunner>();
        var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
        await db.Database.ExecuteSqlRawAsync("DROP SCHEMA public");
        await Task.WhenAll(runner.RunAsync(), runner.RunAsync());
        var identityTables = new[]
        {
            "AccessLinks",
            "AspNetRoleClaims",
            "AspNetRoles",
            "AspNetUserClaims",
            "AspNetUserLogins",
            "AspNetUserRoles",
            "AspNetUserTokens",
            "AspNetUsers",
            "DataProtectionKeys"
        };
        Assert.All(db.Model.GetEntityTypes(), entity => Assert.Equal(identityTables.Contains(entity.GetTableName()) ? "identity" : "projecthub", entity.GetSchema()));
        Assert.Equal(0, await db.Database.SqlQueryRaw<int>("SELECT count(*)::int AS \"Value\" FROM information_schema.tables WHERE table_schema = 'public'").SingleAsync());
        Assert.Equal(2, await db.Database.SqlQueryRaw<int>("SELECT count(*)::int AS \"Value\" FROM projecthub.\"__PostgresMigrations\"").SingleAsync());
        // Exercise every mapped table against the handwritten PostgreSQL schema.
        await using var connection = new NpgsqlConnection(db.Database.GetConnectionString());
        await connection.OpenAsync();
        using var identifiers = new NpgsqlCommandBuilder();
        foreach (var entity in db.Model.GetEntityTypes())
        {
            var table = entity.GetTableName()!;
            var schema = entity.GetSchema()!;
            var columns = entity.GetProperties().Select(p => identifiers.QuoteIdentifier(p.GetColumnName()));
            await using var command = new NpgsqlCommand($"SELECT {string.Join(", ", columns)} FROM {identifiers.QuoteIdentifier(schema)}.{identifiers.QuoteIdentifier(table)} LIMIT 0", connection);
            await command.ExecuteNonQueryAsync();
        }

        Assert.Empty(await db.Projects.ToListAsync());
    }

    [Fact]
    public async Task FailedSqlRollsBackSchemaAndHistoryAndAllowsRetry()
    {
        using var factory = new PortalFactory(maintenance: true);
        using var scope = factory.Services.CreateScope();
        var runner = scope.ServiceProvider.GetRequiredService<PostgresMigrationRunner>();
        var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
        PostgresMigrationRunner.Migration[] failed = [new("0001_Test", "CREATE TABLE projecthub.migration_test (id integer PRIMARY KEY);"), new("0002_Fails", "INSERT INTO projecthub.missing_table VALUES (1);")];
        await Assert.ThrowsAsync<PostgresException>(() => runner.ApplyAsync(failed));
        Assert.True(await db.Database.SqlQueryRaw<bool>("SELECT to_regclass('projecthub.migration_test') IS NULL AND to_regclass('projecthub.\"__PostgresMigrations\"') IS NULL AS \"Value\"").SingleAsync());
        await runner.RunAsync();
        Assert.Empty(await db.Projects.ToListAsync());
    }

    [Fact]
    public async Task AppendOnlySqlUpgradePreservesRowsAndRunsOnce()
    {
        using var factory = new PortalFactory(maintenance: true);
        using var scope = factory.Services.CreateScope();
        var runner = scope.ServiceProvider.GetRequiredService<PostgresMigrationRunner>();
        var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
        PostgresMigrationRunner.Migration first = new("0001_Test", "CREATE TABLE projecthub.migration_test (id integer PRIMARY KEY); INSERT INTO projecthub.migration_test VALUES (1);");
        PostgresMigrationRunner.Migration next = new("0002_AddColumn", "ALTER TABLE projecthub.migration_test ADD COLUMN label text NOT NULL DEFAULT 'preserved';");
        await runner.ApplyAsync([first]);
        await runner.ApplyAsync([first, next]);
        await runner.ApplyAsync([first, next]);
        Assert.Equal("preserved", await db.Database.SqlQueryRaw<string>("SELECT label AS \"Value\" FROM projecthub.migration_test WHERE id = 1").SingleAsync());
        await Assert.ThrowsAsync<InvalidOperationException>(() => runner.ApplyAsync([first]));
        await Assert.ThrowsAsync<InvalidOperationException>(() => runner.ApplyAsync([first with { Sql = first.Sql + " -- edited" }, next]));
    }

    [Fact]
    public async Task LegacyEfDatabaseIsRejectedWithoutDeletingAnything()
    {
        using var factory = new PortalFactory(maintenance: true);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE public.\"__EFMigrationsHistory\" (id integer); INSERT INTO public.\"__EFMigrationsHistory\" VALUES (42)");
        var runner = scope.ServiceProvider.GetRequiredService<PostgresMigrationRunner>();
        await Assert.ThrowsAsync<InvalidOperationException>(() => runner.RunAsync());
        Assert.Equal(42, await db.Database.SqlQueryRaw<int>("SELECT id AS \"Value\" FROM public.\"__EFMigrationsHistory\"").SingleAsync());
    }
}
