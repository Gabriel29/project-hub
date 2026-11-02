using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Xunit;

namespace ProjectHub.Tests;

public partial class PortalFlowTests
{
    [Theory]
    [InlineData("en", "Invalid email.", "Sign in required.", "Access denied.", "Invalid value.", "This email is already in use.")]
    [InlineData("ro", "Email invalid.", "Autentificare necesară.", "Acces interzis.", "Valoare invalidă.", "Emailul este deja folosit.")]
    [InlineData("fr", "Invalid email.", "Sign in required.", "Access denied.", "Invalid value.", "This email is already in use.")]
    [InlineData("ro-RO", "Email invalid.", "Autentificare necesară.", "Acces interzis.", "Valoare invalidă.", "Emailul este deja folosit.")]
    public async Task ApiErrorsUseRequestedLanguageAndStableCodes(string language, string emailError, string signInError, string accessError, string valueError, string duplicateError)
    {
        using var factory = new PortalFactory();
        using var owner = Client(factory);
        using var anonymous = Client(factory);
        owner.DefaultRequestHeaders.AcceptLanguage.ParseAdd(language);
        anonymous.DefaultRequestHeaders.AcceptLanguage.ParseAdd(language);
        await SetupAsync(owner);

        var response = await owner.PostAsJsonAsync("/api/admin/users", new { name = "Test", admin = true, email = "invalid" });
        await AssertLocalizedProblem(response, HttpStatusCode.BadRequest, "invalidEmail", emailError);
        await AssertLocalizedProblem(await anonymous.GetAsync("/api/projects?culture=ro&ui-culture=ro"), HttpStatusCode.Unauthorized, "signInRequired", signInError);
        anonymous.DefaultRequestHeaders.Remove("X-ProjectHub-Request");
        await AssertLocalizedProblem(await anonymous.PostAsJsonAsync("/api/auth/login", new { email = "a@example.test", password = "password1" }), HttpStatusCode.Forbidden, "accessDenied", accessError);

        response = await owner.PostAsync("/api/projects", new StringContent("null", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.All(problem.GetProperty("errors").EnumerateObject().SelectMany(field => field.Value.EnumerateArray()), error => Assert.Equal(valueError, error.GetString()));

        // ASP.NET Identity failures also use stable codes rather than English descriptions.
        await Post(owner, "/api/admin/users", new { name = "First", admin = true, email = "duplicate@example.test" });
        response = await owner.PostAsJsonAsync("/api/admin/users", new { name = "Second", admin = true, email = "duplicate@example.test" });
        await AssertLocalizedProblem(response, HttpStatusCode.BadRequest, "emailInUse", duplicateError);
    }

    [Theory]
    [InlineData("en", "The portal is under maintenance. We will be back soon.")]
    [InlineData("ro", "Portalul este în mentenanță. Revenim în curând.")]
    public async Task MaintenanceErrorsAreLocalized(string language, string expected)
    {
        using var factory = new PortalFactory(maintenance: true);
        using var client = Client(factory);
        client.DefaultRequestHeaders.AcceptLanguage.ParseAdd(language);
        await AssertLocalizedProblem(await client.GetAsync("/api/projects"), HttpStatusCode.ServiceUnavailable, "maintenance", expected);
    }

    private static async Task AssertLocalizedProblem(HttpResponseMessage response, HttpStatusCode status, string code, string detail)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(code, problem.GetProperty("code").GetString());
        Assert.False(string.IsNullOrWhiteSpace(problem.GetProperty("traceId").GetString()));
        Assert.Equal(detail, problem.GetProperty("detail").GetString());
    }
}
