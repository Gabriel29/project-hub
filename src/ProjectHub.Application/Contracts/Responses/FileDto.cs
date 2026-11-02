namespace ProjectHub.Application;

public record FileDto(
    Guid Id,
    string Title,
    Guid? FolderId,
    FileContentDto Content,
    bool CalendarPhoto = false);
