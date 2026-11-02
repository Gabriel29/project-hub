namespace ProjectHub.WebAPI;

public sealed record CreatedAccountResponse(
    string Id,
    Guid? ClientId,
    AccessLinkResponse? Link);
