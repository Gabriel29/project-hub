using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace ProjectHub.Tests;

public partial class PortalFlowTests
{
    [Fact]
    public async Task AdminsActivateByInvitationAndOnlyOwnerManagesTheirRecovery()
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var admin = Client(factory);
        using var anonymous = Client(factory);
        await SetupAsync(owner);
        var account = await Post(owner, "/api/admin/users", new { name = "Invited admin", admin = true, email = "admin@example.test" });
        var id = account.GetProperty("id").GetString();
        Assert.Equal(JsonValueKind.Null, account.GetProperty("clientId").ValueKind);
        Assert.Equal(HttpStatusCode.Unauthorized, (await admin.PostAsJsonAsync("/api/auth/login", new { email = "admin@example.test", password = "admin1" })).StatusCode);
        var people = await owner.GetFromJsonAsync<JsonElement>("/api/admin/users");
        Assert.False(people.EnumerateArray().Single(u => u.GetProperty("id").GetString() == id).GetProperty("hasPassword").GetBoolean());
        var token = Token(account);
        var details = await Post(anonymous, "/api/auth/activation-details", new { token });
        Assert.Equal("Invited admin", details.GetProperty("name").GetString());
        var replacement = await Post(owner, $"/api/admin/users/{id}/activation", new { });
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync("/api/auth/activation-details", new { token })).StatusCode);
        token = replacement.GetProperty("url").GetString()!.Split('=')[1];
        await Post(admin, "/api/auth/activate", new { token, name = "Confirmed admin", email = "admin@example.test", password = "admin1", phoneNumber = "0722123456", language = "ro" });
        var me = await admin.GetFromJsonAsync<JsonElement>("/api/auth/me");
        Assert.Contains(me.GetProperty("roles").EnumerateArray(), r => r.GetString() == "Admin");
        Assert.True(me.GetProperty("hasPassword").GetBoolean());
        Assert.Equal("Confirmed admin", me.GetProperty("displayName").GetString());
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync("/api/auth/activate", new { token, email = "admin@example.test", password = "admin1" })).StatusCode);
        foreach (var action in new[] { "activation", "reset", "revoke-links" })
        {
            Assert.Equal(HttpStatusCode.Forbidden, (await admin.PostAsJsonAsync($"/api/admin/users/{id}/{action}", new { })).StatusCode);
        }

        var peer = await Post(owner, "/api/admin/users", new { name = "Peer", admin = true, email = "peer@example.test" });
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.PostAsJsonAsync($"/api/admin/users/{peer.GetProperty("id").GetString()}/activation", new { })).StatusCode);
        var reset = await Post(owner, $"/api/admin/users/{id}/reset", new { });
        var resetToken = reset.GetProperty("url").GetString()!.Split('=')[1];
        await Post(owner, $"/api/admin/users/{id}/revoke-links", new { });
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync("/api/auth/reset", new { token = resetToken, password = "admin2" })).StatusCode);
        reset = await Post(owner, $"/api/admin/users/{id}/reset", new { });
        resetToken = reset.GetProperty("url").GetString()!.Split('=')[1];
        await Post(anonymous, "/api/auth/reset", new { token = resetToken, password = "admin2" });
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync("/api/auth/reset", new { token = resetToken, password = "admin3" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync("/api/auth/login", new { email = "admin@example.test", password = "admin1" })).StatusCode);
        await Post(anonymous, "/api/auth/login", new { email = "admin@example.test", password = "admin2" });
    }
}
