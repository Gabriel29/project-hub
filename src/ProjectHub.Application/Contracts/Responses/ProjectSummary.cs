namespace ProjectHub.Application;

public record ProjectSummary(
    Guid Id,
    string Code,
    string Name,
    string Location,
    Guid? StageId,
    DateTimeOffset UpdatedAt,
    Guid? ClientId);
