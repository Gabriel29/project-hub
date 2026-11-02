namespace ProjectHub.Application;

public record ClientProfileDto(
    Guid Id,
    string DisplayName,
    string? Email,
    string? PhoneNumber);
