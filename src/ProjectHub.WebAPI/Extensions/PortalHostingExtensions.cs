namespace ProjectHub.WebAPI;

public static class PortalHostingExtensions
{
    public static WebApplicationBuilder ConfigurePortalHosting(this WebApplicationBuilder builder)
    {
        var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
        builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
        var hostOptions = PortalHostOptions.Read(builder.Configuration, builder.Environment.IsDevelopment());
        builder.Services.AddSingleton(hostOptions);
        builder.Configuration["AllowedHosts"] = string.Join(';', hostOptions.AllowedHosts);
        builder.Services.Configure<ForwardedHeadersOptions>(options => PortalHostOptions.ConfigureProxies(options, builder.Configuration));
        return builder;
    }
}
