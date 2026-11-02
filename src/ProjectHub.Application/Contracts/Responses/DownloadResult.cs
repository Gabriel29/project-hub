namespace ProjectHub.Application;

public record DownloadResult(
    StoredFile File,
    string FileName,
    bool Inline);
