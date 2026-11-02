using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using ProjectHub.Application;

namespace ProjectHub.Infrastructure;

public partial class IdentityGateway
{
    private async Task<LinkDto> NewLinkAsync(PortalUser u, string purpose, CancellationToken ct = default)
    {
        if (purpose is not ("activation" or "reset") || (purpose == "activation" && u.Activated) || (purpose == "reset" && !u.Activated))
        {
            throw new PortalException(400, "invalidLinkType");
        }

        await db.AccessLinks.Where(l => l.UserId == u.Id && l.RevokedAt == null && l.ConsumedAt == null).ExecuteUpdateAsync(s => s.SetProperty(l => l.RevokedAt, DateTimeOffset.UtcNow), ct);
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var link = new AccessLink
        {
            UserId = u.Id,
            Purpose = purpose,
            TokenHash = Hash(token),
            ExpiresAt = DateTimeOffset.UtcNow.AddHours(purpose == "activation" ? 168 : 24)
        };
        db.AccessLinks.Add(link);
        return new(link.Id, link.ExpiresAt, token, purpose);
    }

    public async Task<LinkDto> GenerateAsync(string id, string purpose, CancellationToken ct = default)
    {
        ActorGuard.Manager(actor);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await LockAccountAsync(id, ct);
        var u = await InvitedUserAsync(id, ct);
        if (await users.IsInRoleAsync(u, PortalRoles.Admin))
        {
            ActorGuard.Owner(actor);
        }

        var link = await NewLinkAsync(u, purpose, ct);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return link;
    }

    public async Task CompleteAsync(CompleteLinkRequest request, string purpose, CancellationToken ct = default)
    {
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        CredentialRules.Password(request.Password);
        var hash = Hash(request.Token);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var userId = await db.AccessLinks.Where(l => l.TokenHash == hash).Select(l => l.UserId).SingleOrDefaultAsync(ct);
        if (userId == null)
        {
            throw new PortalException(401, "requestNewLink");
        }

        await LockAccountAsync(userId, ct);
        var link = await db.AccessLinks.FromSqlInterpolated($"SELECT * FROM \"identity\".\"AccessLinks\" WHERE \"TokenHash\" = {hash} FOR UPDATE").SingleOrDefaultAsync(ct);
        if (link == null || link.Purpose != purpose || link.ConsumedAt != null || link.RevokedAt != null || link.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            throw new PortalException(401, "requestNewLink");
        }

        // The token row lock ensures only one completion can commit; failed validation rolls back identity changes.
        var lockedUser = await db.Users.FromSqlInterpolated($"SELECT * FROM \"identity\".\"AspNetUsers\" WHERE \"Id\"={link.UserId} FOR UPDATE").SingleOrDefaultAsync(ct) ?? throw new PortalException(401, "accountNotFound");
        await db.Entry(lockedUser).ReloadAsync(ct);
        var u = await InvitedUserAsync(link.UserId, ct);
        if (purpose == "activation")
        {
            if (u.Activated)
            {
                throw new PortalException(409, "accountActivated");
            }

            var email = CredentialRules.Email(request.Email);
            u.PhoneNumber = PhoneRules.Normalize(request.PhoneNumber) ?? u.PhoneNumber;
            if (!string.IsNullOrWhiteSpace(request.Name))
            {
                if (request.Name.Length > 120)
                {
                    throw new PortalException(400, "invalidName");
                }

                u.DisplayName = request.Name.Trim();
            }

            u.Email = email;
            u.UserName = email;
            u.Activated = true;
            if (request.Language != null)
            {
                u.Language = PreferredLanguage(request.Language);
            }

            Check(await users.UpdateAsync(u));
            Check(await users.AddPasswordAsync(u, request.Password));
        }
        else
        {
            if (request.Email != null)
            {
                throw new PortalException(400, "emailCannotChange");
            }

            if (!u.Activated)
            {
                throw new PortalException(400, "activateAccount");
            }

            Check(await users.ResetPasswordAsync(u, await users.GeneratePasswordResetTokenAsync(u), request.Password));
        }

        link.ConsumedAt = DateTimeOffset.UtcNow;
        Check(await users.UpdateSecurityStampAsync(u));
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        if (purpose == "activation")
        {
            await signIn.SignInAsync(u, false);
        }
        else
        {
            await signIn.SignOutAsync();
        }
    }

    public async Task<ActivationDetails> ActivationAsync(string token, CancellationToken ct = default)
    {
        var hash = Hash(token);
        var link = await db.AccessLinks.SingleOrDefaultAsync(l => l.TokenHash == hash && l.Purpose == "activation" && l.ConsumedAt == null && l.RevokedAt == null && l.ExpiresAt > DateTimeOffset.UtcNow, ct);
        if (link == null)
        {
            throw new PortalException(401, "requestNewLink");
        }

        var u = await InvitedUserAsync(link.UserId, ct);
        if (u.Activated)
        {
            throw new PortalException(401, "linkExpiredOrUsed");
        }

        return new(u.DisplayName, u.Email, u.PhoneNumber, u.Language);
    }

    public async Task RevokeAsync(string id, CancellationToken ct = default)
    {
        ActorGuard.Manager(actor);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await LockAccountAsync(id, ct);
        var u = await InvitedUserAsync(id, ct);
        if (await users.IsInRoleAsync(u, PortalRoles.Admin))
        {
            ActorGuard.Owner(actor);
        }

        await db.AccessLinks.Where(l => l.UserId == id && l.RevokedAt == null && l.ConsumedAt == null).ExecuteUpdateAsync(s => s.SetProperty(l => l.RevokedAt, DateTimeOffset.UtcNow), ct);
        await tx.CommitAsync(ct);
    }
}
