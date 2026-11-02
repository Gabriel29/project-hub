namespace ProjectHub.Domain;

public class ProjectFile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public string Title { get; set; } = "";
    public Guid FolderId { get; set; }
    public FileContent Content { get; set; } = null!;
}
