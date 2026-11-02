namespace ProjectHub.Application;

public record UploadCommand(
    string Title,
    Guid? FolderId,
    Guid? FileId,
    string FileName,
    byte[] Content,
    bool CalendarPhoto = false,
    string? SectionKey = null);
