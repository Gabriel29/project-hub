using System.Text.Json.Serialization;
using ProjectHub.Application;

namespace ProjectHub.WebAPI;

public record ProjectRequest(
    string Name,
    string Location,
    string? Description,
    [property: JsonRequired] Guid? ClientId,
    string ManagerUserId)
{
    public ProjectChanges Changes() => new(Name, Location, Description, ClientId, ManagerUserId);
}
