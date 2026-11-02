namespace ProjectHub.Domain;

public class CalendarEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public string ActorId { get; set; } = "";
    public string Title { get; set; } = "";
    public string Details { get; set; } = "";
    public DateTimeOffset OccurredAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Guid[] PhotoIds { get; set; } = [];
    public Guid? PhotoContentId { get; set; }
}
