namespace ProjectHub.Application;

public record FileContentDto(
    Guid Id,
    string FileName,
    string ContentType,
    long Size,
    DateTimeOffset CreatedAt,
    string Sha256);
