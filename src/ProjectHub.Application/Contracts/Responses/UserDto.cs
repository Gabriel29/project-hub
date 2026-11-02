namespace ProjectHub.Application;

public record UserDto(
    string Id,
    string? Email,
    string DisplayName,
    IList<string> Roles,
    bool HasPassword,
    bool Disabled,
    Guid? ClientId,
    string? PhoneNumber,
    string? ClientName = null,
    string? Language = null,
    DateTimeOffset? ActiveLinkExpiresAt = null);
