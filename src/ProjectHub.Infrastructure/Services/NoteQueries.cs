using Microsoft.EntityFrameworkCore;
using ProjectHub.Application;

namespace ProjectHub.Infrastructure;

public sealed class NoteQueries(PortalDb db, ProjectAccess projects, ICurrentUser actor)
{
    public async Task<List<NoteDto>> ListAsync(Guid projectId, CancellationToken ct = default)
    {
        ActorGuard.Manager(actor);
        await projects.AccessibleAsync(projectId, ct);
        return (await db.Notes.AsNoTracking().Where(note => note.ProjectId == projectId).ToListAsync(ct)).OrderByDescending(note => note.UpdatedAt).Select(note => new NoteDto(note.Id, note.Title, note.Body, note.CreatedAt, note.UpdatedAt)).ToList();
    }
}
