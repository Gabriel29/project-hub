using Microsoft.EntityFrameworkCore;
using ProjectHub.Application;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

public sealed class FileDeletion(
    PortalDb db,
    ProjectWriteAccess projects)
{
    public async Task RemoveFilesAsync(Guid projectId, List<ProjectFile> files, CancellationToken ct = default)
    {
        projects.Manager();
        var fileIds = files.Select(f => f.Id).ToArray();
        var contents = await db.Contents.Where(v => fileIds.Contains(v.ProjectFileId)).ToListAsync(ct);
        var ids = contents.Select(v => v.Id).ToArray();
        var project = await projects.GetForUpdateAsync(projectId, ct);
        if ((await db.CalendarEntries.AsNoTracking().Where(e => e.ProjectId == projectId).ToListAsync(ct)).Any(e => e.PhotoIds.Any(id => ids.Contains(id)) || (e.PhotoContentId != null && ids.Contains(e.PhotoContentId.Value))))
        {
            throw new PortalException(400, "detachPhotosBeforeDelete");
        }

        foreach (var content in contents)
        {
            db.Set<StorageDeletion>().Add(new StorageDeletion { ObjectKey = content.ObjectKey });
            db.Remove(content);
        }

        foreach (var file in files)
        {
            db.Remove(file);
        }

        project.UpdatedAt = DateTimeOffset.UtcNow;
    }
}
