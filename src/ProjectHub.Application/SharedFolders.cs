using ProjectHub.Domain;

namespace ProjectHub.Application;

public record FolderPolicy(string Name, bool ClientVisible, bool ClientCanUpload, bool ImagesOnly = false, bool PublishedPhotosOnly = false);
public static class SharedFolders
{
    // One source of truth for client visibility and uploads, including inherited subfolder permissions.
    public static readonly IReadOnlyDictionary<string, FolderPolicy> Policies = new Dictionary<string, FolderPolicy>
    {
        ["progress"] = new(".progress", true, false, PublishedPhotosOnly: true),
        ["contracts"] = new(".contracts", true, false),
        ["warranty"] = new(".warranty", true, false),
        ["maintenance"] = new(".maintanance", true, false),
        ["technical"] = new(".technicaldocs", true, false)
    };
    public static readonly IReadOnlyDictionary<string, string> Names = Policies.ToDictionary(p => p.Key, p => p.Value.Name);

    public static string? Section(IEnumerable<DocumentFolder> folders, Guid? id)
    {
        var byId = folders.ToDictionary(f => f.Id);
        var seen = new HashSet<Guid>();
        while (id != null && seen.Add(id.Value) && byId.TryGetValue(id.Value, out var folder))
        {
            if (folder.SectionKey != null)
            {
                return folder.SectionKey;
            }

            id = folder.ParentId;
        }

        return null;
    }

    public static FolderPolicy? Policy(IEnumerable<DocumentFolder> folders, Guid? id) => Section(folders, id) is string key && Policies.TryGetValue(key, out var policy) ? policy : null;

    public static bool ClientUploadAllowed(FolderPolicy? policy) => policy is { ClientVisible: true, ClientCanUpload: true };

    public static bool ValidName(string name) => name.Length is > 0 and <= 120 && name is not "." and not ".." && !name.StartsWith('.') && name.All(c => char.IsLetterOrDigit(c) || " &()-_.,".Contains(c));
}
