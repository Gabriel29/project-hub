namespace ProjectHub.Application;

public record ProjectStatusRequest(
    Guid? StageId,
    bool StagesCompleted = false);
