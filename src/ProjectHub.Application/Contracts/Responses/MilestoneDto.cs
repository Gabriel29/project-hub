namespace ProjectHub.Application;

public record MilestoneDto(
    Guid Id,
    string Name,
    int OrderIndex,
    string Description,
    bool StageComplete = false);
