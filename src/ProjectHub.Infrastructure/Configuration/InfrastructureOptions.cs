using Microsoft.Extensions.Configuration;
using Npgsql;

namespace ProjectHub.Infrastructure;

public sealed record InfrastructureOptions(string ConnectionString, string StorageEndpoint, string StorageAccessKey, string StorageSecretKey, string StorageBucket, string StorageRegion, bool ForcePathStyle)
{
    public static InfrastructureOptions Read(IConfiguration configuration)
    {
        var database = configuration["DATABASE_URL"] ?? configuration.GetConnectionString("Database") ?? throw new InvalidOperationException("DATABASE_URL is required.");
        if (database.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) || database.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            if (!Uri.TryCreate(database, UriKind.Absolute, out var uri) || uri.UserInfo.Split(':', 2) is not [var username, var password] || string.IsNullOrEmpty(uri.AbsolutePath.Trim('/')))
            {
                throw new InvalidOperationException("DATABASE_URL must identify a PostgreSQL database and credentials.");
            }

            var settings = new NpgsqlConnectionStringBuilder
            {
                Host = uri.Host,
                Port = uri.Port > 0 ? uri.Port : 5432,
                Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
                Username = Uri.UnescapeDataString(username),
                Password = Uri.UnescapeDataString(password),
                SslMode = SslMode.Prefer
            };
            foreach (var parameter in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
            {
                var pair = parameter.Split('=', 2);
                if (pair.Length == 2 && pair[0].Equals("sslmode", StringComparison.OrdinalIgnoreCase))
                {
                    if (!Enum.TryParse<SslMode>(Uri.UnescapeDataString(pair[1]).Replace("-", "", StringComparison.Ordinal), true, out var sslMode))
                    {
                        throw new InvalidOperationException("DATABASE_URL sslmode is invalid.");
                    }

                    settings.SslMode = sslMode;
                }
                else
                {
                    throw new InvalidOperationException("DATABASE_URL contains an unsupported parameter; use a full Npgsql connection string.");
                }
            }

            database = settings.ConnectionString;
        }

        var connection = new NpgsqlConnectionStringBuilder(database);
        if (string.IsNullOrWhiteSpace(connection.Host) || string.IsNullOrWhiteSpace(connection.Database))
        {
            throw new InvalidOperationException("Database host and database name are required.");
        }

        var endpoint = Required(configuration, "AWS_ENDPOINT_URL");
        if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var storage) || storage.Scheme is not ("http" or "https") || storage.UserInfo.Length > 0)
        {
            throw new InvalidOperationException("AWS_ENDPOINT_URL must be an HTTP(S) endpoint without credentials.");
        }

        return new(connection.ConnectionString, endpoint, Required(configuration, "AWS_ACCESS_KEY_ID"), Required(configuration, "AWS_SECRET_ACCESS_KEY"), Required(configuration, "AWS_S3_BUCKET_NAME"), configuration["AWS_DEFAULT_REGION"] ?? "auto", configuration.GetValue<bool>("AWS_S3_FORCE_PATH_STYLE"));
    }

    public override string ToString() => "ProjectHub infrastructure configuration (credentials redacted)";

    private static string Required(IConfiguration configuration, string name) => !string.IsNullOrWhiteSpace(configuration[name]) ? configuration[name]! : throw new InvalidOperationException($"{name} is required.");
}
