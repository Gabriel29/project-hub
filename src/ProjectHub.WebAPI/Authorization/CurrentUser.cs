using System.Security.Claims;
using ProjectHub.Application;

namespace ProjectHub.WebAPI;

public class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal User => accessor.HttpContext?.User ?? new();
    public string Id => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
    public bool IsManager => User.IsInRole(PortalRoles.Owner) || User.IsInRole(PortalRoles.Admin);
    public bool IsOwner => User.IsInRole(PortalRoles.Owner);
    public string? Ip => accessor.HttpContext?.Connection.RemoteIpAddress?.ToString();
}
