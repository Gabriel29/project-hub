using ProjectHub.Application;
using ProjectHub.Domain;

namespace ProjectHub.Infrastructure;

public class ClientService(
    PortalDb db,
    IIdentityGateway identity,

    ICurrentUser actor)
{
    public async Task<(UserDto User, LinkDto? Link)> CreateAsync(UserRequest request, CancellationToken ct = default)
    {
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        ActorGuard.Manager(actor);
        if (request.Admin && !actor.IsOwner)
        {
            throw new PortalException(403, "accessDenied");
        }

        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 120)
        {
            throw new PortalException(400, "invalidName");
        }

        CredentialRules.Email(request.Email);
        if (!request.Admin && (string.IsNullOrWhiteSpace(request.ClientName) || request.ClientName.Length > 120))
        {
            throw new PortalException(400, "invalidClientName");
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var result = await identity.CreateAsync(request, ct);
        if (!request.Admin)
        {
            var client = new Client
            {
                Name = request.ClientName!.Trim(),
                UserId = result.User.Id
            };
            db.Add(client);
            await db.SaveChangesAsync(ct);
            result = (result.User with { ClientId = client.Id }, result.Link);
        }

        await tx.CommitAsync(ct);
        return result;
    }

    public Task<LinkDto> GenerateAsync(string id, string purpose, CancellationToken ct = default)
    {
        ActorGuard.Manager(actor);
        return identity.GenerateAsync(id, purpose, ct);
    }

    public Task<List<UserDto>> UsersAsync(CancellationToken ct = default)
    {
        ActorGuard.Manager(actor);
        return identity.UsersAsync(ct);
    }

    public Task DisableAsync(string id, bool disabled, CancellationToken ct = default)
    {
        ActorGuard.Manager(actor);
        return identity.DisableAsync(id, disabled, ct);
    }

    public Task RevokeAsync(string id, CancellationToken ct = default)
    {
        ActorGuard.Manager(actor);
        return identity.RevokeAsync(id, ct);
    }
}
