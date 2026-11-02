using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ProjectHub.Application;

namespace ProjectHub.Infrastructure;

internal static class IdentityServiceCollectionExtensions
{
    internal static IServiceCollection AddProjectHubIdentity(this IServiceCollection services, bool development)
    {
        services.AddIdentity<PortalUser, IdentityRole>(o =>
        {
            // PostgreSQL enforces normalized-email uniqueness for pending and activated accounts.
            o.User.RequireUniqueEmail = false;
            o.Password.RequiredLength = 6;
            o.Password.RequireUppercase = false;
            o.Password.RequireLowercase = false;
            o.Password.RequireNonAlphanumeric = false;
            o.Lockout.MaxFailedAccessAttempts = 5;
            o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        }).AddEntityFrameworkStores<PortalDb>().AddDefaultTokenProviders();
        services.ConfigureApplicationCookie(o =>
        {
            o.Cookie.Name = "projecthub.session";
            o.Cookie.HttpOnly = true;
            o.Cookie.SameSite = SameSiteMode.Strict;
            o.Cookie.SecurePolicy = development ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
            o.ExpireTimeSpan = TimeSpan.FromHours(8);
            o.SlidingExpiration = false;
            o.Events.OnRedirectToLogin = c =>
            {
                c.Response.StatusCode = 401;
                return Task.CompletedTask;
            };
            o.Events.OnRedirectToAccessDenied = c =>
            {
                c.Response.StatusCode = 403;
                return Task.CompletedTask;
            };
        });
        services.Configure<SecurityStampValidatorOptions>(o => o.ValidationInterval = TimeSpan.Zero);
        services.AddScoped<IIdentityGateway, IdentityGateway>();
        return services;
    }
}
