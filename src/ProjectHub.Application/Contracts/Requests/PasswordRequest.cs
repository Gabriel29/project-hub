namespace ProjectHub.Application;

public record PasswordRequest(
    string Password,
    string? CurrentPassword);
