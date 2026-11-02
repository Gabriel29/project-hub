using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ProjectHub.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddProjectHubInfrastructure(this IServiceCollection services, IConfiguration configuration, bool development)
    {
        var options = InfrastructureOptions.Read(configuration);
        services.AddSingleton(options);
        return services
            .AddProjectHubPersistence(options)
            .AddProjectHubIdentity(development)
            .AddProjectHubStorage(options);
    }
}
