namespace ProjectHub.Application;

public record FolderDto(
    Guid Id,
    string Name,
    Guid? ParentId,
    string? SectionKey,
    bool ClientVisible,
    bool ClientCanUpload,
    bool CanUpload,
    bool ImagesOnly);
