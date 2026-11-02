using Microsoft.AspNetCore.Builder;
using System.Collections.Concurrent;
using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging.Abstractions;
using ProjectHub.Application;
using ProjectHub.Domain;
using ProjectHub.Infrastructure;
using ProjectHub.WebAPI;
using Xunit;

namespace ProjectHub.Tests;

public partial class PortalFlowTests
{
    [Fact]
    public async Task ProblemDetailsCoversAuthenticationGuardsValidationAndUnexpectedFailures()
    {
        using var factory = new PortalFactory();
        using var anonymous = Client(factory);
        var response = await anonymous.GetAsync("/api/projects");
        await AssertProblem(response, HttpStatusCode.Unauthorized, "signInRequired");
        anonymous.DefaultRequestHeaders.Remove("X-ProjectHub-Request");
        await AssertProblem(await anonymous.PostAsJsonAsync("/api/auth/login", new { email = "a@example.test", password = "abcdef1" }), HttpStatusCode.Forbidden, "accessDenied");
        using var owner = Client(factory);
        await SetupAsync(owner);
        await AssertProblem(await owner.PostAsync("/api/projects", new StringContent("null", Encoding.UTF8, "application/json")), HttpStatusCode.BadRequest, "invalidRequest");
        await AssertProblem(await owner.PostAsJsonAsync("/api/projects", new { name = "Invalid", location = (string?)null, clientId = (Guid?)null, managerUserId = managerId }), HttpStatusCode.BadRequest, "invalidRequest");
        owner.DefaultRequestHeaders.Add("Origin", "http://localhost");
        await AssertProblem(await owner.GetAsync("/api/projects"), HttpStatusCode.Forbidden, "accessDenied");
    }

    [Fact]
    public async Task InvalidArrayEntriesAndActivityDetailsAreRejectedWithoutChangingTheProject()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        await SetupAsync(owner);
        var project = await Post(owner, "/api/projects", ProjectBody("Invalid inputs", null));
        var id = project.GetProperty("id").GetGuid();
        foreach (var route in new[]
        {
            "stages",
            "milestones"
        }

        )
        {
            await AssertProblem(await owner.PutAsync($"/api/projects/{id}/{route}", new StringContent("[null]", Encoding.UTF8, "application/json")), HttpStatusCode.BadRequest);
        }

        await AssertProblem(await owner.PostAsJsonAsync($"/api/projects/{id}/updates", new { title = "No details", details = (string?)null }), HttpStatusCode.BadRequest);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
        Assert.Empty(await db.Milestones.ToListAsync());
        Assert.Empty(await db.CalendarEntries.ToListAsync());
    }

    [Fact]
    public async Task DirectApplicationCallsRequireAuthenticationAndOwnerPermissions()
    {
        using var factory = new PortalFactory();
        using var scope = factory.Services.CreateScope();
        await Assert.ThrowsAsync<PortalException>(() => scope.ServiceProvider.GetRequiredService<ProjectQueries>().ListAsync(null));
        var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
        var actor = new TestActor("client", false, false);
        var access = new ProjectAccess(db, actor);
        var notes = new NoteQueries(db, access, actor);
        var failure = await Assert.ThrowsAsync<PortalException>(() => notes.ListAsync(Guid.NewGuid()));
        Assert.Equal(403, failure.Status);
        failure = await Assert.ThrowsAsync<PortalException>(() => new ProjectQueries(db, access, new TestActor("", true, true), scope.ServiceProvider.GetRequiredService<IIdentityGateway>()).ListAsync(null));
        Assert.Equal(401, failure.Status);
    }

    [Fact]
    public async Task ProfileAndSecurityStampChangesRollBackTogether()
    {
        var fault = new WriteFault();
        using var factory = new PortalFactory(configure: services => services.AddDbContext<PortalDb>(options => options.AddInterceptors(fault)));
        using var owner = Client(factory);
        await SetupAsync(owner);
        fault.FailOnSave = 2;
        await AssertProblem(await owner.PutAsJsonAsync("/api/auth/profile", new { name = "Changed", email = "changed@example.test", currentPassword = "owner1" }), HttpStatusCode.InternalServerError, "unexpected");
        var me = await owner.GetFromJsonAsync<JsonElement>("/api/auth/me");
        Assert.Equal("owner@example.test", me.GetProperty("email").GetString());
        Assert.Equal("Owner", me.GetProperty("displayName").GetString());
    }

    [Fact]
    public async Task DirectoryQueryCountDoesNotGrowWithAccountCountAndProjectContactsAreTargeted()
    {
        var counter = new QueryCounter();
        using var factory = new PortalFactory(configure: services => services.AddDbContext<PortalDb>(options => options.AddInterceptors(counter)));
        using var owner = Client(factory);
        await SetupAsync(owner);
        counter.Commands.Clear();
        (await owner.GetAsync("/api/admin/users")).EnsureSuccessStatusCode();
        var initial = counter.Commands.Count;
        for (var index = 0; index < 6; index++)
        {
            await Post(owner, "/api/admin/users", new { name = "Contact " + index });
        }

        counter.Commands.Clear();
        (await owner.GetAsync("/api/admin/users")).EnsureSuccessStatusCode();
        Assert.Equal(initial, counter.Commands.Count);
        var project = await Post(owner, "/api/projects", ProjectBody("Targeted", null));
        counter.Commands.Clear();
        (await owner.GetAsync($"/api/projects/{project.GetProperty("id").GetGuid()}")).EnsureSuccessStatusCode();
        Assert.All(counter.Commands.Where(sql => sql.Contains("FROM identity.\"AspNetUsers\"", StringComparison.Ordinal)), sql => Assert.Contains("WHERE", sql));
        Assert.DoesNotContain(counter.Commands, sql => sql.Contains("FROM identity.\"AccessLinks\"", StringComparison.Ordinal));
    }

    [Fact]
    public async Task UploadFailureCompensatesAndDeletionFailureRollsBackMetadataAndQueue()
    {
        var fault = new WriteFault();
        var storage = new TestStorage();
        using var factory = new PortalFactory(configure: services =>
        {
            services.AddDbContext<PortalDb>(options => options.AddInterceptors(fault));
            services.RemoveAll<IFileStorage>();
            services.AddSingleton<IFileStorage>(storage);
        });
        using var owner = Client(factory);
        await SetupAsync(owner);
        var project = await Post(owner, "/api/projects", ProjectBody("Failure", null));
        var id = project.GetProperty("id").GetString()!;
        fault.FailOnSave = 1;
        using (var form = new MultipartFormDataContent())
        {
            form.Add(new StringContent("Upload"), "title");
            form.Add(new ByteArrayContent("%PDF-1.7\nFailure test"u8.ToArray()), "file", "test.pdf");
            await AssertProblem(await owner.PostAsync($"/api/projects/{id}/files", form), HttpStatusCode.InternalServerError);
        }

        Assert.Equal(1, storage.DeleteCalls);
        var file = await UploadAsync(owner, id, null);
        fault.FailOnSave = 1;
        await AssertProblem(await owner.DeleteAsync($"/api/projects/{id}/files/{file.GetProperty("id").GetGuid()}"), HttpStatusCode.InternalServerError);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
        Assert.Single(await db.Files.ToListAsync());
        Assert.Single(await db.Set<StorageDeletion>().ToListAsync());
        (await owner.DeleteAsync($"/api/projects/{id}/files/{file.GetProperty("id").GetGuid()}")).EnsureSuccessStatusCode();
        Assert.Equal(2, await db.Set<StorageDeletion>().AsNoTracking().CountAsync());
        Assert.Equal(1, storage.DeleteCalls);
    }

    [Fact]
    public async Task CleanupRetriesAfterRestartAndMultipleWorkersClaimEachRowOnce()
    {
        var storage = new TestStorage
        {
            Failures = 1
        };
        using var factory = new PortalFactory();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
            db.Add(new StorageDeletion { ObjectKey = "retry" });
            await db.SaveChangesAsync();
            await new StorageCleanupBatch(db, storage, NullLogger<StorageCleanupBatch>.Instance, scope.ServiceProvider.GetRequiredService<IConfiguration>()).RunAsync();
            var pending = await db.Set<StorageDeletion>().SingleAsync();
            Assert.Equal(1, pending.Attempts);
            Assert.True(pending.NextAttemptAt > DateTimeOffset.UtcNow);
            pending.NextAttemptAt = DateTimeOffset.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        }

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
            await new StorageCleanupBatch(db, storage, NullLogger<StorageCleanupBatch>.Instance, scope.ServiceProvider.GetRequiredService<IConfiguration>()).RunAsync();
            Assert.Empty(await db.Set<StorageDeletion>().ToListAsync());
            db.AddRange(Enumerable.Range(0, 12).Select(i => new StorageDeletion { ObjectKey = "parallel-" + i }));
            await db.SaveChangesAsync();
        }

        async Task Process()
        {
            using var scope = factory.Services.CreateScope();
            await new StorageCleanupBatch(scope.ServiceProvider.GetRequiredService<PortalDb>(), storage, NullLogger<StorageCleanupBatch>.Instance, scope.ServiceProvider.GetRequiredService<IConfiguration>()).RunAsync();
        }

        await Task.WhenAll(Process(), Process());
        Assert.All(storage.Keys.Where(pair => pair.Key.StartsWith("parallel-", StringComparison.Ordinal)), pair => Assert.Equal(1, pair.Value));
        Assert.Equal(12, storage.Keys.Count(pair => pair.Key.StartsWith("parallel-", StringComparison.Ordinal)));
    }

    [Fact]
    public async Task ConcurrentStageEditsKeepCompletionAndOrderingConsistent()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        await SetupAsync(owner);
        var project = await Post(owner, "/api/projects", ProjectBody("Stages", null));
        var id = project.GetProperty("id").GetGuid();
        await Task.WhenAll(Enumerable.Range(0, 4).Select(async i => (await owner.PutAsJsonAsync($"/api/projects/{id}/stages", new[] { new { name = "Stage " + i } })).EnsureSuccessStatusCode()));
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
        var stages = await db.Milestones.Where(m => m.ProjectId == id).ToListAsync();
        Assert.Single(stages);
        Assert.Equal(0, stages[0].OrderIndex);
        Assert.False(stages[0].StageComplete);
    }

    private static async Task AssertProblem(HttpResponseMessage response, HttpStatusCode status, string? code = null)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal((int)status, problem.GetProperty("status").GetInt32());
        Assert.False(string.IsNullOrWhiteSpace(problem.GetProperty("traceId").GetString()));
        if (code != null)
        {
            Assert.Equal(code, problem.GetProperty("code").GetString());
        }
    }
}

public sealed class HostConfigurationTests
{
    [Fact]
    public void ProductionOriginAndHostsAreValidatedAndUntrustedProxiesAreNotAccepted()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["PUBLIC_ORIGIN"] = "https://portal.example.test" }).Build();
        Assert.Equal("https://portal.example.test", PortalHostOptions.Read(configuration, false).PublicOrigin);
        configuration["AllowedHosts"] = "*";
        Assert.Throws<InvalidOperationException>(() => PortalHostOptions.Read(configuration, false));
        configuration["AllowedHosts"] = "portal.example.test";
        configuration["PUBLIC_ORIGIN"] = "http://portal.example.test";
        Assert.Throws<InvalidOperationException>(() => PortalHostOptions.Read(configuration, false));
        var options = new ForwardedHeadersOptions();
        PortalHostOptions.ConfigureProxies(options, configuration);
        Assert.NotEmpty(options.KnownIPNetworks);
        Assert.DoesNotContain(IPAddress.Parse("203.0.113.1"), options.KnownProxies);
    }
}

internal sealed record TestActor(string Id, bool IsManager, bool IsOwner) : ICurrentUser
{
    public string? Ip => null;
}

internal sealed class WriteFault : SaveChangesInterceptor
{
    public int FailOnSave { get; set; }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        if (FailOnSave > 0 && --FailOnSave == 0)
        {
            throw new InvalidOperationException("Injected persistence failure.");
        }

        return ValueTask.FromResult(result);
    }
}

internal sealed class QueryCounter : DbCommandInterceptor
{
    public ConcurrentQueue<string> Commands { get; } = new();

    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
    {
        Commands.Enqueue(command.CommandText);
        return ValueTask.FromResult(result);
    }
}

internal sealed class TestStorage : IFileStorage
{
    private readonly MemoryStorage memory = new();
    public ConcurrentDictionary<string, int> Keys { get; } = new();
    public int Failures { get; set; }

    public int DeleteCalls;

    public Task PutAsync(string key, Stream body, string contentType, CancellationToken ct) => memory.PutAsync(key, body, contentType, ct);

    public Task<StoredFile> GetAsync(string key, CancellationToken ct) => memory.GetAsync(key, ct);

    public Task DeleteAsync(string key, CancellationToken ct)
    {
        Interlocked.Increment(ref DeleteCalls);
        Keys.AddOrUpdate(key, 1, (_, count) => count + 1);
        if (Failures > 0)
        {
            Failures--;
            throw new IOException("Injected storage failure.");
        }

        return memory.DeleteAsync(key, ct);
    }
}
