namespace ProjectHub.Application;

public record RecentDocumentsDto(
    IReadOnlyList<FileDto> Files,
    IReadOnlyList<FolderDto> Folders);
