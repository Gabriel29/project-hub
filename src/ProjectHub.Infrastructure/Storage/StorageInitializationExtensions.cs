using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using ProjectHub.Application;

namespace ProjectHub.Infrastructure;

public static class StorageInitializationExtensions
{
    public static async Task InitializeProjectHubStorageAsync(this IServiceProvider services, IConfiguration configuration, CancellationToken ct = default)
    {
        if (configuration.GetValue<bool>("CREATE_STORAGE_BUCKET_ON_STARTUP"))
        {
            var s3 = services.GetRequiredService<IAmazonS3>();
            var options = services.GetRequiredService<InfrastructureOptions>();
            await CreateBucketAsync(s3, options.StorageBucket, ct);
        }
        if (configuration.GetValue<bool>("VERIFY_STORAGE_ON_STARTUP"))
        {
            await VerifyStorageAsync(services.GetRequiredService<IFileStorage>(), ct);
            services.GetRequiredService<ILoggerFactory>().CreateLogger("ProjectHub.Infrastructure.StorageInitialization")
                .LogInformation("Private storage upload/download verification passed.");
        }
    }

    private static async Task CreateBucketAsync(IAmazonS3 s3, string bucket, CancellationToken ct)
    {
        try
        {
            await s3.PutBucketAsync(new PutBucketRequest { BucketName = bucket, UseClientRegion = true }, ct);
        }
        catch (AmazonS3Exception exception) when (exception.ErrorCode == "BucketAlreadyOwnedByYou")
        {
            // Repeated startup may reuse a bucket owned by this deployment.
        }
    }

    private static async Task VerifyStorageAsync(IFileStorage storage, CancellationToken ct)
    {
        var key = $"_healthchecks/{Guid.NewGuid():N}";
        var bytes = "%PDF-1.7\nProjectHub storage verification"u8.ToArray();
        var uploaded = false;
        try
        {
            using var body = new MemoryStream(bytes);
            await storage.PutAsync(key, body, "application/pdf", ct);
            uploaded = true;
            var result = await storage.GetAsync(key, ct);
            using (result.Owner)
            using (var received = new MemoryStream())
            {
                await result.Body.CopyToAsync(received, ct);
                if (!received.ToArray().AsSpan().SequenceEqual(bytes))
                {
                    throw new InvalidOperationException("Storage verification returned unexpected bytes.");
                }
            }
        }
        finally
        {
            // Cleanup must still run if startup cancellation occurs after the object was uploaded.
            if (uploaded)
            {
                await storage.DeleteAsync(key, CancellationToken.None);
            }
        }
    }
}
