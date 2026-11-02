namespace ProjectHub.Domain;

public class Project
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string? ManagerUserId { get; set; }
    public DateOnly? NextMaintenanceDate { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string Location { get; set; } = "";
    public string Description { get; set; } = "";
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Guid? ClientId { get; set; }
    public List<Milestone> Milestones { get; set; } = [];
}
