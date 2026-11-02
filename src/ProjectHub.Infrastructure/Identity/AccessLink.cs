namespace ProjectHub.Infrastructure;

public class AccessLink
{
    public string Purpose { get; set; } = "activation";
    public DateTimeOffset? ConsumedAt { get; set; }
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = "";
    public string TokenHash { get; set; } = "";
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
