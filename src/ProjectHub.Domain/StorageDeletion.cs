namespace ProjectHub.Domain;

public sealed class StorageDeletion
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ObjectKey { get; set; } = "";
    public int Attempts { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset NextAttemptAt { get; set; } = DateTimeOffset.UtcNow;
}
