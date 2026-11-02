using System.Net;
using System.Net.Http.Json;
using Xunit;
namespace ProjectHub.Tests;

public partial class PortalFlowTests
{
    [Fact]
    public async Task MaintenanceAndRateLimitResponsesUseProblemDetails()
    {
        using (var maintenance = new PortalFactory(maintenance: true))
        {
            using var client = Client(maintenance);
            var response = await client.GetAsync("/api/projects");
            await AssertProblem(response, HttpStatusCode.ServiceUnavailable, "maintenance");
            Assert.Equal("300", response.Headers.GetValues("Retry-After").Single());
        }
        using var factory = new PortalFactory(); using var anonymous = Client(factory);
        for (var attempt = 0; attempt < 20; attempt++)
        {
            var response = await anonymous.PostAsJsonAsync("/api/auth/login", new { email = "unknown@example.test", password = "password1" });
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
        await AssertProblem(await anonymous.PostAsJsonAsync("/api/auth/login", new { email = "unknown@example.test", password = "password1" }), HttpStatusCode.TooManyRequests, "rateLimited");
    }
}
