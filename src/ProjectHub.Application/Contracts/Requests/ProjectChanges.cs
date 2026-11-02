namespace ProjectHub.Application;

public record ProjectChanges(
    string Name,
    string Location,
    string? Description,
    Guid? ClientId,
    string ManagerUserId)
{
    public bool Valid() => !string.IsNullOrWhiteSpace(Name) && Name.Length <= 200 && Location != null && Location.Length <= 300 && (Description?.Length ?? 0) <= 6000 && !string.IsNullOrWhiteSpace(ManagerUserId);
}
