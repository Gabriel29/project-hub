namespace ProjectHub.Application;

public interface IFileStorage
{
    Task PutAsync(string key, Stream body, string contentType, CancellationToken ct);
    Task<StoredFile> GetAsync(string key, CancellationToken ct);
    Task DeleteAsync(string key, CancellationToken ct);
}
