using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace ProjectHub.Tests;

public partial class PortalFlowTests
{
    [Fact]
    public async Task ProgressExplorerOnlyPublishesReferencedImagesAndProtectsAttachments()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var admin = Client(factory);
        using var client = Client(factory);
        await SetupAsync(owner);
        var adminAccount = await InviteAdminAsync(owner, admin);
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.PostAsJsonAsync($"/api/admin/users/{managerId}/disabled", new { disabled = true })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.PostAsJsonAsync($"/api/admin/users/{adminAccount.GetProperty("id").GetString()}/disabled", new { disabled = true })).StatusCode);
        var person = await Post(owner, "/api/admin/users", new { name = "Client" });
        await Post(client, "/api/auth/activate", new { token = Token(person), email = "client@example.test", password = "client1" });
        var project = await Post(owner, "/api/projects", ProjectBody("PROGRESS", person.GetProperty("clientId").GetGuid()));
        var pid = project.GetProperty("id").GetString()!;
        var detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        var progress = detail.GetProperty("folders").EnumerateArray().Single(f => f.GetProperty("sectionKey").GetString() == "progress").GetProperty("id").GetString()!;
        var root = detail.GetProperty("folders").EnumerateArray().Single(f => f.GetProperty("parentId").ValueKind == JsonValueKind.Null).GetProperty("id").GetString();
        await Post(owner, $"/api/projects/{pid}/files/folders", new { name = "Fotografii montaj", parentId = progress });
        detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        var child = detail.GetProperty("folders").EnumerateArray().Single(f => f.GetProperty("name").GetString() == "Fotografii montaj").GetProperty("id").GetString();
        var photo = await UploadAsync(admin, pid, null, child, photo: true, viaExplorer: true);
        var fid = photo.GetProperty("id").GetString();
        var content = photo.GetProperty("contentId").GetGuid();
        var privatePhoto = await UploadAsync(owner, pid, null, photo: true, viaExplorer: true);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/projects/{pid}/files/{fid}/content")).StatusCode);
        detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        Assert.Empty(detail.GetProperty("files").EnumerateArray());
        Assert.DoesNotContain(detail.GetProperty("folders").EnumerateArray(), f => f.GetProperty("id").GetString() == progress);
        using (var form = new MultipartFormDataContent())
        {
            form.Add(new StringContent("Client photo"), "title");
            form.Add(new StringContent(progress), "folderId");
            form.Add(new ByteArrayContent(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0 }), "file", "photo.png");
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync($"/api/projects/{pid}/files", form)).StatusCode);
        }

        using (var form = new MultipartFormDataContent())
        {
            form.Add(new StringContent("Not an image"), "title");
            form.Add(new StringContent("progress"), "sectionKey");
            form.Add(new ByteArrayContent("%PDF-1.7\nTest file"u8.ToArray()), "file", "plan.pdf");
            (await owner.PostAsync($"/api/projects/{pid}/files", form)).EnsureSuccessStatusCode();
        }

        var pdf = await UploadAsync(owner, pid, null);
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/files/{pdf.GetProperty("id").GetString()}/folder", new { folderId = progress })).EnsureSuccessStatusCode();
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/stages", new[] { new { id = (Guid?)null, name = "Montaj", description = "" } })).EnsureSuccessStatusCode();
        detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        var stage = detail.GetProperty("project").GetProperty("stageId").GetGuid();
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsJsonAsync($"/api/projects/{pid}/updates", new { title = "Wrong folder", details = "", occurredAt = DateTimeOffset.UtcNow, stageId = stage, photoIds = new[] { privatePhoto.GetProperty("contentId").GetGuid() } })).StatusCode);
        await Post(owner, $"/api/projects/{pid}/updates", new { title = "Public photo", details = "", occurredAt = DateTimeOffset.UtcNow, stageId = stage, photoIds = new[] { content }, cover = true });
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/projects/{pid}/files/{fid}/content?inline=true")).StatusCode);
        detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        var entry = detail.GetProperty("updates")[0].GetProperty("id").GetGuid();
        foreach (var manager in new[]
        {
            owner,
            admin
        }

        )
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await manager.DeleteAsync($"/api/projects/{pid}/files/{fid}")).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await manager.PutAsJsonAsync($"/api/projects/{pid}/files/{fid}/folder", new { folderId = root })).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await manager.PutAsJsonAsync($"/api/projects/{pid}/files/folders/{child}/parent", new { folderId = root })).StatusCode);
        }

        (await owner.PutAsJsonAsync($"/api/projects/{pid}/updates/{entry}", new { title = "Detached", details = "", occurredAt = DateTimeOffset.UtcNow, stageId = stage, photoIds = Array.Empty<Guid>(), cover = true })).EnsureSuccessStatusCode();
        (await admin.DeleteAsync($"/api/projects/{pid}/files/{fid}")).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task ProgressCanBePublishedWithoutAnyStages()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var client = Client(factory);
        await SetupAsync(owner);
        var person = await Post(owner, "/api/admin/users", new { name = "Client" });
        await Post(client, "/api/auth/activate", new { token = Token(person), email = "client@example.test", password = "client1" });
        var project = await Post(owner, "/api/projects", ProjectBody("Independent", person.GetProperty("clientId").GetGuid()));
        var id = project.GetProperty("id").GetString();
        await Post(owner, $"/api/projects/{id}/updates", new { title = "Actualizare independentă", details = "Progres fără etapă", occurredAt = DateTimeOffset.UtcNow });
        var detail = await ProjectDataAsync(client, $"/api/projects/{id}");
        Assert.Equal(0, detail.GetProperty("project").GetProperty("milestones").GetArrayLength());
        Assert.False(detail.GetProperty("updates")[0].TryGetProperty("stageId", out _));
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync($"/api/projects/{id}/updates", new { title = "Invalid", details = "", occurredAt = DateTimeOffset.UtcNow })).StatusCode);
        (await owner.PutAsJsonAsync($"/api/projects/{id}/stages", new[] { new { name = "New stage" } })).EnsureSuccessStatusCode();
        (await owner.PutAsJsonAsync($"/api/projects/{id}/stages", Array.Empty<object>())).EnsureSuccessStatusCode();
    }

}
