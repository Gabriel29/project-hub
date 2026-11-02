using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectHub.Application;

namespace ProjectHub.WebAPI;

public partial class ProjectsController
{
    [HttpGet("search"), Authorize(Policy = PortalRoles.Manage)]
    public Task<List<SearchSuggestion>> SearchAsync([FromQuery] string? query, CancellationToken ct = default) => queries.SearchAsync(query, ct);

    [HttpPost, Authorize(Policy = PortalRoles.Manage)]
    public async Task<CreatedProjectResponse> CreateAsync(ProjectRequest request, CancellationToken ct = default) => new(await commands.CreateAsync(request.Changes(), ct));

    [HttpPut("{id:guid}"), Authorize(Policy = PortalRoles.Manage)]
    public async Task<IActionResult> UpdateAsync(Guid id, ProjectRequest request, CancellationToken ct = default)
    {
        await commands.UpdateAsync(id, request.Changes(), ct);
        return Ok();
    }

    [HttpPut("{id:guid}/milestones"), Authorize(Policy = PortalRoles.Manage)]
    public async Task<IActionResult> CalendarAsync(Guid id, MilestoneRequest[] request, CancellationToken ct = default)
    {
        await stages.UpdateAsync(id, request, ct);
        return Ok();
    }

    [HttpPut("{id:guid}/stages"), Authorize(Policy = PortalRoles.Manage)]
    public async Task<IActionResult> StagesAsync(Guid id, StageRequest[] request, CancellationToken ct = default)
    {
        await stages.DefineStagesAsync(id, request, ct);
        return Ok();
    }

    [HttpPut("{id:guid}/status"), Authorize(Policy = PortalRoles.Manage)]
    public async Task<IActionResult> StatusAsync(Guid id, ProjectStatusRequest request, CancellationToken ct = default)
    {
        await stages.StatusAsync(id, request, ct);
        return Ok();
    }

    [HttpPut("{id:guid}/updates/{entryId:guid}"), Authorize(Policy = PortalRoles.Manage)]
    public async Task<IActionResult> EditEntryAsync(Guid id, Guid entryId, CalendarEntryRequest request, CancellationToken ct = default)
    {
        await activities.EditEntryAsync(id, entryId, request, ct);
        return Ok();
    }

    [HttpDelete("{id:guid}/updates/{entryId:guid}"), Authorize(Policy = PortalRoles.Manage)]
    public async Task<IActionResult> DeleteEntryAsync(Guid id, Guid entryId, CancellationToken ct = default)
    {
        await activities.DeleteEntryAsync(id, entryId, ct);
        return Ok();
    }

    [HttpPost("{id:guid}/updates"), Authorize(Policy = PortalRoles.Manage)]
    public async Task<IActionResult> EntryAsync(Guid id, CalendarEntryRequest request, CancellationToken ct = default)
    {
        await activities.AddEntryAsync(id, request, ct);
        return Ok();
    }
}
