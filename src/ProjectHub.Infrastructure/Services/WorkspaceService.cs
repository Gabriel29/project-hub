using Microsoft.EntityFrameworkCore;
using ProjectHub.Application;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

public class WorkspaceService(
    PortalDb db,
    ProjectWriteAccess projects,
    ICurrentUser actor)
{
    public async Task SaveNoteAsync(Guid project, Guid? id, NoteRequest request, CancellationToken ct = default)
    {
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        ActorGuard.Manager(actor);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.LockProjectAsync(project, ct);
        await projects.GetForUpdateAsync(project, ct);
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 200 || request.Body == null || request.Body.Length > 20000)
        {
            throw new PortalException(400, "invalidNote");
        }

        var note = id == null ? new ProjectNote
        {
            ProjectId = project
        }

        : await db.Notes.SingleOrDefaultAsync(entity => entity.ProjectId == project && entity.Id == id.Value, ct) ?? throw new PortalException(404, "noteNotFound");
        if (id == null)
        {
            db.Add(note);
        }

        note.Title = request.Title.Trim();
        note.Body = request.Body;
        note.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task DeleteNoteAsync(Guid project, Guid id, CancellationToken ct = default)
    {
        ActorGuard.Manager(actor);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.LockProjectAsync(project, ct);
        await projects.GetForUpdateAsync(project, ct);
        var note = await db.Notes.SingleOrDefaultAsync(entity => entity.ProjectId == project && entity.Id == id, ct) ?? throw new PortalException(404, "noteNotFound");
        db.Remove(note);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task SetMaintenanceDateAsync(Guid project, DateOnly? date, CancellationToken ct = default)
    {
        ActorGuard.Manager(actor);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.LockProjectAsync(project, ct);
        var p = await projects.GetForUpdateAsync(project, ct);
        p.NextMaintenanceDate = date;
        p.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }
}
