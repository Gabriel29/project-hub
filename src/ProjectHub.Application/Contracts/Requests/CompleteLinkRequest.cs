namespace ProjectHub.Application;

public record CompleteLinkRequest(
    string Token,
    string Password,
    string? Email,
    string? PhoneNumber = null,
    string? Name = null,
    string? Language = null);
