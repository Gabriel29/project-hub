using Microsoft.EntityFrameworkCore;
using ProjectHub.Application;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

public sealed class ProjectCommands(
    PortalDb db,
    ProjectWriteAccess projects,
    ProjectCodeAllocator codes,
    IIdentityGateway identity,
    ICurrentUser actor)
{
    public async Task<Guid> CreateAsync(ProjectChanges request, CancellationToken ct = default)
    {
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        projects.Manager();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.LockProjectCodesAsync(ct);
        await ValidateAsync(request, ct);
        var project = new Project();
        ProjectRules.Apply(project, request);
        project.Code = await codes.GenerateAsync(request.ClientId, ct);
        db.Add(project);
        var root = new DocumentFolder
        {
            ProjectId = project.Id,
            Name = "Root",
            CreatedBy = actor.Id
        };
        db.Add(root);
        foreach (var section in SharedFolders.Names)
        {
            db.Add(new DocumentFolder { ProjectId = project.Id, Name = section.Value, SectionKey = section.Key, ParentId = root.Id, CreatedBy = actor.Id });
        }

        projects.Event(project.Id, "Proiect creat", project.Name);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return project.Id;
    }

    private async Task ValidateAsync(ProjectChanges request, CancellationToken ct = default)
    {
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        if (!request.Valid())
        {
            throw new PortalException(400, "invalidProject");
        }

        if (request.ClientId != null && !(await db.Clients.AsNoTracking().AnyAsync(c => c.Id == request.ClientId, ct)))
        {
            throw new PortalException(400, "selectExistingClient");
        }

        var manager = await identity.ContactAsync(request.ManagerUserId, ct);
        if (manager == null || manager.Disabled || !manager.Roles.Any(role => role is PortalRoles.Owner or PortalRoles.Admin))
        {
            throw new PortalException(400, "selectActiveManager");
        }
    }

    public async Task UpdateAsync(Guid id, ProjectChanges request, CancellationToken ct = default)
    {
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        projects.Manager();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.LockProjectAsync(id, ct);
        await ValidateAsync(request, ct);
        var project = await projects.GetForUpdateAsync(id, ct);
        ProjectRules.Apply(project, request);
        projects.Event(id, "Proiect actualizat");
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }
}
