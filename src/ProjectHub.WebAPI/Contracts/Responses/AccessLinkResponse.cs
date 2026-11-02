namespace ProjectHub.WebAPI;

public sealed record AccessLinkResponse(
    Guid Id,
    DateTimeOffset ExpiresAt,
    string Url);
