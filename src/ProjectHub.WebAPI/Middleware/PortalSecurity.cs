namespace ProjectHub.WebAPI;

public static class PortalSecurity
{
    public static void UsePortalSecurity(this WebApplication app)
    {
        app.UseExceptionHandler();
        app.UseStatusCodePages(async status =>
        {
            if (status.HttpContext.Request.Path.StartsWithSegments("/api"))
            {
                await PortalProblems.WriteAsync(status.HttpContext, status.HttpContext.Response.StatusCode);
            }
        });
        app.Use(async (context, next) =>
        {
            context.Response.Headers["X-Content-Type-Options"] = "nosniff";
            context.Response.Headers["Referrer-Policy"] = "no-referrer";
            var inlineFile = HttpMethods.IsGet(context.Request.Method) && context.Request.Path.StartsWithSegments("/api/projects") && context.Request.Path.Value!.EndsWith("/content", StringComparison.Ordinal) && context.Request.Query["inline"] == "true";
            context.Response.Headers["X-Frame-Options"] = inlineFile ? "SAMEORIGIN" : "DENY";
            context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-src 'self'; frame-ancestors " + (inlineFile ? "'self'" : "'none'") + "; base-uri 'self'; form-action 'self'";
            if (!app.Environment.IsDevelopment())
            {
                context.Response.Headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
            }

            if (context.Request.Path.StartsWithSegments("/api"))
            {
                context.Response.Headers.CacheControl = "no-store";
                if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method) && context.Request.Headers["X-ProjectHub-Request"] != "1")
                {
                    await PortalProblems.WriteAsync(context, 403);
                    return;
                }

                var origin = context.Request.Headers.Origin.ToString();
                if (origin.Length > 0 && (!Uri.TryCreate(origin, UriKind.Absolute, out var u) || !string.Equals(u.GetLeftPart(UriPartial.Authority), app.Services.GetRequiredService<PortalHostOptions>().PublicOrigin, StringComparison.OrdinalIgnoreCase) || u.AbsolutePath != "/" || u.Query.Length > 0 || u.Fragment.Length > 0 || u.UserInfo.Length > 0))
                {
                    await PortalProblems.WriteAsync(context, 403);
                    return;
                }
            }

            await next();
        });
        app.Use(async (context, next) =>
        {
            if (app.Configuration.GetValue<bool>("MAINTENANCE_MODE") && context.Request.Path != "/health")
            {
                context.Response.Headers.RetryAfter = "300";
                await PortalProblems.WriteAsync(context, 503);
                return;
            }

            await next();
        });
    }
}
