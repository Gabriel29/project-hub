namespace ProjectHub.Application;

public static class PhoneRules
{
    public static string? Normalize(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
        {
            return null;
        }

        phone = phone.Trim();
        if (phone.Length > 40 || phone.Count(char.IsDigit) < 6 || phone.Any(c => !char.IsDigit(c) && c is not ('+' or ' ' or '-' or '(' or ')')))
        {
            throw new PortalException(400, "invalidPhone");
        }

        return phone;
    }
}
