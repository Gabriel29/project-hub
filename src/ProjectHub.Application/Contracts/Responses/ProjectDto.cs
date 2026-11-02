namespace ProjectHub.Application;

public record ProjectDto(
    Guid Id,
    string Code,
    string Name,
    string Location,
    string Description,
    string Manager,
    string ManagerPhone,
    Guid? StageId,
    DateTimeOffset UpdatedAt,
    Guid? ClientId,
    IReadOnlyList<MilestoneDto> Milestones,
    string? ManagerUserId = null,
    DateOnly? NextMaintenanceDate = null,
    bool StagesCompleted = false,
    string? ManagerEmail = null,
    string? ClientContactName = null,
    string? ClientContactEmail = null,
    string? ClientContactPhone = null);
