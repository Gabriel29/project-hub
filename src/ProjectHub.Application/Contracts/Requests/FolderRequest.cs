namespace ProjectHub.Application;

public record FolderRequest(
    string Name,
    Guid? ParentId = null,
    string? SectionKey = null);
