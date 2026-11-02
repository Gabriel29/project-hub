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
    public async Task AccessLinkStatusTracksReplacementConsumptionRevocationAndExpiry()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var client = Client(factory);
        await SetupAsync(owner);
        var person = await Post(owner, "/api/admin/users", new { name = "Client" });
        var uid = person.GetProperty("id").GetString()!;
        async Task<bool> HasLink() => (await owner.GetFromJsonAsync<JsonElement>("/api/admin/users")).EnumerateArray().Single(u => u.GetProperty("id").GetString() == uid).GetProperty("activeLinkExpiresAt").ValueKind != JsonValueKind.Null;
        Assert.True(await HasLink());
        var replacements = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => Post(owner, $"/api/admin/users/{uid}/activation", new { })));
        string token;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
            var live = await db.AccessLinks.SingleAsync(l => l.UserId == uid && l.RevokedAt == null && l.ConsumedAt == null);
            token = replacements.Single(l => l.GetProperty("id").GetGuid() == live.Id).GetProperty("url").GetString()!.Split('=')[1];
        }

        await Post(client, "/api/auth/activate", new { token, email = "client@example.test", password = "client1" });
        Assert.False(await HasLink());
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsJsonAsync($"/api/admin/users/{uid}/activation", new { })).StatusCode);
        var reset = await Post(owner, $"/api/admin/users/{uid}/reset", new { });
        Assert.True(await HasLink());
        await Post(owner, $"/api/admin/users/{uid}/revoke-links", new { });
        Assert.False(await HasLink());
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/reset", new { token = reset.GetProperty("url").GetString()!.Split('=')[1], password = "newone1" })).StatusCode);
        // Revoking a link does not sign out the account's current session.
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);
        await Post(owner, $"/api/admin/users/{uid}/reset", new { });
        using (var scope = factory.Services.CreateScope())
        {
            await scope.ServiceProvider.GetRequiredService<PortalDb>().AccessLinks.Where(l => l.UserId == uid).ExecuteUpdateAsync(s => s.SetProperty(l => l.ExpiresAt, DateTimeOffset.UtcNow.AddSeconds(-1)));
        }

        Assert.False(await HasLink());
    }

    [Fact]
    public async Task LanguageIsChosenByTheUserDuringActivationAndProfileChanges()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var client = Client(factory);
        await SetupAsync(owner);
        Assert.Equal("en", (await owner.GetFromJsonAsync<JsonElement>("/api/auth/me")).GetProperty("language").GetString());
        var person = await Post(owner, "/api/admin/users", new { name = "Client", language = "ro" });
        Assert.Equal("en", (await owner.GetFromJsonAsync<JsonElement>("/api/admin/users")).EnumerateArray().Single(u => u.GetProperty("id").GetString() == person.GetProperty("id").GetString()).GetProperty("language").GetString());
        var token = Token(person);
        Assert.Equal("en", (await Post(client, "/api/auth/activation-details", new { token })).GetProperty("language").GetString());
        await Post(client, "/api/auth/activate", new { token, email = "client@example.test", password = "client1", language = "ro" });
        Assert.Equal("ro", (await client.GetFromJsonAsync<JsonElement>("/api/auth/me")).GetProperty("language").GetString());
        foreach (var language in new[]
        {
            "en",
            "ro"
        }

        )
        {
            (await client.PutAsJsonAsync("/api/auth/profile", new { name = "Client", email = "client@example.test", currentPassword = "client1", language })).EnsureSuccessStatusCode();
            Assert.Equal(language, (await client.GetFromJsonAsync<JsonElement>("/api/auth/me")).GetProperty("language").GetString());
        }

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("/api/auth/profile", new { name = "Client", email = "client@example.test", currentPassword = "client1", language = "fr" })).StatusCode);
        (await client.PutAsJsonAsync("/api/auth/profile", new { name = "Client", email = "client@example.test", currentPassword = "client1" })).EnsureSuccessStatusCode();
        Assert.Equal("ro", (await client.GetFromJsonAsync<JsonElement>("/api/auth/me")).GetProperty("language").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsJsonAsync("/api/admin/users", new { name = "Invalid", language = "invalid" })).StatusCode);
    }

    [Fact]
    public async Task ActivationAndResetAreSingleUseAndDoNotChangeEmail()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var client = Client(factory);
        using var anonymous = Client(factory);
        await SetupAsync(owner);
        var person = await Post(owner, "/api/admin/users", new { name = "Client" });
        var uid = person.GetProperty("id").GetString();
        var token = Token(person);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/auth/activate", new { token, email = "client@example.test", password = "abcdef" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/auth/activate", new { token, email = "owner@example.test", password = "client1" })).StatusCode);
        await Post(client, "/api/auth/activate", new { token, email = "client@example.test", password = "client1" });
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync("/api/auth/activate", new { token, email = "x@example.test", password = "client1" })).StatusCode);
        var first = await Post(owner, $"/api/admin/users/{uid}/reset", new { });
        var second = await Post(owner, $"/api/admin/users/{uid}/reset", new { });
        var oldToken = first.GetProperty("url").GetString()!.Split('=')[1];
        var reset = second.GetProperty("url").GetString()!.Split('=')[1];
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync("/api/auth/reset", new { token = oldToken, password = "newone1" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await anonymous.PostAsJsonAsync("/api/auth/reset", new { token = reset, email = "changed@example.test", password = "newone1" })).StatusCode);
        var attempts = await Task.WhenAll(anonymous.PostAsJsonAsync("/api/auth/reset", new { token = reset, password = "newone1" }), anonymous.PostAsJsonAsync("/api/auth/reset", new { token = reset, password = "newone1" }));
        Assert.Single(attempts, r => r.IsSuccessStatusCode);
        Assert.Single(attempts, r => r.StatusCode == HttpStatusCode.Unauthorized);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new { email = "client@example.test", password = "client1" })).StatusCode);
        await Post(client, "/api/auth/login", new { email = "client@example.test", password = "newone1" });
        Assert.Equal("client@example.test", (await client.GetFromJsonAsync<JsonElement>("/api/auth/me")).GetProperty("email").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/auth/password", new { password = "nextone1", currentPassword = "wrong" })).StatusCode);
        await Post(client, "/api/auth/password", new { password = "nextone1", currentPassword = "newone1" });
        await Post(owner, $"/api/admin/users/{uid}/disabled", new { disabled = true });
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task BootstrapExpiryReplacementAndRequestGuards()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var client = Client(factory);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new { email = "admin", password = "admin" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/setup", new { token = "wrong", email = "owner@example.test", name = "Owner", password = "owner1" })).StatusCode);
        using var noHeader = factory.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        Assert.Equal(HttpStatusCode.Forbidden, (await noHeader.PostAsJsonAsync("/api/auth/login", new { email = "admin", password = "admin" })).StatusCode);
        client.DefaultRequestHeaders.Add("Origin", "https://attacker.test");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/auth/login", new { email = "admin", password = "admin" })).StatusCode);
        client.DefaultRequestHeaders.Remove("Origin");
        await SetupAsync(owner);
        Assert.Equal(HttpStatusCode.Conflict, (await owner.PostAsJsonAsync("/api/auth/setup", new { token = "test-bootstrap-only", email = "again@example.test", name = "Owner", password = "owner1" })).StatusCode);
        var project = await Post(owner, "/api/admin/users", new { name = "Client" });
        var id = project.GetProperty("id").GetString();
        var token = Token(project);
        var replacement = await Post(owner, $"/api/admin/users/{id}/activation", new { });
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/activate", new { token, email = "client@example.test", password = "client1" })).StatusCode);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
            await db.AccessLinks.Where(l => l.UserId == id).ExecuteUpdateAsync(s => s.SetProperty(l => l.ExpiresAt, DateTimeOffset.UtcNow.AddHours(-1)));
        }

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/activate", new { token = replacement.GetProperty("url").GetString()!.Split('=')[1], email = "client@example.test", password = "client1" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsJsonAsync("/api/auth/link", new { token })).StatusCode);
    }

    [Fact]
    public async Task BootstrapKeyAloneCreatesOnlyOneOwnerUnderConcurrentRequests()
    {
        using var factory = new PortalFactory();
        using var first = Client(factory);
        using var second = Client(factory);
        Assert.True((await first.GetFromJsonAsync<JsonElement>("/api/auth/setup-status")).GetProperty("required").GetBoolean());
        using (var scope = factory.Services.CreateScope())
        {
            Assert.False(await scope.ServiceProvider.GetRequiredService<PortalDb>().Users.AnyAsync());
        }

        var results = await Task.WhenAll(first.PostAsJsonAsync("/api/auth/setup", new { token = "test-bootstrap-only", email = "first@example.test", name = "First", password = "owner1" }), second.PostAsJsonAsync("/api/auth/setup", new { token = "test-bootstrap-only", email = "second@example.test", name = "Second", password = "owner2" }));
        Assert.Single(results, r => r.IsSuccessStatusCode);
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.False((await first.GetFromJsonAsync<JsonElement>("/api/auth/setup-status")).GetProperty("required").GetBoolean());
    }

    [Fact]
    public async Task InvitationPrefillsContactAndProfileKeepsPrivateClientLabel()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var client = Client(factory);
        using var anonymous = Client(factory);
        await SetupAsync(owner);
        var person = await Post(owner, "/api/admin/users", new { name = "Contact original", clientName = "Vila Nord - identificare", email = "contact@example.test", phoneNumber = "0722123456" });
        var token = Token(person);
        var invitation = await Post(anonymous, "/api/auth/activation-details", new { token });
        Assert.Equal("contact@example.test", invitation.GetProperty("email").GetString());
        Assert.Equal("0722123456", invitation.GetProperty("phoneNumber").GetString());
        Assert.False(invitation.TryGetProperty("clientName", out _));
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync("/api/auth/activation-details", new { token = "invalid" })).StatusCode);
        await Post(client, "/api/auth/activate", new { token, name = "Numele meu", email = "contact@example.test", phoneNumber = "0722123456", password = "client1" });
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync("/api/auth/activation-details", new { token })).StatusCode);
        var profile = new
        {
            name = "Contact actualizat",
            email = "updated@example.test",
            phoneNumber = "0733123456",
            currentPassword = "client1"
        };
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PutAsJsonAsync("/api/auth/profile", profile)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("/api/auth/profile", profile with { currentPassword = "wrong" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("/api/auth/profile", profile with { email = "owner@example.test" })).StatusCode);
        (await client.PutAsJsonAsync("/api/auth/profile", profile)).EnsureSuccessStatusCode();
        var me = await client.GetFromJsonAsync<JsonElement>("/api/auth/me");
        Assert.Equal("Contact actualizat", me.GetProperty("displayName").GetString());
        Assert.False(me.TryGetProperty("userName", out _));
        Assert.Equal(JsonValueKind.Null, me.GetProperty("clientName").ValueKind);
        var users = await owner.GetFromJsonAsync<JsonElement>("/api/admin/users");
        var contact = users.EnumerateArray().Single(u => u.GetProperty("id").GetString() == person.GetProperty("id").GetString());
        Assert.Equal("Vila Nord - identificare", contact.GetProperty("clientName").GetString());
        var clients = await owner.GetFromJsonAsync<JsonElement>("/api/clients");
        Assert.Equal("Vila Nord - identificare", clients[0].GetProperty("displayName").GetString());
        await Post(client, "/api/auth/logout", new { });
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new { email = "contact@example.test", password = "client1" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new { email = "contact-nord", password = "client1" })).StatusCode);
        await Post(client, "/api/auth/login", new { email = "updated@example.test", password = "client1" });
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsJsonAsync("/api/admin/users", new { name = "Missing email", clientName = "Label" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsJsonAsync("/api/admin/users", new { name = "Missing label", email = "other@example.test" })).StatusCode);
    }

}
