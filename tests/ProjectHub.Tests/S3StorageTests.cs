using System.Net;
using Amazon.Runtime;
using Amazon.S3;
using ProjectHub.Infrastructure;
using Xunit;

namespace ProjectHub.Tests;

public class S3StorageTests
{
    [Fact]
    public async Task SendsStandardSignedPayloadWithoutAwsChunkedEncoding()
    {
        var handler = new CaptureHandler();
        using var s3 = new AmazonS3Client("test-access-key", "test-secret-key", new AmazonS3Config { ServiceURL = "https://storage.example.test", AuthenticationRegion = "auto", ForcePathStyle = false, HttpClientFactory = new CaptureClientFactory(handler) });
        var storage = new S3Storage(s3, "test-bucket");
        var bytes = "%PDF-1.7\nStorage wire-format verification"u8.ToArray();
        using var stream = new MemoryStream(bytes);
        await storage.PutAsync("checks/plan.pdf", stream, "application/pdf", CancellationToken.None);
        Assert.DoesNotContain("aws-chunked", handler.Headers, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(bytes, handler.Body);
        Assert.Contains("AWS4-HMAC-SHA256", handler.Headers);
        Assert.Contains("application/pdf", handler.Headers);
    }
}

internal sealed class CaptureClientFactory(CaptureHandler handler) : HttpClientFactory
{
    public override HttpClient CreateHttpClient(IClientConfig clientConfig) => new(handler, disposeHandler: false);
}

internal sealed class CaptureHandler : HttpMessageHandler
{
    public string Headers { get; private set; } = "";
    public byte[] Body { get; private set; } = [];

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        Headers = request.Headers + "\n" + request.Content?.Headers;
        Body = request.Content is null ? [] : await request.Content.ReadAsByteArrayAsync(ct);
        var response = new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(""),
            RequestMessage = request
        };
        response.Headers.TryAddWithoutValidation("ETag", "\"test-etag\"");
        return response;
    }
}
