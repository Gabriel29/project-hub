using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectHub.Application;
using ProjectHub.Infrastructure;

namespace ProjectHub.WebAPI;

[ApiController, Route("api/projects/{projectId:guid}"), Authorize]
public partial class ProjectResourcesController(ProjectResources resources) : ControllerBase
{
    [HttpGet("sections")]
    public Task<List<FolderSectionDto>> SectionsAsync(Guid projectId, CancellationToken ct) => resources.SectionsAsync(projectId, ct);

    [HttpGet("folders/{folderId:guid}/contents")]
    public Task<FolderContentsDto> ContentsAsync(Guid projectId, Guid folderId, CancellationToken ct) => resources.ContentsAsync(projectId, folderId, ct);

    [HttpGet("folders/{folderId:guid}/search")]
    public Task<FolderContentsDto> SearchAsync(Guid projectId, Guid folderId, [FromQuery] string? query, CancellationToken ct) => resources.SearchAsync(projectId, folderId, query, ct);

    [HttpGet("activities")]
    public Task<ActivityFeedDto> ActivitiesAsync(Guid projectId, [FromQuery] int? limit, CancellationToken ct) => resources.ActivitiesAsync(projectId, limit, ct);

    [HttpGet("recent-documents")]
    public Task<RecentDocumentsDto> RecentAsync(Guid projectId, CancellationToken ct) => resources.RecentAsync(projectId, ct);
}
