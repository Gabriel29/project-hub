using Microsoft.EntityFrameworkCore;
using ProjectHub.Application;

namespace ProjectHub.Infrastructure;

public sealed class ProjectQueries(
    PortalDb db,
    ProjectAccess projects,
    ICurrentUser actor,
    IIdentityGateway identity)
{
    public async Task<List<ProjectSummary>> ListAsync(string? clientId, CancellationToken ct = default)
    {
        ActorGuard.Authenticated(actor);
        Guid? filter = null;
        if (clientId is not null && clientId != "none" && !Guid.TryParse(clientId, out _))
        {
            throw new PortalException(400, "invalidClient");
        }

        if (clientId is not null && clientId != "none")
        {
            filter = Guid.Parse(clientId);
        }

        return await db.Projects.AsNoTracking()
            .Where(project => (actor.IsManager || db.Clients.Any(client => client.Id == project.ClientId && client.UserId == actor.Id))
                && (clientId == null || project.ClientId == filter))
            .OrderByDescending(project => project.UpdatedAt)
            .Select(project => new ProjectSummary(
                project.Id,
                project.Code,
                project.Name,
                project.Location,
                db.Milestones.Where(stage => stage.ProjectId == project.Id && !stage.StageComplete)
                    .OrderBy(stage => stage.OrderIndex)
                    .Select(stage => (Guid?)stage.Id)
                    .FirstOrDefault(),
                project.UpdatedAt,
                project.ClientId))
            .ToListAsync(ct);
    }

    public async Task<List<SearchSuggestion>> SearchAsync(string? query, CancellationToken ct = default)
    {
        projects.Manager();
        var term = query?.Trim() ?? "";
        if (term.Length < 2)
        {
            return [];
        }

        if (term.Length > 120)
        {
            throw new PortalException(400, "searchTooLong");
        }

        var lower = term.ToLower();
        var matchingProjects = db.Projects.AsNoTracking()
            .Where(p => p.Name.ToLower().Contains(lower) || p.Code.ToLower().Contains(lower) || db.Clients.Any(c => c.Id == p.ClientId && (c.Name.ToLower().Contains(lower) || (c.CodePrefix != null && c.CodePrefix.ToLower().Contains(lower)))))
            .Select(p => new { Kind = "project", p.Id, p.Name, Code = p.Code, ClientId = p.ClientId });
        var matchingClients = db.Clients.AsNoTracking()
            .Where(c => c.Name.ToLower().Contains(lower) || (c.CodePrefix != null && c.CodePrefix.ToLower().Contains(lower)))
            .Select(c => new { Kind = "client", c.Id, c.Name, Code = c.CodePrefix ?? "", ClientId = (Guid?)c.Id });
        return await matchingProjects.Concat(matchingClients)
            .OrderByDescending(r => r.Code.ToLower() == lower || r.Name.ToLower() == lower)
            .ThenBy(r => r.Name)
            .ThenBy(r => r.Id)
            .Take(5)
            .Select(r => new SearchSuggestion(r.Kind, r.Id, r.Name, r.Code, r.ClientId)).ToListAsync(ct);
    }

    public async Task<DetailDto> DetailAsync(Guid id, CancellationToken ct = default)
    {
        var project = await projects.AccessibleAsync(id, ct);
        var manager = await identity.ContactAsync(project.ManagerUserId, ct);
        var client = actor.IsOwner && project.ClientId.HasValue ? (await db.Clients.AsNoTracking().SingleOrDefaultAsync(c => c.Id == project.ClientId, ct)) : null;
        var clientContact = client == null ? null : await identity.ContactAsync(client.UserId, ct);
        var root = actor.IsManager ? (await db.Folders.AsNoTracking().SingleOrDefaultAsync(f => f.ProjectId == id && f.ParentId == null, ct)) : null;
        return new(ProjectDetailMapper.Project(project, manager, clientContact, actor.IsManager), root?.Id);
    }
}
