using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectHub.Application;

namespace ProjectHub.WebAPI;

public partial class ClientsController
{
    [HttpGet, Authorize(Policy = PortalRoles.Manage)]
    public Task<List<ClientDto>> ListAsync(CancellationToken ct = default) => clients.ListAsync(ct);
}
