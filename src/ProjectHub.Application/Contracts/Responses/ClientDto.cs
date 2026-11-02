namespace ProjectHub.Application;

public record ClientDto(
    Guid Id,
    string DisplayName,
    string? Email,
    string? Code = null);
