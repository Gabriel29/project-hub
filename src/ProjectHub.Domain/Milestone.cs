namespace ProjectHub.Domain;

public class Milestone
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public string Name { get; set; } = "";
    public bool StageComplete { get; set; }
    public int OrderIndex { get; set; }
    public string Description { get; set; } = "";
}
