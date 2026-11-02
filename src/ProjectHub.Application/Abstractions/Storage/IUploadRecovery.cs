namespace ProjectHub.Application;

public interface IUploadRecovery
{
    Task RecoverAsync(string objectKey, CancellationToken ct = default);
}
