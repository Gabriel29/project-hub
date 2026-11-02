using System.Net;
using Microsoft.AspNetCore.HttpOverrides;

namespace ProjectHub.WebAPI;

public sealed record PortalHostOptions(string PublicOrigin, string[] AllowedHosts)
{
    public static PortalHostOptions Read(IConfiguration configuration, bool development)
    {
        var origin = configuration["PUBLIC_ORIGIN"] ?? (development ? "https://localhost" : throw new InvalidOperationException("PUBLIC_ORIGIN is required in production."));
        if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https") || (!development && uri.Scheme != "https") || uri.AbsolutePath != "/" || uri.Query.Length > 0 || uri.Fragment.Length > 0 || uri.UserInfo.Length > 0)
        {
            throw new InvalidOperationException("PUBLIC_ORIGIN must be an absolute origin without a path.");
        }

        var hosts = (configuration["AllowedHosts"] ?? uri.Host).Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (hosts.Length == 0 || hosts.Contains("*"))
        {
            throw new InvalidOperationException("AllowedHosts must contain explicit host names.");
        }

        return new(uri.GetLeftPart(UriPartial.Authority), hosts);
    }

    public static void ConfigureProxies(ForwardedHeadersOptions options, IConfiguration configuration)
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        options.ForwardLimit = 1;
        // Retain framework loopback defaults; add only explicitly trusted deployment addresses.
        foreach (var address in (configuration["TRUSTED_PROXIES"] ?? "").Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            options.KnownProxies.Add(IPAddress.Parse(address));
        }

        foreach (var network in (configuration["TRUSTED_PROXY_NETWORKS"] ?? "").Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(network));
        }
    }
}
