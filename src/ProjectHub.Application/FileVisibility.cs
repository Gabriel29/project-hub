using ProjectHub.Domain;

namespace ProjectHub.Application;

public static class FileVisibility
{
    public static bool CanRead(ProjectFile file, FileContent? content, IReadOnlyCollection<DocumentFolder> folders, IReadOnlyCollection<CalendarEntry> activities)
    {
        var policy = SharedFolders.Policy(folders, file.FolderId);
        return policy is { ClientVisible: true, PublishedPhotosOnly: false } || content != null && activities.Any(a => a.PhotoContentId == content.Id || a.PhotoIds.Contains(content.Id));
    }
}
