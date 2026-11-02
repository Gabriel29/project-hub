using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace ProjectHub.Tests;

public partial class PortalFlowTests
{
    [Fact]
    public async Task MaintenanceBlocksPortal()
    {
        using (var maintenance = new PortalFactory(true))
        {
            using var http = Client(maintenance);
            Assert.Equal(HttpStatusCode.ServiceUnavailable, (await http.GetAsync("/api/auth/setup-status")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await http.GetAsync("/health")).StatusCode);
        }
    }

    [Fact]
    public async Task NotesAreSharedByManagersAndMaintenanceIsDocumentOnly()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var admin = Client(factory);
        using var client = Client(factory);
        await SetupAsync(owner);
        await InviteAdminAsync(owner, admin);
        var person = await Post(owner, "/api/admin/users", new { name = "Client" });
        await Post(client, "/api/auth/activate", new { token = Token(person), email = "client@example.test", password = "client1" });
        var project = await Post(owner, "/api/projects", ProjectBody("RECORDS", person.GetProperty("clientId").GetGuid()));
        var pid = project.GetProperty("id").GetString()!;
        await Post(owner, $"/api/projects/{pid}/notes", new { title = "Private", body = "Managers only" });
        var notes = await owner.GetFromJsonAsync<JsonElement>($"/api/projects/{pid}/notes");
        var note = notes[0].GetProperty("id").GetGuid();
        foreach (var http in new[]
        {
            client
        }

        )
        {
            Assert.Equal(HttpStatusCode.Forbidden, (await http.GetAsync($"/api/projects/{pid}/notes")).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await http.PostAsJsonAsync($"/api/projects/{pid}/notes", new { title = "Forbidden", body = "" })).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await http.PutAsJsonAsync($"/api/projects/{pid}/notes/{note}", new { title = "Forbidden", body = "" })).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await http.DeleteAsync($"/api/projects/{pid}/notes/{note}")).StatusCode);
        }

        notes = await admin.GetFromJsonAsync<JsonElement>($"/api/projects/{pid}/notes");
        Assert.Single(notes.EnumerateArray());
        (await admin.PutAsJsonAsync($"/api/projects/{pid}/notes/{note}", new { title = "Admin edited", body = "Shared" })).EnsureSuccessStatusCode();
        await Post(admin, $"/api/projects/{pid}/notes", new { title = "Admin note", body = "Shared with owner" });
        notes = await owner.GetFromJsonAsync<JsonElement>($"/api/projects/{pid}/notes");
        var adminNote = notes.EnumerateArray().Single(n => n.GetProperty("title").GetString() == "Admin note").GetProperty("id").GetGuid();
        (await admin.DeleteAsync($"/api/projects/{pid}/notes/{adminNote}")).EnsureSuccessStatusCode();

        (await owner.PutAsJsonAsync($"/api/projects/{pid}/notes/{note}", new { title = "Updated", body = "New body" })).EnsureSuccessStatusCode();
        notes = await owner.GetFromJsonAsync<JsonElement>($"/api/projects/{pid}/notes");
        Assert.Equal("New body", notes[0].GetProperty("body").GetString());
        var detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        Assert.False(detail.TryGetProperty("notes", out _));
        Assert.Empty(detail.GetProperty("events").EnumerateArray());
        var upload = await UploadAsync(admin, pid, null, sectionKey: "maintenance");
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/projects/{pid}/files/{upload.GetProperty("id").GetString()}/content")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/projects/{pid}/interventions")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.PostAsJsonAsync($"/api/projects/{pid}/interventions", new { title = "Retired" })).StatusCode);
    }

    [Fact]
    public async Task MaintenanceDateIsOptionalForManagersAndIndependentOfProjectEditing()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var client = Client(factory);
        await SetupAsync(owner);
        var person = await Post(owner, "/api/admin/users", new { name = "Client" });
        await Post(client, "/api/auth/activate", new { token = Token(person), email = "client@example.test", password = "client1" });
        var project = await Post(owner, "/api/projects", ProjectBody("Maintenance", person.GetProperty("clientId").GetGuid()));
        var pid = project.GetProperty("id").GetString()!;
        var body = new
        {
            name = "Maintenance",
            location = "",
            description = "Date only",
            clientId = person.GetProperty("clientId").GetGuid(),
            managerUserId = managerId,
            nextMaintenanceDate = (string?)"2027-04-15"
        };
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync($"/api/projects/{pid}", body)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync($"/api/projects/{pid}/maintenance-date", new { date = "2027-04-15" })).StatusCode);
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/maintenance-date", new { date = "2027-04-15" })).EnsureSuccessStatusCode();
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/maintenance-date", new { date = (string?)null })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NotFound, (await owner.PutAsJsonAsync($"/api/projects/{Guid.NewGuid()}/maintenance-date", new { date = "2027-04-15" })).StatusCode);
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/maintenance-date", new { date = "2027-04-15" })).EnsureSuccessStatusCode();
        (await owner.PutAsJsonAsync($"/api/projects/{pid}", body with { nextMaintenanceDate = (string?)null })).EnsureSuccessStatusCode();
        var detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        Assert.Equal("2027-04-15", detail.GetProperty("project").GetProperty("nextMaintenanceDate").GetString());
        Assert.Equal("Maintenance", detail.GetProperty("project").GetProperty("name").GetString());
        using var admin = Client(factory);
        await InviteAdminAsync(owner, admin);
        (await admin.PutAsJsonAsync($"/api/projects/{pid}/maintenance-date", new { date = "2028-01-01" })).EnsureSuccessStatusCode();
        detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        Assert.Equal("2028-01-01", detail.GetProperty("project").GetProperty("nextMaintenanceDate").GetString());
        (await admin.PutAsJsonAsync($"/api/projects/{pid}/maintenance-date", new { date = (string?)null })).EnsureSuccessStatusCode();
        detail = await ProjectDataAsync(owner, $"/api/projects/{pid}");
        Assert.Equal(JsonValueKind.Null, detail.GetProperty("project").GetProperty("nextMaintenanceDate").ValueKind);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PutAsJsonAsync($"/api/projects/{Guid.NewGuid()}/maintenance-date", new { date = "2028-01-01" })).StatusCode);
        (await owner.PutAsJsonAsync($"/api/projects/{pid}/maintenance-date", new { date = (string?)null })).EnsureSuccessStatusCode();
        detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        Assert.Equal(JsonValueKind.Null, detail.GetProperty("project").GetProperty("nextMaintenanceDate").ValueKind);
        var document = await UploadAsync(owner, pid, null, sectionKey: "progress");
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/projects/{pid}/files/{document.GetProperty("id").GetString()}/content")).StatusCode);
        await Post(owner, $"/api/projects/{pid}/updates", new { title = "Document activity", details = "Description", photoIds = new[] { document.GetProperty("contentId").GetGuid() } });
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/projects/{pid}/files/{document.GetProperty("id").GetString()}/content")).StatusCode);
        detail = await ProjectDataAsync(client, $"/api/projects/{pid}");
        Assert.NotEqual(default, detail.GetProperty("updates")[0].GetProperty("occurredAt").GetDateTimeOffset());
    }

}
