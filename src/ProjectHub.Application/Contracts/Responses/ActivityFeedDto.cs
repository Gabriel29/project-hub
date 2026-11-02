namespace ProjectHub.Application;

public record ActivityFeedDto(
    IReadOnlyList<CalendarEntryDto> Updates,
    IReadOnlyList<FileDto> Files);
