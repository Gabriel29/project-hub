using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ProjectHub.Application;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

public sealed class StorageCleanupBatch(PortalDb db, IFileStorage storage, ILogger<StorageCleanupBatch> logger, IConfiguration configuration)
{
    private readonly TimeSpan deletionTimeout = GetDeletionTimeout(configuration);

    private static TimeSpan GetDeletionTimeout(IConfiguration configuration)
    {
        var minutes = configuration.GetValue<int?>("STORAGE_DELETION_TIMEOUT_MINUTES") ?? 90;
        var timeout = TimeSpan.FromMinutes(minutes);
        if (minutes <= 0 || timeout.TotalMilliseconds > uint.MaxValue - 1)
        {
            throw new InvalidOperationException("STORAGE_DELETION_TIMEOUT_MINUTES must be between 1 and 71582.");
        }

        return timeout;
    }

    public async Task<int> RunAsync(CancellationToken ct = default)
    {
        var processed = 0;
        for (var index = 0; index < 20; index++)
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            // The row lock remains held until deletion or retry scheduling commits. Other workers skip it.
            var job = await db.Set<StorageDeletion>().FromSqlRaw("SELECT * FROM projecthub.\"StorageDeletions\" WHERE \"NextAttemptAt\" <= now() ORDER BY \"NextAttemptAt\", \"Id\" LIMIT 1 FOR UPDATE SKIP LOCKED").SingleOrDefaultAsync(ct);
            if (job == null)
            {
                break;
            }

            try
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
                timeout.CancelAfter(deletionTimeout);
                await storage.DeleteAsync(job.ObjectKey, timeout.Token);
                db.Remove(job);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                job.Attempts = Math.Min(job.Attempts + 1, 1000000);
                job.NextAttemptAt = DateTimeOffset.UtcNow.AddSeconds(Math.Min(3600, 5 * Math.Pow(2, Math.Min(job.Attempts, 10))));
                logger.LogWarning(exception, "Storage deletion {DeletionId} failed on attempt {Attempt}; retry at {NextAttemptAt}", job.Id, job.Attempts, job.NextAttemptAt);
            }

            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            db.ChangeTracker.Clear();
            processed++;
        }

        var remaining = await db.Set<StorageDeletion>().AsNoTracking().CountAsync(ct);
        if (remaining > 0)
        {
            logger.LogInformation("Storage cleanup backlog contains {PendingCount} objects", remaining);
        }

        return processed;
    }
}

public sealed class StorageCleanupWorker(IServiceScopeFactory scopes, IConfiguration configuration, ILogger<StorageCleanupWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (configuration.GetValue<bool>("MAINTENANCE_MODE") || configuration.GetValue<bool?>("STORAGE_CLEANUP_ENABLED") == false)
        {
            return;
        }

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<StorageCleanupBatch>().RunAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Storage cleanup batch failed; retrying on the next interval");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
