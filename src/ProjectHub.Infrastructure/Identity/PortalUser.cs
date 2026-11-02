using Microsoft.AspNetCore.Identity;

namespace ProjectHub.Infrastructure;

public class PortalUser : IdentityUser
{
    public string Language { get; set; } = "en";
    public string DisplayName { get; set; } = "";
    public bool Activated { get; set; }
    public bool Disabled { get; set; }
}
