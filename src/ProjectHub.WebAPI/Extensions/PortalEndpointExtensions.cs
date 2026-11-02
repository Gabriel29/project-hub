using ProjectHub.Application;
using ProjectHub.Infrastructure;

namespace ProjectHub.WebAPI;

public static class PortalEndpointExtensions
{
    public static WebApplication MapPortalEndpoints(this WebApplication app)
    {
        app.MapControllers();
        app.MapOpenApi().RequireAuthorization(policy => policy.RequireRole(PortalRoles.Admin, PortalRoles.Owner));
        app.MapGet("/health", async (PortalDb db, CancellationToken ct) => await db.Database.CanConnectAsync(ct) ? Results.Ok(new { status = "healthy" }) : Results.StatusCode(503));
        app.MapFallback(async context =>
        {
            if (context.Request.Path.StartsWithSegments("/api"))
            {
                context.Response.StatusCode = 404;
                return;
            }

            context.Response.ContentType = "text/html";
            await context.Response.SendFileAsync(Path.Combine(app.Environment.WebRootPath, "index.html"));
        });
        return app;
    }
}
