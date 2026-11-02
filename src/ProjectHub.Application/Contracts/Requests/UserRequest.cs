namespace ProjectHub.Application;

public record UserRequest(
    string Name,
    bool Admin = false,
    string? Email = null,
    string? PhoneNumber = null,
    string? ClientName = null);
