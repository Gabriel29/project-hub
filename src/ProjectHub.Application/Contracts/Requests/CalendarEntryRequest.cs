namespace ProjectHub.Application;

public record CalendarEntryRequest(
    string Title,
    string Details,
    DateTimeOffset OccurredAt = default,
    Guid? PhotoContentId = null,
    Guid[]? PhotoIds = null);
