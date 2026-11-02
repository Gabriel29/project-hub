using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using ProjectHub.Application;

namespace ProjectHub.Infrastructure;

public partial class IdentityGateway
{
    public async Task<bool> SetupRequiredAsync(CancellationToken ct = default) => !await db.UserRoles.AnyAsync(x => db.Roles.Any(r => r.Id == x.RoleId && r.Name == PortalRoles.Owner), ct);

    public async Task SetupAsync(SetupRequest request, CancellationToken ct = default)
    {
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        CredentialRules.Password(request.Password);
        var email = CredentialRules.Email(request.Email);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(71450281)", ct);
        if (!await SetupRequiredAsync(ct))
        {
            throw new PortalException(409, "setupCompleted");
        }

        var expected = config["BOOTSTRAP_TOKEN"];
        if (string.IsNullOrEmpty(expected) || !CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(Hash(request.Token)), Encoding.UTF8.GetBytes(Hash(expected))))
        {
            throw new PortalException(401, "invalidSetupKey");
        }

        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 120)
        {
            throw new PortalException(400, "invalidName");
        }

        var user = new PortalUser
        {
            Email = email,
            UserName = email,
            DisplayName = request.Name.Trim(),
            Language = PreferredLanguage(request.Language),
            PhoneNumber = PhoneRules.Normalize(request.PhoneNumber),
            Activated = true,
            LockoutEnabled = true
        };
        Check(await users.CreateAsync(user, request.Password));
        Check(await users.AddToRoleAsync(user, PortalRoles.Owner));
        await tx.CommitAsync(ct);
        await signIn.SignInAsync(user, false);
    }

    public async Task LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrEmpty(request.Password))
        {
            throw new PortalException(401, "invalidCredentials");
        }

        var u = await users.FindByEmailAsync(request.Email.Trim());
        if (u == null || u.Disabled || !u.Activated)
        {
            throw new PortalException(401, "invalidCredentials");
        }

        if (!(await signIn.PasswordSignInAsync(u, request.Password, false, true)).Succeeded)
        {
            throw new PortalException(401, "credentialsOrLocked");
        }
    }

    public async Task<UserDto> MeAsync(CancellationToken ct = default) => await DtoAsync(await CurrentAsync(ct), ct);

    public Task LogoutAsync(CancellationToken ct = default)
    {
        ActorGuard.Authenticated(actor);
        return signIn.SignOutAsync();
    }

    public async Task ChangePasswordAsync(PasswordRequest request, CancellationToken ct = default)
    {
        ActorGuard.Authenticated(actor);
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await LockAccountAsync(actor.Id, ct);
        CredentialRules.Password(request.Password);
        var u = await CurrentAsync(ct);
        Check(await users.ChangePasswordAsync(u, request.CurrentPassword ?? "", request.Password));
        await tx.CommitAsync(ct);
        await signIn.RefreshSignInAsync(u);
    }

    public async Task UpdateProfileAsync(ProfileRequest request, CancellationToken ct = default)
    {
        ActorGuard.Authenticated(actor);
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await LockAccountAsync(actor.Id, ct);
        var u = await CurrentAsync(ct);
        if (!await users.CheckPasswordAsync(u, request.CurrentPassword))
        {
            throw new PortalException(400, "incorrectPassword");
        }

        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 120)
        {
            throw new PortalException(400, "invalidName");
        }

        var email = CredentialRules.Email(request.Email);
        var emailOwner = await users.FindByEmailAsync(email);
        var emailAsNameOwner = await users.FindByNameAsync(email);
        if (new[]
        {
            emailOwner,
            emailAsNameOwner
        }.Any(other => other != null && other.Id != u.Id))
        {
            throw new PortalException(400, "emailInUse");
        }

        if (!string.Equals(u.Email, email, StringComparison.OrdinalIgnoreCase))
        {
            u.EmailConfirmed = false;
        }

        if (u.PhoneNumber != PhoneRules.Normalize(request.PhoneNumber))
        {
            u.PhoneNumberConfirmed = false;
        }

        if (request.Language != null)
        {
            u.Language = PreferredLanguage(request.Language);
        }

        u.DisplayName = request.Name.Trim();
        u.Email = email;
        u.UserName = email;
        u.PhoneNumber = PhoneRules.Normalize(request.PhoneNumber);
        Check(await users.UpdateAsync(u));
        Check(await users.UpdateSecurityStampAsync(u));
        await tx.CommitAsync(ct);
        await signIn.RefreshSignInAsync(u);
    }

    public async Task UpdatePhoneAsync(string? phoneNumber, CancellationToken ct = default)
    {
        ActorGuard.Authenticated(actor);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await LockAccountAsync(actor.Id, ct);
        var u = await CurrentAsync(ct);
        u.PhoneNumber = PhoneRules.Normalize(phoneNumber);
        u.PhoneNumberConfirmed = false;
        Check(await users.UpdateAsync(u));
        await tx.CommitAsync(ct);
        await signIn.RefreshSignInAsync(u);
    }
}
