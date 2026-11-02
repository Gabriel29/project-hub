namespace ProjectHub.Application;

public record FolderContentsDto(
    FolderDto Folder,
    IReadOnlyList<FolderDto> Breadcrumbs,
    IReadOnlyList<FolderDto> Folders,
    IReadOnlyList<FileDto> Files,
    IReadOnlyList<FolderDto> Paths);
