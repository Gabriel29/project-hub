using System.Net;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ProjectHub.Application;
using ProjectHub.Infrastructure;
using Xunit;

namespace ProjectHub.Tests;

public class SeaweedStorageTests
{
    [SeaweedStorageFact]
    public async Task StartupCanRepeatAndPrivateObjectsRoundTripAcrossFilerChunks()
    {
        var endpoint = Environment.GetEnvironmentVariable("SEAWEEDFS_TEST_ENDPOINT")!;
        if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var uri) || !uri.IsLoopback)
        {
            throw new InvalidOperationException("SeaweedFS tests require a disposable loopback endpoint.");
        }

        var accessKey = Environment.GetEnvironmentVariable("SEAWEEDFS_TEST_ACCESS_KEY")!;
        var secretKey = Environment.GetEnvironmentVariable("SEAWEEDFS_TEST_SECRET_KEY")!;
        var bucket = "projecthub-test-" + Guid.NewGuid().ToString("N");
        var config = new AmazonS3Config { ServiceURL = endpoint, AuthenticationRegion = "us-east-1", ForcePathStyle = true };
        using var s3 = new AmazonS3Client(accessKey, secretKey, config);
        var storage = new S3Storage(s3, bucket);
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["CREATE_STORAGE_BUCKET_ON_STARTUP"] = "true",
            ["VERIFY_STORAGE_ON_STARTUP"] = "true"
        }).Build();
        using var services = new ServiceCollection().AddLogging()
            .AddSingleton(new InfrastructureOptions("unused", endpoint, accessKey, secretKey, bucket, "us-east-1", true))
            .AddSingleton<IAmazonS3>(s3).AddSingleton<IFileStorage>(storage).BuildServiceProvider();
        const string key = "documents/plan.pdf";
        try
        {
            await services.InitializeProjectHubStorageAsync(configuration);
            await services.InitializeProjectHubStorageAsync(configuration);
            Assert.Empty((await s3.ListObjectsV2Async(new ListObjectsV2Request { BucketName = bucket })).S3Objects);

            // Exceed the filer's default 4 MB chunk size, exercising streamed reads.
            var bytes = System.Security.Cryptography.RandomNumberGenerator.GetBytes(6 * 1024 * 1024);
            using var body = new MemoryStream(bytes);
            await storage.PutAsync(key, body, "application/pdf", CancellationToken.None);
            var stored = await storage.GetAsync(key, CancellationToken.None);
            using (stored.Owner)
            using (var received = new MemoryStream())
            {
                await stored.Body.CopyToAsync(received);
                Assert.Equal("application/pdf", stored.ContentType);
                Assert.Equal(bytes, received.ToArray());
            }

            using var anonymous = new HttpClient();
            using var response = await anonymous.GetAsync($"{endpoint.TrimEnd('/')}/{bucket}/{key}");
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            using var invalid = new AmazonS3Client("invalid-access-key", "invalid-secret-key", config);
            var denied = await Assert.ThrowsAsync<AmazonS3Exception>(() => invalid.GetObjectAsync(bucket, key));
            Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);

            await storage.DeleteAsync(key, CancellationToken.None);
            await storage.DeleteAsync(key, CancellationToken.None);
            var missing = await Assert.ThrowsAsync<AmazonS3Exception>(() => storage.GetAsync(key, CancellationToken.None));
            Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        }
        finally
        {
            await storage.DeleteAsync(key, CancellationToken.None);
            await s3.DeleteBucketAsync(bucket);
        }
    }

    private sealed class SeaweedStorageFactAttribute : FactAttribute
    {
        public SeaweedStorageFactAttribute()
        {
            if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("SEAWEEDFS_TEST_ENDPOINT")))
            {
                Skip = "Set SEAWEEDFS_TEST_ENDPOINT and SEAWEEDFS_TEST_ACCESS_KEY/SECRET_KEY to test disposable local SeaweedFS.";
            }
        }
    }
}
