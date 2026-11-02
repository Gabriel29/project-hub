using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using ProjectHub.Application;

namespace ProjectHub.Infrastructure;

public partial class IdentityGateway(PortalDb db, UserManager<PortalUser> users, SignInManager<PortalUser> signIn, IConfiguration config, ICurrentUser actor) : IIdentityGateway
{
    private async Task LockAccountAsync(string id, CancellationToken ct = default)
    {
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtext({id}))", ct);
        var tracked = db.ChangeTracker.Entries<PortalUser>().SingleOrDefault(e => e.Entity.Id == id);
        if (tracked != null)
        {
            await tracked.ReloadAsync(ct);
        }
    }

    private static string PreferredLanguage(string? language) => language == null ? "en" : language is "en" or "ro" ? language : throw new PortalException(400, "invalidLanguage");

    private static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token ?? "")));

    private static void Check(IdentityResult request)
    {
        if (!request.Succeeded)
        {
            var code = request.Errors.First().Code switch
            {
                "DuplicateEmail" or "DuplicateUserName" => "emailInUse",
                "InvalidEmail" or "InvalidUserName" => "invalidEmail",
                "PasswordTooShort" or "PasswordRequiresDigit" or "PasswordRequiresLower" or "PasswordRequiresUpper" or "PasswordRequiresNonAlphanumeric" or "PasswordRequiresUniqueChars" => "passwordRequirements",
                "PasswordMismatch" => "incorrectPassword",
                "InvalidToken" => "requestNewLink",
                "ConcurrencyFailure" => "concurrentChange",
                _ => "invalidRequest"
            };
            throw new PortalException(400, code);
        }
    }

    private async Task<PortalUser> CurrentAsync(CancellationToken ct = default)
    {
        ActorGuard.Authenticated(actor);
        var user = await users.FindByIdAsync(actor.Id);
        if (user == null || user.Disabled || !user.Activated)
        {
            throw new PortalException(401, "signInRequired");
        }

        return user;
    }

    private async Task<PortalUser> InvitedUserAsync(string id, CancellationToken ct = default)
    {
        var u = await users.FindByIdAsync(id) ?? throw new PortalException(404, "clientNotFound");
        if ((!await users.IsInRoleAsync(u, PortalRoles.Client) && !await users.IsInRoleAsync(u, PortalRoles.Admin)) || await users.IsInRoleAsync(u, PortalRoles.Owner) || u.Disabled)
        {
            throw new PortalException(400, "clientUnavailable");
        }

        return u;
    }
}
