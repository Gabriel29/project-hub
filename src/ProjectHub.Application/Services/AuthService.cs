namespace ProjectHub.Application;

public class AuthService(IIdentityGateway identity)
{
    public Task<bool> SetupRequiredAsync(CancellationToken ct = default) => identity.SetupRequiredAsync(ct);

    public Task SetupAsync(SetupRequest request, CancellationToken ct = default)
    {
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        CredentialRules.Email(request.Email);
        CredentialRules.Password(request.Password);
        return identity.SetupAsync(request, ct);
    }

    public Task<ActivationDetails> ActivationAsync(string token, CancellationToken ct = default) => identity.ActivationAsync(token, ct);

    public Task UpdateProfileAsync(ProfileRequest request, CancellationToken ct = default) => identity.UpdateProfileAsync(request, ct);

    public Task UpdatePhoneAsync(string? phoneNumber, CancellationToken ct = default) => identity.UpdatePhoneAsync(phoneNumber, ct);

    public Task LoginAsync(LoginRequest request, CancellationToken ct = default) => identity.LoginAsync(request, ct);

    public Task<UserDto> MeAsync(CancellationToken ct = default) => identity.MeAsync(ct);

    public Task LogoutAsync(CancellationToken ct = default) => identity.LogoutAsync(ct);

    public Task ChangePasswordAsync(PasswordRequest request, CancellationToken ct = default)
    {
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        CredentialRules.Password(request.Password);
        return identity.ChangePasswordAsync(request, ct);
    }

    public Task CompleteAsync(CompleteLinkRequest request, string purpose, CancellationToken ct = default)
    {
        if (request is null)
        {
            throw new PortalException(400, "invalidRequest");
        }

        CredentialRules.Password(request.Password);
        if (purpose == "activation")
        {
            CredentialRules.Email(request.Email);
        }

        return identity.CompleteAsync(request, purpose, ct);
    }
}
