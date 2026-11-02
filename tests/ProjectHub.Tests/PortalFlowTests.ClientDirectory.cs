using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using ProjectHub.Application;
using ProjectHub.Infrastructure;
using Xunit;

namespace ProjectHub.Tests;

public partial class PortalFlowTests
{
    [Fact]
    public async Task DirectoryIsManagementOnlyAndClientProfileContainsOnlyOwnPublicFields()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var admin = Client(factory);
        using var client = Client(factory);
        using var otherClient = Client(factory);
        using var anonymous = Client(factory);
        await SetupAsync(owner);
        await InviteAdminAsync(owner, admin);
        var account = await Post(owner, "/api/admin/users", new { name = "Initial contact", clientName = "INTERNAL CREDIT REVIEW", email = "initial@example.test" });
        var other = await Post(owner, "/api/admin/users", new { name = "Other contact", clientName = "OTHER INTERNAL LABEL", email = "other@example.test" });
        await Post(client, "/api/auth/activate", new { token = Token(account), name = "Personal name", email = "personal@example.test", phoneNumber = "+40 722 345 678", password = "client1" });
        await Post(otherClient, "/api/auth/activate", new { token = Token(other), name = "Other person", email = "other@example.test", password = "client1" });

        foreach (var manager in new[] { owner, admin })
        {
            var directory = await manager.GetFromJsonAsync<JsonElement>("/api/clients");
            Assert.Equal(2, directory.GetArrayLength());
            Assert.Contains(directory.EnumerateArray(), entry => entry.GetProperty("displayName").GetString() == "INTERNAL CREDIT REVIEW");
            Assert.Equal(HttpStatusCode.Forbidden, (await manager.GetAsync("/api/clients/me")).StatusCode);
        }

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/clients")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/clients/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/clients")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await otherClient.GetAsync("/api/clients")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync("/api/projects/clients")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/clients/{other.GetProperty("clientId").GetGuid()}")).StatusCode);
        var profile = await client.GetFromJsonAsync<JsonElement>($"/api/clients/me?clientId={other.GetProperty("clientId").GetGuid()}&userId={other.GetProperty("id").GetString()}");
        Assert.Equal(new[] { "displayName", "email", "id", "phoneNumber" }, profile.EnumerateObject().Select(field => field.Name).OrderBy(name => name));
        Assert.Equal(account.GetProperty("clientId").GetGuid(), profile.GetProperty("id").GetGuid());
        Assert.Equal("Personal name", profile.GetProperty("displayName").GetString());
        Assert.Equal("personal@example.test", profile.GetProperty("email").GetString());
        Assert.Equal("+40 722 345 678", profile.GetProperty("phoneNumber").GetString());
        Assert.DoesNotContain("INTERNAL", profile.GetRawText());
        var otherProfile = await otherClient.GetFromJsonAsync<JsonElement>("/api/clients/me");
        Assert.Equal(other.GetProperty("clientId").GetGuid(), otherProfile.GetProperty("id").GetGuid());

        (await client.PutAsJsonAsync("/api/auth/profile", new { name = "Updated name", email = "updated@example.test", phoneNumber = "0722123456", currentPassword = "client1" })).EnsureSuccessStatusCode();
        profile = await client.GetFromJsonAsync<JsonElement>("/api/clients/me");
        Assert.Equal("Updated name", profile.GetProperty("displayName").GetString());
        Assert.Equal("updated@example.test", profile.GetProperty("email").GetString());
        var project = await Post(owner, "/api/projects", ProjectBody("Assigned", account.GetProperty("clientId").GetGuid()));
        var projectId = project.GetProperty("id").GetGuid();
        var list = await client.GetFromJsonAsync<JsonElement>("/api/projects");
        Assert.Single(list.EnumerateArray());
        var overview = await client.GetFromJsonAsync<JsonElement>($"/api/projects/{projectId}");
        Assert.Equal(JsonValueKind.Null, overview.GetProperty("rootFolderId").ValueKind);
        Assert.Equal(JsonValueKind.Null, overview.GetProperty("project").GetProperty("managerUserId").ValueKind);
        Assert.Equal(JsonValueKind.Null, overview.GetProperty("project").GetProperty("clientContactName").ValueKind);
        var managerOverview = await admin.GetFromJsonAsync<JsonElement>($"/api/projects/{projectId}");
        Assert.Equal(managerId, managerOverview.GetProperty("project").GetProperty("managerUserId").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await otherClient.GetAsync($"/api/projects/{projectId}")).StatusCode);

        using var scope = factory.Services.CreateScope();
        var queries = scope.ServiceProvider.GetRequiredService<PortalDb>();
        var failure = await Assert.ThrowsAsync<PortalException>(() => new ClientQueries(queries, new TestActor(account.GetProperty("id").GetString()!, false, false)).ListAsync());
        Assert.Equal(403, failure.Status);
        failure = await Assert.ThrowsAsync<PortalException>(() => new ClientQueries(queries, new TestActor(managerId, true, true)).MyDetailsAsync());
        Assert.Equal(403, failure.Status);
    }
}
