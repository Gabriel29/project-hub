using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectHub.Application;

namespace ProjectHub.WebAPI;

public partial class ProjectResourcesController
{
    [HttpGet("events"), Authorize(Policy = PortalRoles.Manage)]
    public Task<List<EventDto>> EventsAsync(Guid projectId, CancellationToken ct) => resources.EventsAsync(projectId, ct);
}
