using Microsoft.EntityFrameworkCore;
using ProjectHub.Application;

namespace ProjectHub.Infrastructure;

public partial class IdentityGateway
{
    private async Task<List<UserDto>> ReadUsersAsync(string? id = null, CancellationToken ct = default)
    {
        var accounts = await db.Users.AsNoTracking().Where(u => id == null || u.Id == id).OrderBy(u => u.DisplayName).ToListAsync(ct);
        var ids = accounts.Select(u => u.Id).ToArray();
        var roles = await (
            from membership in db.UserRoles.AsNoTracking()
            join role in db.Roles.AsNoTracking() on membership.RoleId equals role.Id
            where ids.Contains(membership.UserId)
            select new
            {
                membership.UserId,
                role.Name
            }

        ).ToListAsync(ct);
        var clients = await db.Clients.AsNoTracking().Where(c => ids.Contains(c.UserId)).ToListAsync(ct);
        var now = DateTimeOffset.UtcNow;
        var links = actor.IsManager ? await db.AccessLinks.AsNoTracking().Where(l => ids.Contains(l.UserId) && l.RevokedAt == null && l.ConsumedAt == null && l.ExpiresAt > now).GroupBy(l => l.UserId).Select(g => new { UserId = g.Key, ExpiresAt = g.Max(l => l.ExpiresAt) }).ToDictionaryAsync(l => l.UserId, l => l.ExpiresAt, ct) : [];
        var roleLookup = roles.ToLookup(r => r.UserId, r => r.Name!);
        var clientLookup = clients.ToDictionary(c => c.UserId);
        return accounts.Select(u =>
        {
            clientLookup.TryGetValue(u.Id, out var client);
            return new UserDto(u.Id, u.Email, u.DisplayName, roleLookup[u.Id].ToList(), u.PasswordHash != null, u.Disabled, client?.Id, u.PhoneNumber, actor.IsManager ? client?.Name : null, u.Language, links.TryGetValue(u.Id, out var expires) ? expires : null);
        }).ToList();
    }

    private async Task<UserDto> DtoAsync(PortalUser user, CancellationToken ct = default) => (await ReadUsersAsync(user.Id, ct)).Single();

    public async Task<AccountContact?> ContactAsync(string? id, CancellationToken ct = default)
    {
        ActorGuard.Authenticated(actor);
        if (id == null)
        {
            return null;
        }

        return await db.Users.AsNoTracking().Where(user => user.Id == id).Select(user => new AccountContact(user.Id, user.Email, user.DisplayName, user.PhoneNumber, user.Disabled, (
            from membership in db.UserRoles
            join role in db.Roles on membership.RoleId equals role.Id
            where membership.UserId == user.Id
            select role.Name!).ToList())).SingleOrDefaultAsync(ct);
    }

    public Task<List<UserDto>> UsersAsync(CancellationToken ct = default)
    {
        ActorGuard.Manager(actor);
        return ReadUsersAsync(ct: ct);
    }

    public async Task<(UserDto User, LinkDto? Link)> CreateAsync(UserRequest request, CancellationToken ct = default)
    {
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        ActorGuard.Manager(actor);
        if (request.Admin)
        {
            ActorGuard.Owner(actor);
        }

        if (db.Database.CurrentTransaction == null)
        {
            throw new InvalidOperationException("Account creation requires the client workflow transaction.");
        }

        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 120)
        {
            throw new PortalException(400, "invalidName");
        }

        var u = new PortalUser
        {
            DisplayName = request.Name.Trim(),
            Language = "en",
            PhoneNumber = PhoneRules.Normalize(request.PhoneNumber),
            UserName = CredentialRules.Email(request.Email),
            Email = CredentialRules.Email(request.Email),
            Activated = false,
            LockoutEnabled = true
        };
        Check(await users.CreateAsync(u));
        Check(await users.AddToRoleAsync(u, request.Admin ? PortalRoles.Admin : PortalRoles.Client));
        var link = await NewLinkAsync(u, "activation", ct);

        await db.SaveChangesAsync(ct);
        return (await DtoAsync(u, ct), link);
    }

    public async Task DisableAsync(string id, bool disabled, CancellationToken ct = default)
    {
        ActorGuard.Manager(actor);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await LockAccountAsync(id, ct);
        var u = await users.FindByIdAsync(id) ?? throw new PortalException(404, "accountNotFound");
        if (await users.IsInRoleAsync(u, PortalRoles.Owner) || (!actor.IsOwner && await users.IsInRoleAsync(u, PortalRoles.Admin)))
        {
            throw new PortalException(403, "accessDenied");
        }

        u.Disabled = disabled;
        Check(await users.UpdateAsync(u));
        Check(await users.UpdateSecurityStampAsync(u));
        await tx.CommitAsync(ct);
    }
}
