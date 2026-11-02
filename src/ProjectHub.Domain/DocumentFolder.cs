namespace ProjectHub.Domain;
// Root has no parent; every other folder belongs to a same-project parent.
public class DocumentFolder
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public Guid? ParentId { get; set; }
    public string? SectionKey { get; set; }
    public string Name { get; set; } = "";
    public string CreatedBy { get; set; } = "";
}
