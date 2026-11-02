using Microsoft.EntityFrameworkCore;
using ProjectHub.Application;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

public sealed class FolderService(
    PortalDb db,
    ProjectWriteAccess projects,
    FolderTree tree,
    FileDeletion deletion,
    ICurrentUser actor)
{
    public async Task CreateFolderAsync(Guid projectId, FolderRequest request, CancellationToken ct = default)
    {
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        projects.Manager();
        var name = request.Name?.Trim() ?? "";
        if (!SharedFolders.ValidName(name))
        {
            throw new PortalException(400, "invalidFolderName");
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.LockProjectAsync(projectId, ct);
        var project = await projects.GetForUpdateAsync(projectId, ct);
        var root = (await db.Folders.SingleAsync(f => f.ProjectId == projectId && f.ParentId == null, ct));
        var section = request.SectionKey == null ? null : await tree.EnsureSectionAsync(projectId, request.SectionKey, ct);
        var parent = request.ParentId ?? section?.Id ?? root.Id;
        await tree.ValidateFolderAsync(projectId, parent, ct);
        if (section != null && SharedFolders.Section(await db.Folders.Where(f => f.ProjectId == projectId).ToListAsync(ct), parent) != request.SectionKey)
        {
            throw new PortalException(400, "folderOutsideSection");
        }

        var fixedKey = parent == root.Id ? SharedFolders.Names.FirstOrDefault(p => p.Value == name).Key : null;
        if (fixedKey != null)
        {
            await tree.EnsureSectionAsync(projectId, fixedKey, ct);
        }
        else
        {
            db.Add(new DocumentFolder { ProjectId = projectId, ParentId = parent, Name = name, CreatedBy = actor.Id });
            await db.SaveChangesAsync(ct);
        }

        project.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task RenameFolderAsync(Guid projectId, Guid folderId, RenameFolderRequest request, CancellationToken ct = default)
    {
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        projects.Manager();
        var name = request.Name?.Trim() ?? "";
        if (!SharedFolders.ValidName(name))
        {
            throw new PortalException(400, "invalidFolderName");
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.LockProjectAsync(projectId, ct);
        var project = await projects.GetForUpdateAsync(projectId, ct);
        var folders = await db.Folders.Where(f => f.ProjectId == projectId).ToListAsync(ct);
        var folder = folders.SingleOrDefault(f => f.Id == folderId) ?? throw new PortalException(404, "folderOutsideProject");
        if (folder.ParentId == null || folder.SectionKey != null)
        {
            throw new PortalException(400, "invalidFolder");
        }

        if (folders.Any(f => f.Id != folderId && f.ParentId == folder.ParentId && f.Name == name))
        {
            throw new PortalException(400, "folderNameExists");
        }

        folder.Name = name;
        project.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task MoveFolderAsync(Guid projectId, Guid folderId, MoveFileRequest request, CancellationToken ct = default)
    {
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        projects.Manager();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.LockProjectAsync(projectId, ct);
        var project = await projects.GetForUpdateAsync(projectId, ct);
        var folders = await db.Folders.Where(f => f.ProjectId == projectId).ToListAsync(ct);
        var folder = folders.SingleOrDefault(f => f.Id == folderId && f.ParentId != null && f.SectionKey == null) ?? throw new PortalException(400, "invalidFolder");
        var target = request.FolderId ?? folders.Single(f => f.ParentId == null).Id;
        await tree.ValidateFolderAsync(projectId, target, ct);
        Guid? parent = target;
        while (parent != null)
        {
            if (parent == folderId)
            {
                throw new PortalException(400, "folderMoveCycle");
            }

            parent = folders.Single(f => f.Id == parent).ParentId;
        }

        if (folders.Any(f => f.Id != folderId && f.ParentId == target && f.Name == folder.Name))
        {
            throw new PortalException(400, "folderNameExists");
        }

        var subtree = new HashSet<Guid>
        {
            folderId
        };
        bool added;
        do
        {
            added = false;
            foreach (var child in folders.Where(f => f.ParentId != null && subtree.Contains(f.ParentId.Value)))
            {
                added |= subtree.Add(child.Id);
            }
        }
        while (added);
        var movedFiles = await db.Files.Where(f => f.ProjectId == projectId && subtree.Contains(f.FolderId)).ToListAsync(ct);
        var movedContents = await db.Contents.AsNoTracking().Where(c => movedFiles.Select(f => f.Id).Contains(c.ProjectFileId)).ToListAsync(ct);
        if (SharedFolders.Policy(folders, target)?.ImagesOnly == true && movedContents.Any(c => !c.ContentType.StartsWith("image/")))
        {
            throw new PortalException(400, "progressPhotosOnly");
        }

        var photoIds = movedContents.Select(c => c.Id).ToArray();
        if (SharedFolders.Policy(folders, target)?.PublishedPhotosOnly != true && (await db.CalendarEntries.AsNoTracking().Where(e => e.ProjectId == projectId).ToListAsync(ct)).Any(e => e.PhotoIds.Any(id => photoIds.Contains(id)) || (e.PhotoContentId != null && photoIds.Contains(e.PhotoContentId.Value))))
        {
            throw new PortalException(400, "detachPhotosBeforeMove");
        }

        project.UpdatedAt = DateTimeOffset.UtcNow;
        folder.ParentId = target;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task DeleteFolderAsync(Guid projectId, Guid folderId, CancellationToken ct = default)
    {
        projects.Manager();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.LockProjectAsync(projectId, ct);
        var project = await projects.GetForUpdateAsync(projectId, ct);
        var folders = await db.Folders.Where(f => f.ProjectId == projectId).ToListAsync(ct);
        var folder = folders.SingleOrDefault(f => f.Id == folderId && f.ParentId != null && f.SectionKey == null) ?? throw new PortalException(400, "invalidFolder");
        var descendants = new List<DocumentFolder>
        {
            folder
        };
        for (var index = 0; index < descendants.Count; index++)
        {
            descendants.AddRange(folders.Where(f => f.ParentId == descendants[index].Id));
        }

        var folderIds = descendants.Select(f => f.Id).ToArray();
        await deletion.RemoveFilesAsync(projectId, await db.Files.Where(f => folderIds.Contains(f.FolderId)).ToListAsync(ct), ct);
        await db.SaveChangesAsync(ct);
        // Delete leaves first because folder parents use a restrictive foreign key.
        foreach (var child in descendants.AsEnumerable().Reverse())
        {
            db.Remove(child);
            await db.SaveChangesAsync(ct);
        }

        await tx.CommitAsync(ct);
    }
}
