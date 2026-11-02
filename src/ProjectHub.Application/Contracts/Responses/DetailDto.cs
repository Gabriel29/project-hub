namespace ProjectHub.Application;

public record DetailDto(
    ProjectDto Project,
    Guid? RootFolderId);
