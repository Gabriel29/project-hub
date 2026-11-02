using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using ProjectHub.Application;

namespace ProjectHub.Tests;

internal class PortalFactory : WebApplicationFactory<Program>
{
    private readonly string connection;
    private readonly bool maintenance;
    private readonly Action<IServiceCollection>? configure;

    public PortalFactory(bool maintenance = false, Action<IServiceCollection>? configure = null)
    {
        this.maintenance = maintenance;
        this.configure = configure;
        var source = Environment.GetEnvironmentVariable("DATABASE_URL") ?? throw new InvalidOperationException("Set DATABASE_URL to a local disposable projecthub_test database.");
        var settings = new Npgsql.NpgsqlConnectionStringBuilder(source);
        if (settings.Host is not ("localhost" or "127.0.0.1") || settings.Database != "projecthub_test")
        {
            throw new InvalidOperationException("Tests only accept a local projecthub_test database.");
        }

        using var admin = new Npgsql.NpgsqlConnection(source);
        admin.Open();
        settings.Database = "projecthub_test_" + Guid.NewGuid().ToString("N");
        using var command = new Npgsql.NpgsqlCommand($"CREATE DATABASE \"{settings.Database}\"", admin);
        command.ExecuteNonQuery();
        connection = settings.ConnectionString;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            var settings = new Npgsql.NpgsqlConnectionStringBuilder(connection);
            var name = settings.Database;
            settings.Database = "projecthub_test";
            using var admin = new Npgsql.NpgsqlConnection(settings.ConnectionString);
            admin.Open();
            using var command = new Npgsql.NpgsqlCommand($"DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)", admin);
            command.ExecuteNonQuery();
        }
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("AWS_ENDPOINT_URL", "https://storage.example.test");
        builder.UseSetting("AWS_ACCESS_KEY_ID", "test-access-key");
        builder.UseSetting("AWS_SECRET_ACCESS_KEY", "test-secret-key");
        builder.UseSetting("AWS_S3_BUCKET_NAME", "test-bucket");
        builder.UseSetting("CREATE_STORAGE_BUCKET_ON_STARTUP", "false");
        builder.UseSetting("VERIFY_STORAGE_ON_STARTUP", "false");
        builder.UseSetting("PUBLIC_ORIGIN", "https://localhost");
        builder.UseSetting("STORAGE_CLEANUP_ENABLED", "false");
        builder.UseSetting("DATABASE_URL", connection);
        builder.UseSetting("MAINTENANCE_MODE", maintenance.ToString());
        builder.UseSetting("BOOTSTRAP_TOKEN", "test-bootstrap-only");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IFileStorage>();
            services.AddSingleton<IFileStorage, MemoryStorage>();
            configure?.Invoke(services);
        });
    }
}

internal class MemoryStorage : IFileStorage
{
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, (byte[] Bytes, string Type)> files = new();

    public async Task PutAsync(string key, Stream body, string contentType, CancellationToken ct)
    {
        using var ms = new MemoryStream();
        await body.CopyToAsync(ms, ct);
        files[key] = (ms.ToArray(), contentType);
    }

    public Task<StoredFile> GetAsync(string key, CancellationToken ct)
    {
        var f = files[key];
        var stream = new MemoryStream(f.Bytes);
        return Task.FromResult(new StoredFile(stream, f.Type, stream));
    }

    public Task DeleteAsync(string key, CancellationToken ct)
    {
        files.TryRemove(key, out _);
        return Task.CompletedTask;
    }
}
