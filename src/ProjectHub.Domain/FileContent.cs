namespace ProjectHub.Domain;

public class FileContent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectFileId { get; set; }
    public string ObjectKey { get; set; } = "";
    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "";
    public long Size { get; set; }
    public string Sha256 { get; set; } = "";
    public string UploadedBy { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
