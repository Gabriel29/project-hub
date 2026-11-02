using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace ProjectHub.Tests;

public partial class PortalFlowTests
{
    private string managerId = "";

    private object ProjectBody(string code, Guid? clientId) => new
    {
        name = "Integration project",
        location = "București",
        description = "Descriere proiect",
        clientId,
        managerUserId = managerId
    };

    private async Task SetupAsync(HttpClient owner)
    {
        await Post(owner, "/api/auth/setup", new { token = "test-bootstrap-only", email = "owner@example.test", name = "Owner", password = "owner1" });
        managerId = (await owner.GetFromJsonAsync<JsonElement>("/api/auth/me")).GetProperty("id").GetString()!;
    }

    private static async Task<JsonElement> InviteAdminAsync(HttpClient owner, HttpClient admin)
    {
        var account = await Post(owner, "/api/admin/users", new { name = "Admin", admin = true, email = "admin@example.test" });
        await Post(admin, "/api/auth/activate", new { token = Token(account), email = "admin@example.test", password = "admin1" });
        return account;
    }

    private static string Token(JsonElement person) => person.GetProperty("link").GetProperty("url").GetString()!.Split('=')[1];

    private static HttpClient Client(PortalFactory factory)
    {
        var client = factory.CreateClient(new() { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Add("X-ProjectHub-Request", "1");
        return client;
    }

    private static async Task<JsonElement> Post(HttpClient client, string path, object body)
    {
        if (path == "/api/admin/users")
        {
            var request = JsonSerializer.SerializeToNode(body)!.AsObject();
            if (request["admin"]?.GetValue<bool>() != true)
            {
                request["clientName"] ??= request["name"]!.GetValue<string>();
                request["email"] ??= $"invite-{Guid.NewGuid():N}@example.test";
            }

            body = request;
        }

        var res = await client.PostAsJsonAsync(path, body);
        Assert.True(res.IsSuccessStatusCode, $"{path}: {res.StatusCode} {await res.Content.ReadAsStringAsync()}");
        var text = await res.Content.ReadAsStringAsync();
        return text.Length == 0 ? default : JsonSerializer.Deserialize<JsonElement>(text);
    }

    private static async Task<JsonElement> UploadAsync(HttpClient client, string projectId, string? fileId, string? folderId = null, bool photo = false, string? sectionKey = null, bool viaExplorer = false)
    {
        using var form = new MultipartFormDataContent();
        form.Add(new StringContent("Test plan"), "title");
        // Browser FormData includes an empty optional description; MVC must not reject it as required.
        form.Add(new StringContent(""), "description");
        if (sectionKey != null)
        {
            form.Add(new StringContent(sectionKey), "sectionKey");
        }

        if (photo && !viaExplorer)
        {
            form.Add(new StringContent("true"), "calendarPhoto");
        }

        if (folderId != null)
        {
            form.Add(new StringContent(folderId), "folderId");
        }

        if (fileId != null)
        {
            form.Add(new StringContent(fileId), "fileId");
        }

        form.Add(new ByteArrayContent(photo ? new byte[] { 137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0 } : "%PDF-1.7\nIntegration test file"u8.ToArray()), "file", photo ? "photo.png" : "plan.pdf");
        var res = await client.PostAsync($"/api/projects/{projectId}/files", form);
        Assert.True(res.IsSuccessStatusCode, await res.Content.ReadAsStringAsync());
        return await res.Content.ReadFromJsonAsync<JsonElement>();
    }
}
