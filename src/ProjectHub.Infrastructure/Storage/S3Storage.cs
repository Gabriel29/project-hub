using Amazon.S3;
using Amazon.S3.Model;
using ProjectHub.Application;

namespace ProjectHub.Infrastructure;

public sealed class S3Storage(IAmazonS3 s3, string bucket) : IFileStorage
{
    public async Task PutAsync(string key, Stream body, string contentType, CancellationToken ct) => await s3.PutObjectAsync(new PutObjectRequest { BucketName = bucket, Key = key, InputStream = body, ContentType = contentType, AutoCloseStream = false, UseChunkEncoding = false }, ct);

    public async Task<StoredFile> GetAsync(string key, CancellationToken ct)
    {
        var response = await s3.GetObjectAsync(bucket, key, ct);
        return new(response.ResponseStream, response.Headers.ContentType, response);
    }

    public async Task DeleteAsync(string key, CancellationToken ct) => await s3.DeleteObjectAsync(bucket, key, ct);
}
