using Microsoft.EntityFrameworkCore;
using ProjectHub.Application;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

public sealed class ActivityService(
    PortalDb db,
    ProjectWriteAccess projects,
    ICurrentUser actor)
{
    public Task AddEntryAsync(Guid id, CalendarEntryRequest request, CancellationToken ct = default) => SaveEntryAsync(id, null, request, ct);

    public Task EditEntryAsync(Guid id, Guid entryId, CalendarEntryRequest request, CancellationToken ct = default) => SaveEntryAsync(id, entryId, request, ct);

    public async Task DeleteEntryAsync(Guid id, Guid entryId, CancellationToken ct = default)
    {
        projects.Manager();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.LockProjectAsync(id, ct);
        var project = await projects.GetForUpdateAsync(id, ct);
        var entry = await db.CalendarEntries.SingleOrDefaultAsync(entity => entity.ProjectId == id && entity.Id == entryId, ct) ?? throw new PortalException(404, "activityNotFound");
        db.Remove(entry);
        project.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    private async Task SaveEntryAsync(Guid id, Guid? entryId, CalendarEntryRequest request, CancellationToken ct = default)
    {
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        projects.Manager();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.LockProjectAsync(id, ct);
        var project = await projects.GetForUpdateAsync(id, ct);
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 200 || request.Details == null || request.Details.Length > 4000)
        {
            throw new PortalException(400, "invalidUpdate");
        }

        var photoIds = ActivityPhotoRules.Ordered(request.PhotoIds, request.PhotoContentId);
        if (photoIds.Length > 20)
        {
            throw new PortalException(400, "activityPhotoLimit");
        }

        var folders = await db.Folders.AsNoTracking().Where(f => f.ProjectId == id).ToListAsync(ct);
        var files = (await db.Files.AsNoTracking().Where(f => f.ProjectId == id).ToListAsync(ct)).Where(f => SharedFolders.Policy(folders, f.FolderId)?.PublishedPhotosOnly == true).ToList();
        var valid = await db.Contents.AsNoTracking().Where(v => photoIds.Contains(v.Id) && files.Select(f => f.Id).Contains(v.ProjectFileId)).ToListAsync(ct);
        if (valid.Count != photoIds.Length)
        {
            throw new PortalException(400, "invalidPhotos");
        }

        var primary = photoIds.Length == 0 ? (Guid?)null : photoIds[0];
        var entry = entryId == null ? new CalendarEntry
        {
            ProjectId = id,
            ActorId = actor.Id
        }

        : await db.CalendarEntries.SingleOrDefaultAsync(entity => entity.ProjectId == id && entity.Id == entryId.Value, ct) ?? throw new PortalException(404, "activityNotFound");
        entry.Title = request.Title.Trim();
        entry.Details = request.Details.Trim();
        entry.OccurredAt = request.OccurredAt == default ? (entryId == null ? DateTimeOffset.UtcNow : entry.OccurredAt) : request.OccurredAt;
        entry.PhotoContentId = primary;
        entry.PhotoIds = photoIds;
        if (entryId == null)
        {
            db.Add(entry);
        }

        project.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }
}
