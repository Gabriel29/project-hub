namespace ProjectHub.Application;

public record LinkDto(
    Guid Id,
    DateTimeOffset ExpiresAt,
    string Token,
    string Purpose);
