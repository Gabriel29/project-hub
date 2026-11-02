using Microsoft.Extensions.Configuration;
using Npgsql;
using ProjectHub.Infrastructure;
using Xunit;
namespace ProjectHub.Tests;

public sealed class InfrastructureConfigurationTests
{
    [Theory]
    [InlineData("verify-full", SslMode.VerifyFull)]
    [InlineData("require", SslMode.Require)]
    [InlineData("disable", SslMode.Disable)]
    public void PreservesPostgresUrlSslModeAndEncodedCredentials(string sslMode, SslMode expected)
    {
        var configuration = Settings();
        configuration["DATABASE_URL"] = $"postgresql://user:pass%3Aword@localhost/projecthub_test?sslmode={sslMode}";
        var options = InfrastructureOptions.Read(configuration);
        var connection = new NpgsqlConnectionStringBuilder(options.ConnectionString);
        Assert.Equal(expected, connection.SslMode); Assert.Equal("pass:word", connection.Password); Assert.Equal(5432, connection.Port);
        Assert.DoesNotContain("pass:word", options.ToString()); Assert.DoesNotContain("test-secret", options.ToString());
    }

    [Fact]
    public void RejectsMissingStorageAndMalformedUrls()
    {
        var configuration = Settings();
        configuration["AWS_S3_BUCKET_NAME"] = ""; Assert.Throws<InvalidOperationException>(() => InfrastructureOptions.Read(configuration));
        configuration = Settings(); configuration["DATABASE_URL"] = "postgresql://localhost/db"; Assert.Throws<InvalidOperationException>(() => InfrastructureOptions.Read(configuration));
    }

    private static IConfigurationRoot Settings() => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["DATABASE_URL"] = "Host=localhost;Database=projecthub_test;Username=projecthub",
        ["AWS_ENDPOINT_URL"] = "https://storage.example.test",
        ["AWS_ACCESS_KEY_ID"] = "test-access",
        ["AWS_SECRET_ACCESS_KEY"] = "test-secret",
        ["AWS_S3_BUCKET_NAME"] = "test-bucket"
    }).Build();
}
