using ProjectHub.Domain;

namespace ProjectHub.Application;

public static class ProjectRules
{
    public static void Apply(Project p, ProjectChanges request)
    {
        p.ClientId = request.ClientId;
        p.ManagerUserId = request.ManagerUserId;
        p.Name = request.Name.Trim();
        p.Location = request.Location.Trim();
        p.Description = request.Description?.Trim() ?? "";
        p.UpdatedAt = DateTimeOffset.UtcNow;
    }
}
