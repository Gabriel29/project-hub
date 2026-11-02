using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using ProjectHub.Infrastructure;
using Xunit;

namespace ProjectHub.Tests;

public partial class PortalFlowTests
{
    [Fact]
    public async Task DashboardContactsUseTheAssignedAccounts()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var client = Client(factory);
        await SetupAsync(owner);
        var person = await Post(owner, "/api/admin/users", new { name = "Initial contact", clientName = "Company label", email = "initial@example.test" });
        await Post(client, "/api/auth/activate", new { token = Token(person), name = "Maria Ionescu", email = "maria@example.test", phoneNumber = "+40 722 345 678", password = "client1" });
        var project = await Post(owner, "/api/projects", ProjectBody("CONTACT", person.GetProperty("clientId").GetGuid()));
        var pid = project.GetProperty("id").GetString()!;
        var detail = (await ProjectDataAsync(owner, $"/api/projects/{pid}")).GetProperty("project");
        Assert.Equal("Maria Ionescu", detail.GetProperty("clientContactName").GetString());
        Assert.Equal("maria@example.test", detail.GetProperty("clientContactEmail").GetString());
        Assert.Equal("+40 722 345 678", detail.GetProperty("clientContactPhone").GetString());
        detail = (await ProjectDataAsync(client, $"/api/projects/{pid}")).GetProperty("project");
        Assert.Equal("Owner", detail.GetProperty("manager").GetString());
        Assert.Equal("owner@example.test", detail.GetProperty("managerEmail").GetString());
        Assert.Equal(JsonValueKind.Null, detail.GetProperty("clientContactEmail").ValueKind);
        (await owner.PutAsJsonAsync("/api/auth/phone", new { phoneNumber = "0735123456" })).EnsureSuccessStatusCode();
        detail = (await ProjectDataAsync(client, $"/api/projects/{pid}")).GetProperty("project");
        Assert.Equal("0735123456", detail.GetProperty("managerPhone").GetString());
        (await owner.PutAsJsonAsync($"/api/projects/{pid}", ProjectBody("CONTACT", null))).EnsureSuccessStatusCode();
        detail = (await ProjectDataAsync(owner, $"/api/projects/{pid}")).GetProperty("project");
        Assert.Equal(JsonValueKind.Null, detail.GetProperty("clientContactName").ValueKind);
        Assert.Equal(JsonValueKind.Null, detail.GetProperty("clientContactEmail").ValueKind);
        Assert.Equal(JsonValueKind.Null, detail.GetProperty("clientContactPhone").ValueKind);
    }

    [Fact]
    public async Task FinalStageStatePersistsAndCanBeReopened()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var client = Client(factory);
        await SetupAsync(owner);
        var person = await Post(owner, "/api/admin/users", new { name = "Client" });
        await Post(client, "/api/auth/activate", new { token = Token(person), email = "client@example.test", password = "client1" });
        var project = await Post(owner, "/api/projects", ProjectBody("COMPLETED", person.GetProperty("clientId").GetGuid()));
        var pid = project.GetProperty("id").GetString()!;
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync($"/api/projects/{pid}/status", new { stageId = (Guid?)null, stagesCompleted = true })).StatusCode);
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/stages", new[] { new { name = "Preparation" }, new { name = "Installation" } })).EnsureSuccessStatusCode();
        var detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        var stages = detail.GetProperty("project").GetProperty("milestones");
        var first = stages[0].GetProperty("id").GetGuid();
        var second = stages[1].GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync($"/api/projects/{pid}/status", new { stagesCompleted = true })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync($"/api/projects/{pid}/status", new { stageId = first, stagesCompleted = true })).StatusCode);
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/status", new { stageId = second })).EnsureSuccessStatusCode();
        detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        Assert.True(detail.GetProperty("project").GetProperty("milestones")[0].GetProperty("stageComplete").GetBoolean());
        Assert.False(detail.GetProperty("project").GetProperty("milestones")[1].GetProperty("stageComplete").GetBoolean());
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/status", new { stagesCompleted = true })).EnsureSuccessStatusCode();
        detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        Assert.All(detail.GetProperty("project").GetProperty("milestones").EnumerateArray(), m => Assert.True(m.GetProperty("stageComplete").GetBoolean()));
        Assert.True(detail.GetProperty("project").GetProperty("stagesCompleted").GetBoolean());
        Assert.Equal(JsonValueKind.Null, detail.GetProperty("project").GetProperty("stageId").ValueKind);
        Assert.Equal(2, detail.GetProperty("project").GetProperty("milestones").GetArrayLength());
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/stages", new[] { new { id = second, name = "Installation" }, new { id = first, name = "Preparation" } })).EnsureSuccessStatusCode();
        detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        Assert.True(detail.GetProperty("project").GetProperty("stagesCompleted").GetBoolean());
        Assert.Equal(JsonValueKind.Null, detail.GetProperty("project").GetProperty("stageId").ValueKind);
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/status", new { stageId = first })).EnsureSuccessStatusCode();
        detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        Assert.False(detail.GetProperty("project").GetProperty("stagesCompleted").GetBoolean());
        Assert.Equal(first, detail.GetProperty("project").GetProperty("stageId").GetGuid());
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/status", new { stagesCompleted = true })).EnsureSuccessStatusCode();
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/stages", Array.Empty<object>())).EnsureSuccessStatusCode();
        detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        Assert.False(detail.GetProperty("project").GetProperty("stagesCompleted").GetBoolean());
    }

    [Fact]
    public async Task FreshBaselineCreatesOnlyCurrentSchemaAndCanRestart()
    {
        using var factory = new PortalFactory();
        using var http = Client(factory);
        Assert.True((await http.GetFromJsonAsync<JsonElement>("/api/auth/setup-status")).GetProperty("required").GetBoolean());
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
        Assert.Equal(new[] { "0001_InitialIdentitySchema", "0002_InitialProjectHubSchema" }, await db.Database.SqlQueryRaw<string>("SELECT \"Id\" AS \"Value\" FROM projecthub.\"__PostgresMigrations\" ORDER BY \"Id\"").ToListAsync());
        Assert.False(await db.Users.AnyAsync());
        Assert.False(await db.Projects.AnyAsync());
        Assert.Equal(3, await db.Roles.CountAsync());
        foreach (var table in new[]
        {
            "Versions",
            "Approvals",
            "Members",
            "Interventions",
            "ArchivedInterventions",
            "PortalInstallation",
            "NotificationReads",
            "FileCleanupKeys",
            "__EFMigrationsHistory"
        }

        )
        {
            var qualifiedTable = $"projecthub.\"{table}\"";
            Assert.Null(await db.Database.SqlQuery<string>($"SELECT to_regclass({qualifiedTable})::text AS \"Value\"").SingleOrDefaultAsync());
        }

        await scope.ServiceProvider.GetRequiredService<PostgresMigrationRunner>().RunAsync();
    }

    [Fact]
    public async Task GeneratedCodesAreAtomicAndManagerIsAReference()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        await SetupAsync(owner);
        var first = await Post(owner, "/api/admin/users", new { name = "Kamen" });
        var second = await Post(owner, "/api/admin/users", new { name = "Kamel" });
        var third = await Post(owner, "/api/admin/users", new { name = "Kamil" });
        var cid = first.GetProperty("clientId").GetGuid();
        var a = await Post(owner, "/api/projects", ProjectBody("IGNORED", cid));
        var b = await Post(owner, "/api/projects", ProjectBody("IGNORED", second.GetProperty("clientId").GetGuid()));
        var c = await Post(owner, "/api/projects", ProjectBody("IGNORED", third.GetProperty("clientId").GetGuid()));
        var da = await ProjectDataAsync(owner, $"/api/projects/{a.GetProperty("id").GetGuid()}");
        var db = await ProjectDataAsync(owner, $"/api/projects/{b.GetProperty("id").GetGuid()}");
        var dc = await ProjectDataAsync(owner, $"/api/projects/{c.GetProperty("id").GetGuid()}");
        Assert.Equal("KM-1000", da.GetProperty("project").GetProperty("code").GetString());
        Assert.Equal("KA-1000", db.GetProperty("project").GetProperty("code").GetString());
        Assert.Matches("^[A-Z]{2}-1000$", dc.GetProperty("project").GetProperty("code").GetString()!);
        Assert.DoesNotContain(dc.GetProperty("project").GetProperty("code").GetString()!.Split('-')[0], new[] { "KM", "KA" });
        var concurrent = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => Post(owner, "/api/projects", ProjectBody("IGNORED", cid))));
        var all = await owner.GetFromJsonAsync<JsonElement>("/api/projects");
        Assert.Equal(7, all.EnumerateArray().Select(p => p.GetProperty("code").GetString()).Distinct().Count());
        Assert.All(all.EnumerateArray().Where(p => p.GetProperty("clientId").GetGuid() == cid), p => Assert.StartsWith("KM-", p.GetProperty("code").GetString()));
        (await owner.PutAsJsonAsync("/api/auth/phone", new { phoneNumber = "0735123456" })).EnsureSuccessStatusCode();
        da = await ProjectDataAsync(owner, $"/api/projects/{a.GetProperty("id").GetGuid()}");
        Assert.Equal("0735123456", da.GetProperty("project").GetProperty("managerPhone").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsJsonAsync("/api/projects", new { name = "Invalid", location = "", description = "Description", clientId = cid, managerUserId = first.GetProperty("id").GetString() })).StatusCode);
    }

}
