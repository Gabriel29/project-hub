using ProjectHub.Infrastructure;

namespace ProjectHub.WebAPI;

public static class StartupInitialization
{
    public static async Task InitializePortalAsync(this WebApplication app, CancellationToken ct = default)
    {
        if (!app.Configuration.GetValue<bool>("MAINTENANCE_MODE"))
        {
            await app.Services.InitializeProjectHubDatabaseAsync(ct);
        }
        await app.Services.InitializeProjectHubStorageAsync(app.Configuration, ct);
    }
}
