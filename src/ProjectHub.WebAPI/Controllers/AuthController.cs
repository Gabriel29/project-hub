using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ProjectHub.Application;

namespace ProjectHub.WebAPI;

[ApiController, Route("api/auth"), EnableRateLimiting("auth")]
public class AuthController(AuthService service) : ControllerBase
{
    [HttpGet("setup-status")]
    public async Task<SetupStatusResponse> StatusAsync(CancellationToken ct = default) => new(await service.SetupRequiredAsync(ct));

    [HttpPost("setup")]
    public async Task<IActionResult> SetupAsync(SetupRequest request, CancellationToken ct = default)
    {
        await service.SetupAsync(request, ct);
        return Ok();
    }

    [HttpPost("login")]
    public async Task<IActionResult> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        await service.LoginAsync(request, ct);
        return Ok();
    }

    [HttpPost("activation-details")]
    public Task<ActivationDetails> ActivationDetailsAsync(LinkTokenRequest request, CancellationToken ct = default) => service.ActivationAsync(request.Token, ct);

    [Authorize, HttpPut("profile")]
    public async Task<IActionResult> ProfileAsync(ProfileRequest request, CancellationToken ct = default)
    {
        await service.UpdateProfileAsync(request, ct);
        return Ok();
    }

    [HttpPost("activate")]
    public async Task<IActionResult> ActivateAsync(CompleteLinkRequest request, CancellationToken ct = default)
    {
        await service.CompleteAsync(request, "activation", ct);
        return Ok();
    }

    [HttpPost("reset")]
    public async Task<IActionResult> ResetAsync(CompleteLinkRequest request, CancellationToken ct = default)
    {
        await service.CompleteAsync(request, "reset", ct);
        return Ok();
    }

    [Authorize, HttpGet("me")]
    public Task<UserDto> MeAsync(CancellationToken ct = default) => service.MeAsync(ct);

    [Authorize, HttpPut("phone")]
    public async Task<IActionResult> PhoneAsync(PhoneRequest request, CancellationToken ct = default)
    {
        await service.UpdatePhoneAsync(request.PhoneNumber, ct);
        return Ok();
    }

    [Authorize, HttpPost("password")]
    public async Task<IActionResult> PasswordAsync(PasswordRequest request, CancellationToken ct = default)
    {
        await service.ChangePasswordAsync(request, ct);
        return Ok();
    }

    [Authorize, HttpPost("logout")]
    public async Task<IActionResult> LogoutAsync(CancellationToken ct = default)
    {
        await service.LogoutAsync(ct);
        return Ok();
    }
}
