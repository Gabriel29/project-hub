using Microsoft.EntityFrameworkCore;
using ProjectHub.Application;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

public sealed class ProjectAccess(
    PortalDb db,
    ICurrentUser actor)
{
    public void Manager()
    {
        ActorGuard.Manager(actor);
    }

    public async Task<Project> AccessibleAsync(Guid id, CancellationToken ct = default)
    {
        ActorGuard.Authenticated(actor);
        var project = await db.Projects.AsNoTracking().Include(p => p.Milestones).SingleOrDefaultAsync(p => p.Id == id, ct) ?? throw new PortalException(404, "projectNotFound");
        if (!actor.IsManager && !(await db.Clients.AsNoTracking().AnyAsync(c => c.Id == project.ClientId && c.UserId == actor.Id, ct)))
        {
            throw new PortalException(404, "projectNotFound");
        }

        return project;
    }
}
