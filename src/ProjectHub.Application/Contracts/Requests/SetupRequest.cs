namespace ProjectHub.Application;

public record SetupRequest(
    string Token,
    string Email,
    string Name,
    string Password,
    string? PhoneNumber = null,
    string? Language = null);
