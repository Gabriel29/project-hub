using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectHub.Application;
using ProjectHub.Infrastructure;

namespace ProjectHub.WebAPI;

[ApiController, Route("api/projects/{projectId:guid}"), Authorize]
public class WorkspaceController(WorkspaceService service, NoteQueries notes) : ControllerBase
{
    [HttpPut("maintenance-date"), Authorize(Policy = PortalRoles.Manage)]
    public async Task<IActionResult> MaintenanceDateAsync(Guid projectId, MaintenanceDateRequest request, CancellationToken ct = default)
    {
        await service.SetMaintenanceDateAsync(projectId, request.Date, ct);
        return Ok();
    }

    [HttpGet("notes"), Authorize(Policy = PortalRoles.Manage)]
    public Task<List<NoteDto>> NotesAsync(Guid projectId, CancellationToken ct = default) => notes.ListAsync(projectId, ct);

    [HttpPost("notes"), Authorize(Policy = PortalRoles.Manage)]
    public async Task<IActionResult> AddNoteAsync(Guid projectId, NoteRequest request, CancellationToken ct = default)
    {
        await service.SaveNoteAsync(projectId, null, request, ct);
        return Ok();
    }

    [HttpPut("notes/{id:guid}"), Authorize(Policy = PortalRoles.Manage)]
    public async Task<IActionResult> EditNoteAsync(Guid projectId, Guid id, NoteRequest request, CancellationToken ct = default)
    {
        await service.SaveNoteAsync(projectId, id, request, ct);
        return Ok();
    }

    [HttpDelete("notes/{id:guid}"), Authorize(Policy = PortalRoles.Manage)]
    public async Task<IActionResult> DeleteNoteAsync(Guid projectId, Guid id, CancellationToken ct = default)
    {
        await service.DeleteNoteAsync(projectId, id, ct);
        return Ok();
    }
}
