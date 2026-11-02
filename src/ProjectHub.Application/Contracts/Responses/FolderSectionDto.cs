namespace ProjectHub.Application;

public record FolderSectionDto(
    string Key,
    string Name,
    bool ClientVisible,
    bool ClientCanUpload,
    bool CanUpload,
    bool ImagesOnly,
    Guid FolderId);
