using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectHub.Application;
using ProjectHub.Infrastructure;

namespace ProjectHub.WebAPI;

[ApiController, Route("api/projects"), Authorize]
public partial class ProjectsController(ProjectQueries queries, ProjectCommands commands, StageService stages, ActivityService activities) : ControllerBase
{
    [HttpGet]
    public Task<List<ProjectSummary>> ListAsync([FromQuery] string? clientId, CancellationToken ct = default) => queries.ListAsync(clientId, ct);

    [HttpGet("{id:guid}")]
    public Task<DetailDto> DetailAsync(Guid id, CancellationToken ct = default) => queries.DetailAsync(id, ct);
}
