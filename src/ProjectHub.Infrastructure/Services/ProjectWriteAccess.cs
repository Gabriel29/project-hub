using Microsoft.EntityFrameworkCore;
using ProjectHub.Application;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

public sealed class ProjectWriteAccess(PortalDb db, ICurrentUser actor)
{
    public void Manager() => ActorGuard.Manager(actor);

    public async Task<Project> GetForUpdateAsync(Guid id, CancellationToken ct = default)
    {
        ActorGuard.Manager(actor);
        return await db.Projects.Include(entity => entity.Milestones).SingleOrDefaultAsync(entity => entity.Id == id, ct) ?? throw new PortalException(404, "projectNotFound");
    }

    internal void Event(Guid id, string title, string details = "") => db.Events.Add(new ProjectEvent { ProjectId = id, ActorId = actor.Id, Title = title, Details = details });
}
