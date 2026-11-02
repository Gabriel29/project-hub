namespace ProjectHub.Application;

public record ProfileRequest(
    string Name,
    string Email,
    string? PhoneNumber,
    string CurrentPassword,
    string? Language = null);
