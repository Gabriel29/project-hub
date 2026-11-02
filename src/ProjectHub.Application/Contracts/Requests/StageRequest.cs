namespace ProjectHub.Application;

public record StageRequest(
    Guid? Id,
    string Name,
    string Description = "");
