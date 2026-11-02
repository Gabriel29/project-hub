using Microsoft.EntityFrameworkCore;
using ProjectHub.Application;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

public sealed class FolderTree(
    PortalDb db,
    ICurrentUser actor)
{
    public async Task<DocumentFolder> EnsureSectionAsync(Guid project, string key, CancellationToken ct = default)
    {
        ActorGuard.Manager(actor);
        if (!SharedFolders.Names.TryGetValue(key, out var name))
        {
            throw new PortalException(400, "invalidSection");
        }

        var tree = await db.Folders.Where(f => f.ProjectId == project).ToListAsync(ct);
        var existing = tree.SingleOrDefault(f => f.SectionKey == key);
        if (existing != null)
        {
            return existing;
        }

        var root = tree.Single(f => f.ParentId == null);
        var folder = tree.SingleOrDefault(f => f.ParentId == root.Id && f.Name == name);
        if (folder == null)
        {
            folder = new DocumentFolder
            {
                ProjectId = project,
                ParentId = root.Id,
                Name = name,
                CreatedBy = actor.Id
            };
            db.Add(folder);
        }

        folder.SectionKey = key;
        await db.SaveChangesAsync(ct);
        return folder;
    }

    public async Task ValidateFolderAsync(Guid projectId, Guid? folderId, CancellationToken ct = default)
    {
        ActorGuard.Manager(actor);
        if (folderId != null && !(await db.Folders.AsNoTracking().AnyAsync(f => f.Id == folderId && f.ProjectId == projectId, ct)))
        {
            throw new PortalException(400, "folderOutsideProject");
        }
    }
}
