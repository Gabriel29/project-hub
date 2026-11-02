using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectHub.Application;
using ProjectHub.Infrastructure;

namespace ProjectHub.WebAPI;

[ApiController, Route("api/clients"), Authorize]
public partial class ClientsController(ClientQueries clients) : ControllerBase
{
    [HttpGet("me"), Authorize(Roles = PortalRoles.Client)]
    public Task<ClientProfileDto> MeAsync(CancellationToken ct = default) => clients.MyDetailsAsync(ct);
}
