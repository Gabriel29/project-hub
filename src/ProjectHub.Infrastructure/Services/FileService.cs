using Microsoft.EntityFrameworkCore;
using ProjectHub.Application;

namespace ProjectHub.Infrastructure;

public sealed class FileService(
    PortalDb db,
    ProjectWriteAccess projects,
    FolderTree tree,
    FileDeletion deletion)
{
    public async Task RenameAsync(Guid projectId, Guid fileId, RenameFileRequest request, CancellationToken ct = default)
    {
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        projects.Manager();
        var title = request.Title?.Trim() ?? "";
        if (title.Length is < 1 or > 200)
        {
            throw new PortalException(400, "invalidFileName");
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.LockProjectAsync(projectId, ct);
        var project = await projects.GetForUpdateAsync(projectId, ct);
        var file = await db.LockFileAsync(fileId, projectId, ct) ?? throw new PortalException(404, "fileNotFound");
        file.Title = title;
        project.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task MoveAsync(Guid projectId, Guid fileId, MoveFileRequest request, CancellationToken ct = default)
    {
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        projects.Manager();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.LockProjectAsync(projectId, ct);
        var project = await projects.GetForUpdateAsync(projectId, ct);
        var target = request.FolderId ?? (await db.Folders.AsNoTracking().SingleAsync(f => f.ProjectId == projectId && f.ParentId == null, ct)).Id;
        await tree.ValidateFolderAsync(projectId, target, ct);
        var file = (await db.Files.SingleOrDefaultAsync(f => f.Id == fileId && f.ProjectId == projectId, ct)) ?? throw new PortalException(404, "documentNotFound");
        var folders = await db.Folders.AsNoTracking().Where(f => f.ProjectId == projectId).ToListAsync(ct);
        var content = (await db.Contents.AsNoTracking().SingleAsync(c => c.ProjectFileId == fileId, ct));
        if (SharedFolders.Policy(folders, target)?.ImagesOnly == true && !content.ContentType.StartsWith("image/"))
        {
            throw new PortalException(400, "progressPhotosOnly");
        }

        var published = (await db.CalendarEntries.AsNoTracking().Where(e => e.ProjectId == projectId).ToListAsync(ct)).Any(e => e.PhotoIds.Contains(content.Id) || e.PhotoContentId == content.Id);
        if (published && SharedFolders.Policy(folders, target)?.PublishedPhotosOnly != true)
        {
            throw new PortalException(400, "detachPhotoBeforeMove");
        }

        project.UpdatedAt = DateTimeOffset.UtcNow;
        file.FolderId = target;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task DeleteAsync(Guid projectId, Guid fileId, CancellationToken ct = default)
    {
        projects.Manager();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.LockProjectAsync(projectId, ct);
        var project = await projects.GetForUpdateAsync(projectId, ct);
        var file = await db.LockFileAsync(fileId, projectId, ct) ?? throw new PortalException(404, "fileNotFound");
        await deletion.RemoveFilesAsync(projectId, [file], ct);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }
}
