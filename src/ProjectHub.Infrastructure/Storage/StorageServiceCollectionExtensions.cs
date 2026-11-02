using Amazon.S3;
using Microsoft.Extensions.DependencyInjection;
using ProjectHub.Application;

namespace ProjectHub.Infrastructure;

internal static class StorageServiceCollectionExtensions
{
    internal static IServiceCollection AddProjectHubStorage(this IServiceCollection services, InfrastructureOptions options)
    {
        services.AddSingleton<IAmazonS3>(_ => new AmazonS3Client(options.StorageAccessKey, options.StorageSecretKey, new AmazonS3Config { ServiceURL = options.StorageEndpoint, ForcePathStyle = options.ForcePathStyle, AuthenticationRegion = options.StorageRegion }));
        services.AddSingleton<IFileStorage>(s => new S3Storage(s.GetRequiredService<IAmazonS3>(), options.StorageBucket));
        services.AddSingleton<IUploadRecovery, UploadRecovery>();
        services.AddScoped<StorageCleanupBatch>();
        services.AddHostedService<StorageCleanupWorker>();
        return services;
    }
}
