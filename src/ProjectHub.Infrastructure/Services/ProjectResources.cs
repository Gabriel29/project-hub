using Microsoft.EntityFrameworkCore;
using ProjectHub.Application;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

public sealed class ProjectResources(
    PortalDb db,
    ProjectAccess projects,
    ICurrentUser actor)
{
    private bool CanBrowse(IEnumerable<DocumentFolder> tree, Guid id) => actor.IsManager || SharedFolders.Policy(tree, id) is { ClientVisible: true, PublishedPhotosOnly: false };

    private async Task<List<DocumentFolder>> AccessiblePathAsync(Guid projectId, Guid folderId, CancellationToken ct)
    {
        await projects.AccessibleAsync(projectId, ct);
        var path = await db.FolderAncestorsAsync(projectId, folderId, ct);
        if (!path.Any(f => f.Id == folderId) || !CanBrowse(path, folderId))
        {
            throw new PortalException(404, "folderOutsideProject");
        }

        return path;
    }

    private List<FolderDto> Breadcrumbs(IReadOnlyList<DocumentFolder> tree, Guid folderId)
    {
        var result = new List<FolderDto>();
        var byId = tree.ToDictionary(f => f.Id);
        var visited = new HashSet<Guid>();
        Guid? current = folderId;
        while (current != null && visited.Add(current.Value) && byId.TryGetValue(current.Value, out var folder))
        {
            if (!CanBrowse(tree, folder.Id))
            {
                break;
            }

            result.Insert(0, ProjectDetailMapper.Folder(folder, tree, actor.IsManager));
            current = folder.ParentId;
        }

        return result;
    }

    public async Task<List<FolderSectionDto>> SectionsAsync(Guid projectId, CancellationToken ct = default)
    {
        await projects.AccessibleAsync(projectId, ct);
        var sections = await db.Folders.AsNoTracking().Where(f => f.ProjectId == projectId && f.SectionKey != null).ToListAsync(ct);
        return sections.Where(folder => CanBrowse(sections, folder.Id)).Select(folder =>
        {
            var policy = SharedFolders.Policies[folder.SectionKey!];
            return new FolderSectionDto(folder.SectionKey!, policy.Name, policy.ClientVisible, policy.ClientCanUpload, actor.IsManager, policy.ImagesOnly, folder.Id);
        }).ToList();
    }

    public async Task<FolderContentsDto> ContentsAsync(Guid projectId, Guid folderId, CancellationToken ct = default)
    {
        var path = await AccessiblePathAsync(projectId, folderId, ct);
        var folder = path.Single(f => f.Id == folderId);
        var children = await db.Folders.AsNoTracking().Where(f => f.ProjectId == projectId && f.ParentId == folderId).ToListAsync(ct);
        var tree = path.Concat(children).ToList();
        var files = await db.Files.AsNoTracking().Where(f => f.ProjectId == projectId && f.FolderId == folderId).ToListAsync(ct);
        var ids = files.Select(f => f.Id).ToArray();
        var contents = await db.Contents.AsNoTracking().Where(c => ids.Contains(c.ProjectFileId)).ToListAsync(ct);
        return new(ProjectDetailMapper.Folder(folder, path, actor.IsManager), Breadcrumbs(path, folderId), children.Where(f => CanBrowse(tree, f.Id)).OrderBy(f => f.Name).Select(f => ProjectDetailMapper.Folder(f, tree, actor.IsManager)).ToList(), ProjectDetailMapper.Files(files, contents), []);
    }

    public async Task<FolderContentsDto> SearchAsync(Guid projectId, Guid folderId, string? query, CancellationToken ct = default)
    {
        var path = await AccessiblePathAsync(projectId, folderId, ct);
        var term = query?.Trim() ?? "";
        if (term.Length == 0)
        {
            throw new PortalException(400, "invalidRequest");
        }

        if (term.Length > 120)
        {
            throw new PortalException(400, "searchTooLong");
        }

        var subtree = await db.FolderDescendantsAsync(projectId, folderId, ct);
        var tree = path.Concat(subtree).DistinctBy(f => f.Id).ToList();
        var allowed = subtree.Where(f => CanBrowse(tree, f.Id)).ToList();
        var ids = allowed.Select(f => f.Id).ToArray();
        var candidates = await db.Files.AsNoTracking().Where(f => f.ProjectId == projectId && ids.Contains(f.FolderId)).ToListAsync(ct);
        var fileIds = candidates.Select(f => f.Id).ToArray();
        var contents = await db.Contents.AsNoTracking().Where(c => fileIds.Contains(c.ProjectFileId)).ToListAsync(ct);
        static bool Matches(string text, string search) => System.Globalization.CultureInfo.InvariantCulture.CompareInfo.IndexOf(text, search, System.Globalization.CompareOptions.IgnoreCase | System.Globalization.CompareOptions.IgnoreNonSpace) >= 0;
        var names = contents.ToDictionary(c => c.ProjectFileId, c => c.FileName);
        var matchedFiles = candidates.Where(f => Matches(f.Title, term) || names.TryGetValue(f.Id, out var name) && Matches(name, term)).ToList();
        var matchedFolders = allowed.Where(f => f.Id != folderId && Matches(f.Name, term)).Select(f => ProjectDetailMapper.Folder(f, tree, actor.IsManager)).ToList();
        var paths = matchedFiles.Select(f => f.FolderId).Concat(matchedFolders.Select(f => f.Id)).SelectMany(id => Breadcrumbs(tree, id)).DistinctBy(f => f.Id).ToList();
        return new(ProjectDetailMapper.Folder(path.Single(f => f.Id == folderId), path, actor.IsManager), Breadcrumbs(path, folderId), matchedFolders, ProjectDetailMapper.Files(matchedFiles, contents), paths);
    }

    public async Task<ActivityFeedDto> ActivitiesAsync(Guid projectId, int? limit = null, CancellationToken ct = default)
    {
        await projects.AccessibleAsync(projectId, ct);
        var query = db.CalendarEntries.AsNoTracking().Where(entry => entry.ProjectId == projectId).OrderByDescending(entry => entry.OccurredAt).ThenByDescending(entry => entry.CreatedAt).AsQueryable();
        var selected = await (limit.HasValue ? query.Take(Math.Clamp(limit.Value, 1, 100)) : query).ToListAsync(ct);
        var ids = selected.SelectMany(e => e.PhotoIds.Concat(e.PhotoContentId.HasValue ? [e.PhotoContentId.Value] : Array.Empty<Guid>())).Distinct().ToArray();
        var contents = await db.Contents.AsNoTracking().Where(c => ids.Contains(c.Id)).ToListAsync(ct);
        var fileIds = contents.Select(c => c.ProjectFileId).ToArray();
        var files = await db.Files.AsNoTracking().Where(f => f.ProjectId == projectId && fileIds.Contains(f.Id)).ToListAsync(ct);
        return new(selected.Select(ActivityPhotoRules.Dto).ToList(), ProjectDetailMapper.Files(files, contents, activityAttachment: true));
    }

    public async Task<RecentDocumentsDto> RecentAsync(Guid projectId, CancellationToken ct = default)
    {
        await projects.AccessibleAsync(projectId, ct);
        var folders = await db.Folders.AsNoTracking().Where(f => f.ProjectId == projectId).ToListAsync(ct);
        var ids = folders.Where(f => SharedFolders.Section(folders, f.Id) is string section && section != "progress" && SharedFolders.Policy(folders, f.Id)?.ClientVisible == true).Select(f => f.Id).ToArray();
        var files = await (
            from file in db.Files.AsNoTracking()
            join content in db.Contents.AsNoTracking() on file.Id equals content.ProjectFileId
            where file.ProjectId == projectId && ids.Contains(file.FolderId)
            orderby content.CreatedAt descending, file.Id
            select file).Take(6).ToListAsync(ct);
        var fileIds = files.Select(f => f.Id).ToArray();
        var contents = await db.Contents.AsNoTracking().Where(c => fileIds.Contains(c.ProjectFileId)).ToListAsync(ct);
        var paths = files.SelectMany(f => Breadcrumbs(folders, f.FolderId)).DistinctBy(f => f.Id).ToList();
        return new(ProjectDetailMapper.Files(files, contents), paths);
    }

    public async Task<List<EventDto>> EventsAsync(Guid projectId, CancellationToken ct = default)
    {
        ActorGuard.Manager(actor);
        await projects.AccessibleAsync(projectId, ct);
        return (await db.Events.AsNoTracking().Where(e => e.ProjectId == projectId).OrderByDescending(e => e.CreatedAt).Take(200).ToListAsync(ct)).Select(e => new EventDto(e.Id, e.Title, e.Details, e.CreatedAt, false)).ToList();
    }
}
