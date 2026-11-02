using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectHub.Application;
using ProjectHub.Infrastructure;

namespace ProjectHub.WebAPI;

[ApiController, Route("api/admin"), Authorize(Policy = PortalRoles.Manage)]
public class AdminController(ClientService clients, PortalHostOptions host) : ControllerBase
{
    private AccessLinkResponse Link(LinkDto l) => new(l.Id, l.ExpiresAt, $"{host.PublicOrigin}/#{l.Purpose}={l.Token}");

    [HttpGet("users")]
    public Task<List<UserDto>> ListAsync(CancellationToken ct = default) => clients.UsersAsync(ct);

    [HttpPost("users")]
    public async Task<CreatedAccountResponse> CreateAsync(UserRequest request, CancellationToken ct = default)
    {
        var result = await clients.CreateAsync(request, ct);
        return new(result.User.Id, result.User.ClientId, result.Link == null ? null : Link(result.Link));
    }

    [HttpPost("users/{id}/activation")]
    public async Task<AccessLinkResponse> ActivationAsync(string id, CancellationToken ct = default) => Link(await clients.GenerateAsync(id, "activation", ct));

    [HttpPost("users/{id}/reset")]
    public async Task<AccessLinkResponse> ResetAsync(string id, CancellationToken ct = default) => Link(await clients.GenerateAsync(id, "reset", ct));

    [HttpPost("users/{id}/revoke-links")]
    public async Task<IActionResult> RevokeAsync(string id, CancellationToken ct = default)
    {
        await clients.RevokeAsync(id, ct);
        return Ok();
    }

    [HttpPost("users/{id}/disabled")]
    public async Task<IActionResult> DisableAsync(string id, DisabledRequest request, CancellationToken ct = default)
    {
        await clients.DisableAsync(id, request.Disabled, ct);
        return Ok();
    }
}
