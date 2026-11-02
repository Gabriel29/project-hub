using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using ProjectHub.Application;

namespace ProjectHub.Infrastructure;

public static class DatabaseInitializationExtensions
{
    public static async Task InitializeProjectHubDatabaseAsync(this IServiceProvider services, CancellationToken ct = default)
    {
        await using var scope = services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<PostgresMigrationRunner>().RunAsync(ct);
        var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(71450286)", ct);
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in new[] { PortalRoles.Owner, PortalRoles.Admin, PortalRoles.Client })
        {
            if (await roles.RoleExistsAsync(role))
            {
                continue;
            }

            var result = await roles.CreateAsync(new IdentityRole(role));
            if (!result.Succeeded)
            {
                throw new InvalidOperationException("Required role initialization failed.");
            }
        }
        await transaction.CommitAsync(ct);
        services.GetRequiredService<ILoggerFactory>().CreateLogger("ProjectHub.Infrastructure.DatabaseInitialization")
            .LogInformation("PostgreSQL migrations and application roles are ready.");
    }
}
