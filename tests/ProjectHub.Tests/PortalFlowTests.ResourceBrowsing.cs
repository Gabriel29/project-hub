using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace ProjectHub.Tests;

public partial class PortalFlowTests
{
    [Fact]
    public async Task FolderResourcesReturnOnlyDirectChildrenAndEnforceRoleAndProjectScope()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var admin = Client(factory);
        using var client = Client(factory);
        using var stranger = Client(factory);
        await SetupAsync(owner);
        await InviteAdminAsync(owner, admin);
        var person = await Post(owner, "/api/admin/users", new { name = "Client" });
        await Post(client, "/api/auth/activate", new { token = Token(person), email = "client@example.test", password = "client1" });
        var other = await Post(owner, "/api/admin/users", new { name = "Stranger" });
        await Post(stranger, "/api/auth/activate", new { token = Token(other), email = "stranger@example.test", password = "client1" });
        var project = await Post(owner, "/api/projects", ProjectBody("Folder resources", person.GetProperty("clientId").GetGuid()));
        var path = $"/api/projects/{project.GetProperty("id").GetString()}";
        var overview = await owner.GetFromJsonAsync<JsonElement>(path);
        var rootId = overview.GetProperty("rootFolderId").GetGuid();
        foreach (var field in new[] { "files", "folders", "updates", "sections", "events" })
        {
            Assert.False(overview.TryGetProperty(field, out _));
        }

        var clientOverview = await client.GetFromJsonAsync<JsonElement>(path);
        Assert.Equal(JsonValueKind.Null, clientOverview.GetProperty("rootFolderId").ValueKind);
        var sections = await client.GetFromJsonAsync<JsonElement>($"{path}/sections");
        Assert.DoesNotContain(sections.EnumerateArray(), s => s.GetProperty("key").GetString() == "progress");
        var contractsId = sections.EnumerateArray().Single(s => s.GetProperty("key").GetString() == "contracts").GetProperty("folderId").GetGuid();
        await Post(owner, $"{path}/files/folders", new { name = "Child", parentId = contractsId });
        var listing = await client.GetFromJsonAsync<JsonElement>($"{path}/folders/{contractsId}/contents");
        var childId = listing.GetProperty("folders")[0].GetProperty("id").GetGuid();
        Assert.Single(listing.GetProperty("breadcrumbs").EnumerateArray());
        Assert.Equal(JsonValueKind.Null, listing.GetProperty("folder").GetProperty("parentId").ValueKind);
        await Post(admin, $"{path}/files/folders", new { name = "Grandchild", parentId = childId });
        var pid = project.GetProperty("id").GetString()!;
        var rootFile = await UploadAsync(owner, pid, null, contractsId.ToString());
        var nestedFile = await UploadAsync(admin, pid, null, childId.ToString());
        listing = await client.GetFromJsonAsync<JsonElement>($"{path}/folders/{contractsId}/contents");
        Assert.Single(listing.GetProperty("folders").EnumerateArray());
        Assert.Equal("Child", listing.GetProperty("folders")[0].GetProperty("name").GetString());
        Assert.Single(listing.GetProperty("files").EnumerateArray());
        Assert.Equal(rootFile.GetProperty("id").GetGuid(), listing.GetProperty("files")[0].GetProperty("id").GetGuid());
        var nested = await client.GetFromJsonAsync<JsonElement>($"{path}/folders/{childId}/contents");
        Assert.Equal("Grandchild", nested.GetProperty("folders")[0].GetProperty("name").GetString());
        Assert.Equal(nestedFile.GetProperty("id").GetGuid(), nested.GetProperty("files")[0].GetProperty("id").GetGuid());
        Assert.Equal(2, nested.GetProperty("breadcrumbs").GetArrayLength());
        var results = await client.GetFromJsonAsync<JsonElement>($"{path}/folders/{contractsId}/search?query=plan");
        Assert.Equal(2, results.GetProperty("files").GetArrayLength());
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"{path}/folders/{rootId}/contents")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"{path}/folders/{rootId}/search?query=plan")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"{path}/events")).StatusCode);
        var managerSections = await admin.GetFromJsonAsync<JsonElement>($"{path}/sections");
        var progressId = managerSections.EnumerateArray().Single(s => s.GetProperty("key").GetString() == "progress").GetProperty("folderId").GetGuid();
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"{path}/folders/{progressId}/contents")).StatusCode);
        foreach (var suffix in new[] { "", "/sections", $"/folders/{contractsId}/contents", $"/folders/{contractsId}/search?query=plan", "/activities", "/recent-documents" })
        {
            Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync(path + suffix)).StatusCode);
        }

        var second = await Post(owner, "/api/projects", ProjectBody("Second", null));
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync($"/api/projects/{second.GetProperty("id").GetString()}/folders/{contractsId}/contents")).StatusCode);
        (await admin.GetAsync($"{path}/folders/{rootId}/contents")).EnsureSuccessStatusCode();
        var recent = await client.GetFromJsonAsync<JsonElement>($"{path}/recent-documents");
        Assert.Equal(2, recent.GetProperty("files").GetArrayLength());
        for (var index = 0; index < 4; index++)
        {
            var attachment = await UploadAsync(owner, pid, null, photo: true, sectionKey: "progress", viaExplorer: true);
            await Post(owner, $"{path}/updates", new { title = $"Activity {index}", details = "Published", photoIds = new[] { attachment.GetProperty("contentId").GetGuid() } });
        }

        var preview = await client.GetFromJsonAsync<JsonElement>($"{path}/activities?limit=3");
        Assert.Equal(3, preview.GetProperty("updates").GetArrayLength());
        Assert.Equal(3, preview.GetProperty("files").GetArrayLength());
        Assert.DoesNotContain(preview.GetProperty("updates").EnumerateArray(), update => update.GetProperty("title").GetString() == "Activity 0");
        var all = await client.GetFromJsonAsync<JsonElement>($"{path}/activities");
        Assert.Equal(4, all.GetProperty("updates").GetArrayLength());
        for (var index = 0; index < 7; index++)
        {
            await UploadAsync(owner, pid, null, contractsId.ToString());
        }

        recent = await client.GetFromJsonAsync<JsonElement>($"{path}/recent-documents");
        Assert.Equal(6, recent.GetProperty("files").GetArrayLength());
        Assert.All(recent.GetProperty("files").EnumerateArray(), file => Assert.Equal(contractsId, file.GetProperty("folderId").GetGuid()));
    }
}
