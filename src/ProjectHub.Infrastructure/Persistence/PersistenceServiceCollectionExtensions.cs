using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ProjectHub.Infrastructure;

internal static class PersistenceServiceCollectionExtensions
{
    internal static IServiceCollection AddProjectHubPersistence(this IServiceCollection services, InfrastructureOptions options)
    {
        var database = options.ConnectionString;
        services.AddSingleton(new PostgresMigrationRunner(database));
        services.AddDbContext<PortalDb>(o => o.UseNpgsql(database));
        services.AddDataProtection().SetApplicationName("ProjectHubPortal").PersistKeysToDbContext<PortalDb>();
        return services;
    }
}
