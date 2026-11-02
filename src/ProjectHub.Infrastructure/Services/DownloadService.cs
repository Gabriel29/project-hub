using Microsoft.EntityFrameworkCore;
using ProjectHub.Application;

namespace ProjectHub.Infrastructure;

public sealed class DownloadService(
    PortalDb db,
    IFileStorage storage,
    ProjectAccess projects,
    ICurrentUser actor)
{
    public async Task<DownloadResult> DownloadAsync(Guid projectId, Guid fileId, bool inline, CancellationToken ct)
    {
        await projects.AccessibleAsync(projectId, ct);
        var file = (await db.Files.AsNoTracking().SingleOrDefaultAsync(f => f.Id == fileId && f.ProjectId == projectId, ct)) ?? throw new PortalException(404, "documentNotFound");
        var folders = await db.Folders.AsNoTracking().Where(f => f.ProjectId == projectId).ToListAsync(ct);
        var content = (await db.Contents.AsNoTracking().SingleOrDefaultAsync(c => c.ProjectFileId == fileId, ct));
        if (!actor.IsManager && !FileVisibility.CanRead(file, content, folders, await db.CalendarEntries.AsNoTracking().Where(e => e.ProjectId == projectId).ToListAsync(ct)))
        {
            throw new PortalException(404, "documentNotFound");
        }

        var v = content ?? throw new PortalException(404, "fileNotFound");
        return new(await storage.GetAsync(v.ObjectKey, ct), FileRules.DownloadName(file.Title, v.FileName), inline && (v.ContentType.StartsWith("image/") || v.ContentType == "application/pdf"));
    }
}
