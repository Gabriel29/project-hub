namespace ProjectHub.Application;

public record NoteDto(
    Guid Id,
    string Title,
    string Body,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
