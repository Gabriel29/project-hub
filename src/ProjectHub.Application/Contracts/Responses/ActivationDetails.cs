namespace ProjectHub.Application;

public record ActivationDetails(
    string Name,
    string? Email,
    string? PhoneNumber,
    string? Language = null);
