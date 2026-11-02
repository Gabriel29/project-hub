namespace ProjectHub.Application;

public interface IIdentityGateway
{
    Task<AccountContact?> ContactAsync(string? id, CancellationToken ct = default);
    Task<bool> SetupRequiredAsync(CancellationToken ct = default);
    Task SetupAsync(SetupRequest request, CancellationToken ct = default);
    Task LoginAsync(LoginRequest request, CancellationToken ct = default);
    Task<UserDto> MeAsync(CancellationToken ct = default);
    Task LogoutAsync(CancellationToken ct = default);
    Task ChangePasswordAsync(PasswordRequest request, CancellationToken ct = default);
    Task<List<UserDto>> UsersAsync(CancellationToken ct = default);
    Task<(UserDto User, LinkDto? Link)> CreateAsync(UserRequest request, CancellationToken ct = default);
    Task<LinkDto> GenerateAsync(string id, string purpose, CancellationToken ct = default);
    Task CompleteAsync(CompleteLinkRequest request, string purpose, CancellationToken ct = default);
    Task UpdatePhoneAsync(string? phoneNumber, CancellationToken ct = default);
    Task<ActivationDetails> ActivationAsync(string token, CancellationToken ct = default);
    Task UpdateProfileAsync(ProfileRequest request, CancellationToken ct = default);
    Task DisableAsync(string id, bool disabled, CancellationToken ct = default);
    Task RevokeAsync(string id, CancellationToken ct = default);
}
