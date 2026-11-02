namespace ProjectHub.Application;

public record CalendarEntryDto(
    Guid Id,
    string Title,
    string Details,
    DateTimeOffset OccurredAt,
    Guid? PhotoContentId,
    Guid[]? PhotoIds = null);
