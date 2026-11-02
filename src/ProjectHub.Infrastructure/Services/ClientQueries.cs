using Microsoft.EntityFrameworkCore;
using ProjectHub.Application;

namespace ProjectHub.Infrastructure;

public sealed class ClientQueries(PortalDb db, ICurrentUser actor)
{
    public async Task<List<ClientDto>> ListAsync(CancellationToken ct = default)
    {
        ActorGuard.Manager(actor);
        return await (
            from client in db.Clients.AsNoTracking()
            join user in db.Users.AsNoTracking() on client.UserId equals user.Id
            orderby client.Name
            select new ClientDto(client.Id, client.Name, user.Email, client.CodePrefix)).ToListAsync(ct);
    }

    public async Task<ClientProfileDto> MyDetailsAsync(CancellationToken ct = default)
    {
        ActorGuard.Authenticated(actor);
        if (actor.IsManager)
        {
            throw new PortalException(403, "accessDenied");
        }

        return await (
            from client in db.Clients.AsNoTracking()
            join user in db.Users.AsNoTracking() on client.UserId equals user.Id
            where client.UserId == actor.Id
            select new ClientProfileDto(client.Id, user.DisplayName, user.Email, user.PhoneNumber)).SingleOrDefaultAsync(ct) ?? throw new PortalException(404, "clientNotFound");
    }
}
