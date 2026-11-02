namespace ProjectHub.Application;

public sealed record StoredFile(
    Stream Body,
    string ContentType,
    IDisposable Owner);
