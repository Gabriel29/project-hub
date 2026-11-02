namespace ProjectHub.Application;

public record EventDto(
    Guid Id,
    string Title,
    string Details,
    DateTimeOffset CreatedAt,
    bool Read);
