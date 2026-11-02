using System.Diagnostics;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Localization;
using ProjectHub.Application;

namespace ProjectHub.WebAPI;

public static class PortalProblems
{
    public static ProblemDetails Create(HttpContext context, int status, string? code = null)
    {
        code ??= PortalErrorCodes.ForStatus(status);
        var localizer = context.RequestServices.GetRequiredService<IStringLocalizer<PortalErrorMessages>>();
        var message = localizer[code];
        var problem = new ProblemDetails
        {
            Status = status,
            Title = ReasonPhrases.GetReasonPhrase(status),
            Detail = message.ResourceNotFound ? localizer["unexpected"].Value : message.Value,
            Instance = context.Request.Path
        };
        problem.Extensions["code"] = code;
        problem.Extensions["traceId"] = Activity.Current?.Id ?? context.TraceIdentifier;
        return problem;
    }

    public static Task WriteAsync(HttpContext context, int status, string? code = null)
    {
        context.Response.StatusCode = status;
        return context.Response.WriteAsJsonAsync(Create(context, status, code), options: null, contentType: "application/problem+json", cancellationToken: context.RequestAborted);
    }
}

public sealed class PortalExceptionHandler(ILogger<PortalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is OperationCanceledException && context.RequestAborted.IsCancellationRequested)
        {
            return false;
        }

        var status = exception is PortalException portal ? portal.Status : exception is BadHttpRequestException bad ? bad.StatusCode : 500;
        if (status >= 500)
        {
            logger.LogError(exception, "Request failed with trace {TraceId}", context.TraceIdentifier);
        }

        await PortalProblems.WriteAsync(context, status, exception is PortalException p ? p.Code : null);
        return true;
    }
}
