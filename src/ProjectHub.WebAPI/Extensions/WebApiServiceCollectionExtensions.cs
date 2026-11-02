using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Localization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Localization;
using ProjectHub.Application;

namespace ProjectHub.WebAPI;

public static class WebApiServiceCollectionExtensions
{
    public static IServiceCollection AddPortalWebApi(this IServiceCollection services)
    {
        services.AddLocalization(options => options.ResourcesPath = "Resources");
        services.Configure<RequestLocalizationOptions>(options =>
        {
            options.SetDefaultCulture("en").AddSupportedCultures("en", "ro").AddSupportedUICultures("en", "ro");
            options.RequestCultureProviders = [new AcceptLanguageHeaderRequestCultureProvider()];
            options.ApplyCurrentCultureToResponseHeaders = true;
        });
        services.AddPortalAuthorization();
        services.AddPortalControllers();
        services.AddPortalRateLimiting();
        return services;
    }

    private static IServiceCollection AddPortalAuthorization(this IServiceCollection services)
    {
        services.AddAuthorization(options =>
        {
            options.AddPolicy(PortalRoles.Manage, p => p.RequireAuthenticatedUser().RequireRole(PortalRoles.Owner, PortalRoles.Admin));
            options.AddPolicy(PortalRoles.Own, p => p.RequireAuthenticatedUser().RequireRole(PortalRoles.Owner));
        });
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, CurrentUser>();
        return services;
    }

    private static IServiceCollection AddPortalControllers(this IServiceCollection services)
    {
        services.AddExceptionHandler<PortalExceptionHandler>();
        services.AddProblemDetails();
        services.AddControllers().ConfigureApiBehaviorOptions(options =>
            options.InvalidModelStateResponseFactory = CreateValidationProblem);
        services.AddOpenApi();
        return services;
    }

    private static IActionResult CreateValidationProblem(ActionContext action)
    {
        var problem = PortalProblems.Create(action.HttpContext, 400, "invalidRequest");
        var localizer = action.HttpContext.RequestServices.GetRequiredService<IStringLocalizer<PortalErrorMessages>>();
        problem.Extensions["errors"] = action.ModelState
            .Where(entry => entry.Value?.Errors.Count > 0)
            .ToDictionary(entry => entry.Key, entry => entry.Value!.Errors
                .Select(_ => localizer["invalidValue"].Value).ToArray());
        return new BadRequestObjectResult(problem) { ContentTypes = { "application/problem+json" } };
    }

    private static IServiceCollection AddPortalRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(o =>
        {
            o.RejectionStatusCode = 429;
            o.OnRejected = async (context, ct) => await PortalProblems.WriteAsync(context.HttpContext, 429);
            o.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
        });
        return services;
    }
}
