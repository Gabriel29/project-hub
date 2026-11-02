using Microsoft.EntityFrameworkCore;
using ProjectHub.Application;
using System.Security.Cryptography;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

public sealed class UploadService(
    PortalDb db,
    IFileStorage storage,
    ProjectWriteAccess projects,
    ICurrentUser actor,
    FolderTree tree,
    IUploadRecovery recovery)
{
    public async Task<UploadResult> UploadAsync(Guid projectId, UploadCommand request, CancellationToken ct)
    {
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        projects.Manager();
        if (request.Content == null || request.Content.Length is <= 0 or > 25_000_000 || string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 200)
        {
            throw new PortalException(400, "invalidFileSize");
        }

        if (string.IsNullOrWhiteSpace(request.FileName))
        {
            throw new PortalException(400, "invalidFileFormat");
        }

        var ext = Path.GetExtension(request.FileName).ToLowerInvariant();
        var type = FileRules.ContentType(ext, request.Content);
        if (type == null)
        {
            throw new PortalException(400, "invalidFileFormat");
        }

        var filename = Path.GetFileName(request.FileName);
        if (filename.Length > 240)
        {
            throw new PortalException(400, "fileNameTooLong");
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.LockProjectAsync(projectId, ct);
        await projects.GetForUpdateAsync(projectId, ct);
        ProjectFile file;
        if (request.FileId != null)
        {
            throw new PortalException(400, "revisionsUnsupported");
        }

        {
            if (request.CalendarPhoto)
            {
                projects.Manager();
                if (request.FolderId != null || request.SectionKey != null)
                {
                    throw new PortalException(400, "invalidPhotoDestination");
                }
            }

            var root = (await db.Folders.AsNoTracking().SingleAsync(f => f.ProjectId == projectId && f.ParentId == null, ct));
            var folderId = request.FolderId ?? root.Id;
            var sectionKey = request.CalendarPhoto ? "progress" : request.SectionKey;
            if (sectionKey != null)
            {
                var section = await tree.EnsureSectionAsync(projectId, sectionKey, ct);
                folderId = request.FolderId ?? section.Id;
                var sectionFolders = await db.Folders.AsNoTracking().Where(f => f.ProjectId == projectId).ToListAsync(ct);
                if (SharedFolders.Section(sectionFolders, folderId) != sectionKey)
                {
                    throw new PortalException(400, "folderOutsideSection");
                }
            }

            var folders = await db.Folders.AsNoTracking().Where(f => f.ProjectId == projectId).ToListAsync(ct);
            var policy = SharedFolders.Policy(folders, folderId);
            if (!actor.IsManager && !SharedFolders.ClientUploadAllowed(policy))
            {
                throw new PortalException(403, "uploadForbidden");
            }

            if (policy?.ImagesOnly == true && !type.StartsWith("image/"))
            {
                throw new PortalException(400, "progressPhotosOnly");
            }

            await tree.ValidateFolderAsync(projectId, folderId, ct);
            file = new()
            {
                ProjectId = projectId,
                Title = request.Title.Trim(),
                FolderId = folderId
            };
            db.Add(file);
        }

        var key = $"projects/{projectId}/{Guid.NewGuid():N}{ext}";
        var content = new FileContent
        {
            ProjectFileId = file.Id,
            ObjectKey = key,
            FileName = filename,
            ContentType = type,
            Size = request.Content.LongLength,
            Sha256 = Convert.ToHexString(SHA256.HashData(request.Content)),
            UploadedBy = actor.Id
        };
        using var body = new MemoryStream(request.Content);
        try
        {
            await storage.PutAsync(key, body, type, ct);
            db.Add(content);
            var project = await projects.GetForUpdateAsync(projectId, ct);
            project.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch
        {
            // Release/roll back the transaction before checking committed state in an independent scope.
            await tx.DisposeAsync();
            await recovery.RecoverAsync(key, CancellationToken.None);
            throw;
        }

        return new(file.Id, content.Id);
    }
}
