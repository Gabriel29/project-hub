namespace ProjectHub.WebAPI;

public static class PortalPipelineExtensions
{
    public static WebApplication UsePortalPipeline(this WebApplication app)
    {
        app.UseForwardedHeaders();
        app.UseRequestLocalization();
        app.UsePortalSecurity();
        app.UseRateLimiter();
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseDefaultFiles();
        app.UseStaticFiles();
        return app;
    }
}
