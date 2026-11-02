using ProjectHub.Application;
using ProjectHub.Infrastructure;

namespace ProjectHub.WebAPI;

public static class ApplicationServiceCollectionExtensions
{
    public static IServiceCollection AddPortalApplication(this IServiceCollection services)
    {
        services.AddScoped<ProjectAccess>();
        services.AddScoped<ProjectWriteAccess>();
        services.AddScoped<ClientQueries>();
        services.AddScoped<NoteQueries>();
        services.AddScoped<ProjectQueries>();
        services.AddScoped<ProjectResources>();
        services.AddScoped<ProjectCommands>();
        services.AddScoped<ProjectCodeAllocator>();
        services.AddScoped<ClientService>();
        services.AddScoped<AuthService>();
        services.AddScoped<FileService>();
        services.AddScoped<UploadService>();
        services.AddScoped<DownloadService>();
        services.AddScoped<FolderService>();
        services.AddScoped<FolderTree>();
        services.AddScoped<FileDeletion>();
        services.AddScoped<StageService>();
        services.AddScoped<ActivityService>();
        services.AddScoped<WorkspaceService>();
        return services;
    }
}
