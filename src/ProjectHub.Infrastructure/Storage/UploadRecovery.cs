using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using ProjectHub.Application;

namespace ProjectHub.Infrastructure;

public sealed class UploadRecovery(IServiceScopeFactory scopes, IFileStorage storage, ILogger<UploadRecovery> logger) : IUploadRecovery
{
    public async Task RecoverAsync(string objectKey, CancellationToken ct = default)
    {
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(30));
            await using var scope = scopes.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<PortalDb>();
            // A commit acknowledgement can fail after PostgreSQL has committed. Never delete referenced bytes.
            if (await db.Contents.AsNoTracking().AnyAsync(content => content.ObjectKey == objectKey, timeout.Token))
            {
                return;
            }

            db.Add(new ProjectHub.Domain.StorageDeletion { ObjectKey = objectKey });
            await db.SaveChangesAsync(timeout.Token);
            // The durable job remains until a worker confirms deletion, including when this attempt fails.
            await storage.DeleteAsync(objectKey, timeout.Token);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Upload recovery for {ObjectKey} could not finish; queued cleanup or reconciliation is required", objectKey);
        }
    }
}
