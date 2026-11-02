namespace ProjectHub.Application;

public sealed record AccountContact(
    string Id,
    string? Email,
    string DisplayName,
    string? PhoneNumber,
    bool Disabled,
    IReadOnlyList<string> Roles);
