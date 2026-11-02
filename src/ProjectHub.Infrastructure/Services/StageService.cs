using ProjectHub.Application;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

public sealed class StageService(
    PortalDb db,
    ProjectWriteAccess projects)
{
    public async Task UpdateAsync(Guid id, MilestoneRequest[] request, CancellationToken ct = default)
    {
        projects.Manager();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.LockProjectAsync(id, ct);
        var project = await projects.GetForUpdateAsync(id, ct);
        if (request == null || request.Any(m => m == null || m.Description == null || m.Description.Length > 4000) || request.Length != project.Milestones.Count || request.Select(m => m.Id).Distinct().Count() != request.Length || request.Any(m => !project.Milestones.Any(s => s.Id == m.Id)))
        {
            throw new PortalException(400, "invalidCalendar");
        }

        foreach (var m in request)
        {
            var existing = project.Milestones.Single(x => x.Id == m.Id);
            existing.Description = m.Description.Trim();
        }

        project.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task DefineStagesAsync(Guid id, StageRequest[] request, CancellationToken ct = default)
    {
        projects.Manager();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.LockProjectAsync(id, ct);
        var project = await projects.GetForUpdateAsync(id, ct);
        if (request == null || request.Length > 50 || request.Any(s => s == null || string.IsNullOrWhiteSpace(s.Name) || s.Name.Length > 120 || s.Description == null || s.Description.Length > 4000) || request.Select(s => s.Name.Trim().ToUpperInvariant()).Distinct().Count() != request.Length || request.Where(s => s.Id != null).Select(s => s.Id).Distinct().Count() != request.Count(s => s.Id != null) || request.Any(s => s.Id != null && !project.Milestones.Any(m => m.Id == s.Id)))
        {
            throw new PortalException(400, "invalidStages");
        }

        foreach (var old in project.Milestones.Where(m => !request.Any(s => s.Id == m.Id)).ToList())
        {
            project.Milestones.Remove(old);
            db.Remove(old);
        }

        for (var i = 0; i < request.Length; i++)
        {
            var s = request[i];
            var stage = s.Id == null ? new Milestone
            {
                ProjectId = id
            }

            : project.Milestones.Single(m => m.Id == s.Id);
            if (s.Id == null)
            {
                project.Milestones.Add(stage);
                db.Add(stage);
            }

            stage.Name = s.Name.Trim();
            stage.OrderIndex = i;
            stage.Description = s.Description.Trim();
        }

        ProjectStages.Normalize(project);
        project.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task StatusAsync(Guid id, ProjectStatusRequest request, CancellationToken ct = default)
    {
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        projects.Manager();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.LockProjectAsync(id, ct);
        var project = await projects.GetForUpdateAsync(id, ct);
        if (request.StagesCompleted && (request.StageId != null || project.Milestones.Count == 0))
        {
            throw new PortalException(400, "invalidStatus");
        }

        if (request.StageId != null && !project.Milestones.Any(s => s.Id == request.StageId))
        {
            throw new PortalException(400, "invalidStatus");
        }

        ProjectStages.Select(project, request.StageId, request.StagesCompleted);
        project.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }
}
