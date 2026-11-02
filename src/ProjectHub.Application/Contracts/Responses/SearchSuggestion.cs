namespace ProjectHub.Application;

public record SearchSuggestion(
    string Kind,
    Guid Id,
    string Name,
    string Code,
    Guid? ClientId);
