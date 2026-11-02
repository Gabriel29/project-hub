using System.Net.Mail;

namespace ProjectHub.Application;

public static class CredentialRules
{
    public static void Password(string password)
    {
        if (string.IsNullOrEmpty(password) || password.Length < 6 || !password.Any(char.IsLetter) || !password.Any(char.IsDigit))
        {
            throw new PortalException(400, "passwordRequirements");
        }
    }

    public static string Email(string? email)
    {
        var value = email?.Trim() ?? "";
        if (value.Length > 254 || !MailAddress.TryCreate(value, out var parsed) || parsed.Address != value)
        {
            throw new PortalException(400, "invalidEmail");
        }

        return value;
    }
}
